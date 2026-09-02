
import React, { useState, useRef, memo } from 'react';
import { ApiConfig, GenerationTask } from '../types';
import { uploadFile } from '../utils/api';
import { uploadToYunwu } from '../utils/yunwuApi';
import MD3Select from './MD3Select';
import { formatMediaUrl } from '../utils/url';

interface TaskItemProps {
  task: GenerationTask;
  index: number;
  onDelete: (idx: number) => void;
  onCopy: (text: string, id: string) => void;
  onView: (url: string, type: 'image' | 'video') => void;
  onAdd: (url: string, type: 'image' | 'video', id?: string, poster?: string) => void;
  copiedId: string | null;
}

const TaskItem = memo(({ task: t, index, onDelete, onCopy, onView, onAdd, copiedId }: TaskItemProps) => {
  const taskId = t.id || `temp-${index}`;
  return (
    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 relative group hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors">
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex gap-2 items-center">
            <span className="text-xs bg-slate-300 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 uppercase font-bold tracking-wider">{t.type}</span>
            {t.engine === 'yunwu' && <span className="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">Yunwu</span>}
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={() => onCopy(t.prompt, taskId)} 
            className={`${copiedId === taskId ? 'text-green-500' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'} transition-colors`} 
            title="复制提示词"
          >
            <i className={`fa-solid ${copiedId === taskId ? 'fa-check' : 'fa-copy'} text-xs`}></i>
          </button>
          <button onClick={() => onDelete(index)} className="text-slate-400 hover:text-red-500 transition" title="删除"><i className="fa-solid fa-trash text-xs"></i></button>
          <span className={`text-xs font-bold ${t.status === 'succeeded' ? 'text-green-500' : t.status === 'failed' ? 'text-red-500' : 'text-blue-500'}`}>
            {t.status === 'running' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : t.status}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2.5 leading-relaxed" title={t.prompt}>{t.prompt}</p>
      
      {t.status === 'succeeded' && t.results && (
        <div className="grid gap-2">
          {t.results.map((res, ridx) => {
            const mediaUrl = formatMediaUrl(res.url);
            const posterUrl = t.poster ? formatMediaUrl(t.poster) : '';
            const isCloud = res.url.startsWith('http'); // 判断是否为云端链接

            return (
              <div key={ridx} className="relative group/media">
                {isCloud && (
                  <div className="absolute top-1.5 left-1.5 z-20 bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-white/20 animate-in zoom-in duration-200" title="云端资源 (未本地化)">
                    <i className="fa-solid fa-cloud text-[10px]"></i>
                  </div>
                )}
                
                {t.type === 'image' ? (
                  <img 
                    src={mediaUrl} 
                    onClick={() => onView(res.url, 'image')} // 传递原始 URL 给 Lightbox，由 Lightbox 统一处理转换
                    className="w-full h-32 object-cover rounded-lg border border-slate-300 dark:border-white/10 cursor-zoom-in hover:border-slate-400 dark:hover:border-white/30 transition-colors"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<div class="w-full h-32 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-lg text-slate-400 text-xs flex-col gap-1 border border-slate-300 dark:border-slate-700"><i class="fa-regular fa-image-slash"></i><span>资源失效</span></div>');
                    }}
                  />
                ) : (
                  <div 
                    className="w-full h-32 rounded-lg border border-slate-300 dark:border-white/10 cursor-zoom-in hover:border-slate-400 dark:hover:border-white/30 transition-all relative overflow-hidden bg-slate-200 dark:bg-slate-900"
                    onClick={() => onView(res.url, 'video')} // 传递原始 URL
                  >
                    <div 
                      style={{ 
                        backgroundImage: `url(${posterUrl || mediaUrl + '#t=0.1'}), url(https://gallery-image.spbst.cn/webp/1996842084186718208/bbc94cff-35d9-499e-9b9c-dced72a044f6)`, 
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                      className="absolute inset-0 w-full h-full"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:media:opacity-100 transition-opacity">
                       <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center text-white border border-white/40">
                          <i className="fa-solid fa-play ml-1"></i>
                       </div>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover/media:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAdd(res.url, t.type, undefined, t.poster); }}
                    className="bg-black/60 text-white p-2 rounded-lg text-xs hover:bg-purple-600 transition-colors"
                    title="添加到画布"
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {t.status === 'failed' && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/20 p-1.5 rounded mt-1.5">{t.msg}</div>
      )}

      {t.status === 'running' && (
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2.5 overflow-hidden">
          <div className="h-full bg-blue-500 animate-[pulse_2s_infinite]" style={{width: `${Math.max(5, t.progress)}%`}}></div>
        </div>
      )}
    </div>
  );
});

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSettings: () => void;
  onClearHistory: () => void;
  tasks: GenerationTask[];
  onDeleteTask: (index: number) => void;
  onSubmitTask: (type: 'image' | 'video', params: any) => void;
  onAddToCanvas: (url: string, type: 'image' | 'video', id?: string, poster?: string) => void;
  onUploadFile: (file: File, type: 'image' | 'video') => void;
  onViewMedia: (url: string, type: 'image' | 'video') => void;
  apiConfig: ApiConfig;
  activeTab: 'image' | 'video' | 'tasks';
  setActiveTab: (tab: 'image' | 'video' | 'tasks') => void;
  unreadTasks?: number;
  imgRefs: string[];
  setImgRefs: (refs: string[]) => void;
  vidRef: string;
  setVidRef: (url: string) => void;
  prompt: string;
  setPrompt: (s: string) => void;
  vidPrompt: string;
  setVidPrompt: (s: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onToggle, onSettings, onClearHistory,
  tasks, onDeleteTask, onSubmitTask, onAddToCanvas, onUploadFile, onViewMedia, apiConfig,
  activeTab, setActiveTab, unreadTasks = 0, imgRefs, setImgRefs, vidRef, setVidRef, 
  prompt, setPrompt, vidPrompt, setVidPrompt
}) => {
  
  const [imgModel, setImgModel] = useState('nano-banana-fast');
  const [imgRatio, setImgRatio] = useState('16:9');
  const [imgSize, setImgSize] = useState('1K');
  const [imgMode, setImgMode] = useState<'file' | 'url'>('file');
  const [imgUrlInput, setImgUrlInput] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Video State
  const [vidEngine, setVidEngine] = useState<'yunwu' | 'backup'>('yunwu'); // 默认为云雾
  const [vidRatio, setVidRatio] = useState('16:9');
  const [vidDuration, setVidDuration] = useState('10');
  const [vidMode, setVidMode] = useState<'file' | 'url'>('file');
  const [vidUrlInput, setVidUrlInput] = useState('');
  const [isUploadingVid, setIsUploadingVid] = useState(false);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);

  const imgModelOptions = [
    { label: 'Nano-banana-Fast (极速)', value: 'nano-banana-fast' },
    { label: 'Nano-banana-Pro (专业)', value: 'nano-banana-pro' }
  ];
  
  const ratioOptions = [
    { label: '16:9 (横屏)', value: '16:9' },
    { label: '1:1 (方图)', value: '1:1' },
    { label: '4:3 (标准)', value: '4:3' },
    { label: '3:4 (竖屏)', value: '3:4' },
    { label: '9:16 (手机)', value: '9:16' }
  ];

  const vidEngineOptions = [
    { label: '云 雾 (主引擎)', value: 'yunwu' },
    { label: 'Grsai (备用引擎)', value: 'backup' }
  ];

  const vidRatioOptions = [
    { label: '16:9 (横屏)', value: '16:9' },
    { label: '9:16 (竖屏)', value: '9:16' }
  ];

  const sizeOptions = [
    { label: '1K (标准)', value: '1K' },
    { label: '2K (高清)', value: '2K' },
    { label: '4K (超清)', value: '4K' }
  ];

  const durationOptions = [
    { label: '10s', value: '10' },
    { label: '15s', value: '15' }
  ];

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploadingImg(true);
      try {
        const url = await uploadFile(e.target.files[0], apiConfig);
        if (imgRefs.length < 4) setImgRefs([...imgRefs, url]);
      } catch (error) {
        alert('Upload failed: ' + error);
      } finally {
        setIsUploadingImg(false);
        e.target.value = '';
      }
    }
  };

  const handleVidUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploadingVid(true);
      try {
        let url;
        if (vidEngine === 'yunwu') {
            // 云雾引擎使用特殊的图床
            if (!apiConfig.yunwuKey) {
                alert('请先在设置中配置 Yunwu API Key');
                setIsUploadingVid(false);
                return;
            }
            url = await uploadToYunwu(e.target.files[0], apiConfig);
        } else {
            // 备用引擎使用默认上传
            url = await uploadFile(e.target.files[0], apiConfig);
        }
        setVidRef(url);
      } catch (error) {
        alert('Upload failed: ' + error);
      } finally {
        setIsUploadingVid(false);
        e.target.value = '';
      }
    }
  };

  const handleTaskSubmit = (type: 'image' | 'video') => {
    if (type === 'image') {
      if (!prompt.trim()) return alert('请输入提示词');
      onSubmitTask('image', {
        model: imgModel,
        prompt: prompt,
        aspectRatio: imgRatio,
        imageSize: imgSize,
        urls: imgRefs.length > 0 ? imgRefs : undefined
      });
    } else {
      if (!vidPrompt.trim()) return alert('请输入提示词');
      
      const payload: any = {
        model: 'sora-2',
        prompt: vidPrompt,
        aspectRatio: vidRatio,
        duration: parseInt(vidDuration),
        url: vidRef || undefined,
        engine: vidEngine
      };

      if (vidEngine === 'backup') {
          payload.size = "small";
      }

      onSubmitTask('video', payload);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <aside 
      className={`absolute top-[110px] left-[10px] w-[326px] h-[75vh] 
        bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl 
        z-50 flex flex-col transition-all duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-[120%]'}
      `}
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="h-12 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
        <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
          <i className="fa-solid fa-infinity text-purple-600 dark:text-purple-500 text-lg"></i>
          <h1 className="font-bold tracking-wide text-sm">Wujie Studio</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onToggle} className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
          <button onClick={onClearHistory} className="w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-red-500 transition">
            <i className="fa-solid fa-trash text-sm"></i>
          </button>
          <button onClick={onSettings} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition">
            <i className="fa-solid fa-gear text-xs"></i>
          </button>
        </div>
      </div>

      <div className="p-3 shrink-0">
        <div className="flex p-1 gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5">
          <button onClick={() => setActiveTab('image')} className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${activeTab === 'image' ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
            <i className="fa-solid fa-paintbrush mr-1"></i> 绘画
          </button>
          <button onClick={() => setActiveTab('video')} className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${activeTab === 'video' ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
            <i className="fa-solid fa-video mr-1"></i> 视频
          </button>
          <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all relative ${activeTab === 'tasks' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
            <i className="fa-solid fa-clock-rotate-left mr-1"></i> 历史
            {unreadTasks > 0 && activeTab !== 'tasks' && (
              <span className="absolute -top-1.5 -right-1 bg-red-600 text-white text-[9px] min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center font-black border border-white dark:border-slate-800 animate-pulse">
                {unreadTasks}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scroll">
        {activeTab === 'image' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-200">
            <div className="relative z-20">
              <MD3Select label="模型" value={imgModel} options={imgModelOptions} onChange={setImgModel} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5">提示词 <span className="text-red-500">*</span></label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} className="w-full bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none resize-none focus:border-purple-500 transition-all placeholder-slate-400 dark:placeholder-slate-600" placeholder="描述画面..." />
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <MD3Select label="比例" value={imgRatio} options={ratioOptions} onChange={setImgRatio} />
              <MD3Select label="画质" value={imgSize} options={sizeOptions} onChange={setImgSize} />
            </div>
            <div className="relative z-0">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-slate-500 dark:text-slate-400">参考图 (Max 4)</label>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setImgMode('file')} className={imgMode === 'file' ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}>本地</button>
                  <button onClick={() => setImgMode('url')} className={imgMode === 'url' ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}>链接</button>
                </div>
              </div>
              {imgMode === 'file' ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 text-center cursor-pointer hover:border-purple-500/50 transition-colors">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImgUpload} />
                  {isUploadingImg ? (<div className="text-purple-500 text-xs"><i className="fa-solid fa-spinner fa-spin"></i> 上传中...</div>) : (<div className="text-slate-500 text-xs"><i className="fa-solid fa-plus text-base mb-1 block"></i> 点击上传</div>)}
                </div>
              ) : (
                <div className="flex gap-1">
                  <input type="text" value={imgUrlInput} onChange={e => setImgUrlInput(e.target.value)} className="flex-1 bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500 placeholder-slate-400 dark:placeholder-slate-600" placeholder="https://..." />
                  <button onClick={() => { if(imgUrlInput && imgRefs.length < 4) { setImgRefs([...imgRefs, imgUrlInput]); setImgUrlInput(''); } }} className="bg-slate-200 dark:bg-slate-700 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600">OK</button>
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 mt-2 empty:hidden">
                {imgRefs.map((url, i) => {
                   const mediaUrl = formatMediaUrl(url);
                   return (
                     <div key={i} className="relative h-14 w-full group">
                       <img src={mediaUrl} className="h-full w-full object-cover rounded-lg border border-slate-200 dark:border-white/20" />
                       <button onClick={() => setImgRefs(imgRefs.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                     </div>
                   );
                })}
              </div>
            </div>
            <button onClick={() => handleTaskSubmit('image')} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl mt-2 text-xs transition-all active:scale-[0.98]">生成图片</button>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-200">
            <div className="relative z-30">
               <MD3Select 
                 label="视频引擎" 
                 value={vidEngine} 
                 options={vidEngineOptions} 
                 onChange={(val) => { setVidEngine(val as any); setVidRef(''); }} 
               />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5">提示词 <span className="text-red-500">*</span></label>
              <textarea value={vidPrompt} onChange={e => setVidPrompt(e.target.value)} rows={3} className="w-full bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none resize-none focus:border-emerald-500 transition-all placeholder-slate-400 dark:placeholder-slate-600" placeholder="描述视频动作..." />
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-20">
              <MD3Select label="比例" value={vidRatio} options={vidRatioOptions} onChange={setVidRatio} />
              <MD3Select label="时长" value={vidDuration} options={durationOptions} onChange={setVidDuration} />
            </div>
             <div className="relative z-0">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-slate-500 dark:text-slate-400">首帧图 (可选)</label>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setVidMode('file')} className={vidMode === 'file' ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}>本地</button>
                  <button onClick={() => setVidMode('url')} className={vidMode === 'url' ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}>链接</button>
                </div>
              </div>
              {vidMode === 'file' ? (
                <div onClick={() => vidInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 text-center cursor-pointer hover:border-emerald-500/50 transition-colors relative">
                  <input type="file" ref={vidInputRef} className="hidden" accept="image/*" onChange={handleVidUpload} />
                  {isUploadingVid ? (
                    <div className="text-emerald-500 text-xs"><i className="fa-solid fa-spinner fa-spin"></i> 上传中...</div>
                  ) : (
                    <div className="text-slate-500 text-xs"><i className="fa-solid fa-image text-base mb-1 block"></i> 点击上传首帧</div>
                  )}
                </div>
              ) : (
                <div className="flex gap-1">
                   <input type="text" value={vidUrlInput} onChange={e => setVidUrlInput(e.target.value)} className="flex-1 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 placeholder-slate-400 dark:placeholder-slate-600" placeholder="https://..." />
                  <button onClick={() => { if(vidUrlInput) setVidRef(vidUrlInput); setVidUrlInput(''); }} className="bg-slate-200 dark:bg-slate-700 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600">OK</button>
                </div>
              )}
              {vidRef && (
                  <div className="mt-2 relative w-full h-32 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden group">
                     <img src={formatMediaUrl(vidRef)} className="w-full h-full object-contain" />
                     <button 
                        onClick={() => { setVidRef(''); if(vidInputRef.current) vidInputRef.current.value = ''; }} 
                        className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                        title="删除参考图"
                     >
                        <i className="fa-solid fa-xmark text-xs"></i>
                     </button>
                  </div>
              )}
            </div>
            <button onClick={() => handleTaskSubmit('video')} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl mt-2 text-xs transition-all active:scale-[0.98]">生成视频</button>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-200">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                <i className="fa-solid fa-ghost text-3xl mb-3"></i>
                <p className="text-xs">暂无历史记录</p>
              </div>
            ) : (
              [...tasks].reverse().slice(0, 200).map((t, reversedIndex) => (
                <TaskItem 
                  key={t.id || `task-${tasks.length - 1 - reversedIndex}`}
                  task={t}
                  index={tasks.length - 1 - reversedIndex}
                  onDelete={onDeleteTask}
                  onCopy={copyToClipboard}
                  onView={onViewMedia}
                  onAdd={onAddToCanvas}
                  copiedId={copiedId}
                />
              ))
            )}
            {tasks.length > 200 && (
              <p className="text-[10px] text-center text-slate-500 py-2">仅展示最近 200 条记录</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
