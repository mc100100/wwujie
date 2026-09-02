
import React, { useEffect, useRef, useState } from 'react';
import { formatMediaUrl } from '../utils/url';
import { Shot } from './DirectorStoryboardStep';

interface RenderStepProps {
  shots: Shot[];
  onRenderOne: (id: string) => void;
  onRenderAll: () => void;
  onExport: () => void;
  onPreview: (url: string) => void;
  editingItemId: string | null;
  editContent: string;
  setEditContent: (val: string) => void;
  onStartEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string) => void;
}

const RenderStep: React.FC<RenderStepProps> = ({
  shots,
  onRenderOne,
  onRenderAll,
  onExport,
  onPreview,
  editingItemId,
  editContent,
  setEditContent,
  onStartEdit,
  onSaveEdit,
}) => {
  // 移除过滤逻辑，显示所有分镜
  // const successfulShots = shots.filter(s => s.status === 'success');
  
  const editContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 用于本地临时切换预览视频
  const [activeVideoMap, setActiveVideoMap] = useState<Record<string, string>>({});
  // 记录当前正在播放视频的 Shot ID，用于按需渲染 video 标签
  const [playingShotId, setPlayingShotId] = useState<string | null>(null);

  // 点击外部保存逻辑
  useEffect(() => {
    if (!editingItemId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) {
        onSaveEdit(editingItemId);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingItemId, onSaveEdit]);

  // 编辑模式下文本框高度自适应内容
  useEffect(() => {
    if (editingItemId && textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }
  }, [editContent, editingItemId]);

  return (
    <div className="flex flex-col h-full gap-4 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-base md:text-xl font-black text-slate-800 dark:text-white">视频渲染</h3>
        <button onClick={onRenderAll} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] md:text-xs shadow-lg">全部分镜批量生成</button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scroll pr-2 md:pr-4 space-y-6">
        {shots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <i className="fa-solid fa-film text-4xl mb-4 opacity-20"></i>
             <p className="text-sm">尚未生成任何分镜，请先在第一步拆解剧本</p>
          </div>
        ) : (
          shots.map((shot, idx) => {
            const currentVideoUrl = activeVideoMap[shot.id] || shot.videoUrl;
            const history = shot.videoHistory || [];
            const isEditing = editingItemId === shot.id;
            const isPlaying = playingShotId === shot.id;
            const isGenerating = shot.videoStatus === 'generating';
            const refUrl = shot.resultUrl ? formatMediaUrl(shot.resultUrl) : '';
            
            return (
              <div key={shot.id} className="flex flex-col gap-5 p-6 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-xl">
                
                {/* 1. 媒体顶部区：参考图 + 四宫格历史 */}
                <div className="flex gap-4">
                    {/* 左侧：主参考图 */}
                    <div 
                      className="flex-1 aspect-video bg-slate-100 dark:bg-black/40 rounded-2xl overflow-hidden relative group/img cursor-zoom-in border border-slate-200 dark:border-white/5"
                      onClick={() => shot.resultUrl && onPreview(shot.resultUrl)}
                    >
                      {shot.resultUrl ? (
                        <img src={refUrl} className="w-full h-full object-cover" alt="ref" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                           <i className="fa-solid fa-image text-3xl mb-2 opacity-30"></i>
                           <span className="text-[10px] opacity-50 font-bold">暂无参考图</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">参考图</div>
                    </div>

                    {/* 右侧：四宫格历史记录 */}
                    <div className="flex-1 aspect-video grid grid-cols-2 grid-rows-2 gap-2">
                       {[0, 1, 2, 3].map(i => {
                          const hasVideo = !!history[i];
                          const isSelected = currentVideoUrl === history[i];
                          
                          return (
                            <div 
                              key={i} 
                              className={`
                                relative rounded-xl overflow-hidden border transition-all duration-300 flex items-center justify-center
                                ${hasVideo ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default opacity-40'}
                                ${isSelected ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10' : 'border-slate-200 dark:border-white/5'}
                              `}
                              onClick={() => {
                                  if (hasVideo) {
                                      setActiveVideoMap(prev => ({...prev, [shot.id]: history[i]}));
                                      setPlayingShotId(shot.id);
                                  }
                              }}
                            >
                               {/* 背景：伪毛玻璃 - 仅当有参考图时显示 */}
                               {refUrl && (
                                   <div 
                                      className="absolute inset-0 z-0 transition-all duration-500"
                                      style={{ 
                                          backgroundImage: `url(${refUrl})`,
                                          backgroundSize: 'cover',
                                          backgroundPosition: 'center',
                                          filter: 'blur(12px) brightness(0.6)'
                                      }}
                                   />
                               )}

                               {/* 版本勋章 */}
                               <div className="relative z-10 flex flex-col items-center gap-0.5">
                                  <span className={`
                                     text-[14px] font-black italic font-mono transition-colors
                                     ${isSelected ? 'text-white' : 'text-white/60'}
                                  `}>
                                     V{i + 1}
                                  </span>
                                  {isSelected && (
                                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                  )}
                               </div>

                               {/* 状态标签 */}
                               {hasVideo && (
                                  <div className="absolute bottom-1 right-1.5 text-[7px] font-black text-white/40 uppercase tracking-tighter">
                                     15s / HD
                                  </div>
                                )}
                            </div>
                          );
                       })}
                    </div>
                </div>

                {/* 2. 视频主预览区 */}
                <div className="w-full aspect-video bg-slate-100 dark:bg-black/40 rounded-3xl overflow-hidden relative group border-2 border-slate-100 dark:border-white/5 shadow-inner">
                  {currentVideoUrl ? (
                    isPlaying ? (
                        <video 
                          src={formatMediaUrl(currentVideoUrl)} 
                          className="w-full h-full object-cover" 
                          controls 
                          autoPlay 
                          loop 
                          onPause={() => setPlayingShotId(null)}
                        />
                    ) : (
                        <div 
                            className="w-full h-full relative cursor-pointer"
                            onClick={() => setPlayingShotId(shot.id)}
                        >
                            <img 
                                src="https://gallery-image.spbst.cn/webp/1996842139585085440/e035bda1-3408-4ca8-9c88-129b2009b6f2"
                                className="w-full h-full object-cover"
                                alt="video-poster"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-all">
                                <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/40 scale-100 group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-play text-2xl ml-1"></i>
                                </div>
                            </div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/60 font-black uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                                Click to Play
                            </div>
                        </div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      {isGenerating ? (
                        <div className="flex flex-col items-center gap-3">
                           <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-500"></i>
                           <span className="text-[11px] font-black text-emerald-500">Sora 正在排队生成中...</span>
                        </div>
                      ) : (
                        <>
                          <i className="fa-solid fa-film text-4xl opacity-20"></i>
                          <span className="text-[11px] font-black mt-3 uppercase tracking-widest text-slate-400">Waiting for Render</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. 提示词参数区 */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">分镜参数 (VID PROMPT)</span>
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded-full">#{idx+1}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="flex gap-2">
                          <span className="bg-rose-50 dark:bg-rose-900/20 text-rose-500 text-[9px] font-bold px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900/30">{shot.shotType}</span>
                          <span className="bg-slate-50 dark:bg-white/5 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">{shot.movement}</span>
                       </div>
                       
                       {/* 生成按钮 (解除异步限制) */}
                       <button 
                        onClick={(e) => { e.stopPropagation(); onRenderOne(shot.id); }} 
                        className={`px-4 py-1 rounded-lg text-[11px] font-black transition-all active:scale-95 flex items-center gap-2
                          ${isGenerating 
                            ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                            : 'bg-rose-100 text-rose-600 border border-rose-200'
                          }
                        `}
                       >
                         {isGenerating && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                         {isGenerating ? '再次生成' : '生成视频'}
                       </button>
                    </div>
                  </div>

                  <div className={`relative bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden transition-all duration-300 focus-within:border-emerald-500/50 ${isEditing ? 'min-h-[256px]' : 'h-48'}`}>
                    {isEditing ? (
                      <div ref={editContainerRef} className="w-full h-full p-1">
                        <textarea 
                          ref={textareaRef}
                          value={editContent} 
                          onChange={(e) => setEditContent(e.target.value)} 
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-4 text-[11px] text-slate-800 dark:text-slate-200 outline-none resize-none font-mono leading-relaxed overflow-hidden" 
                          autoFocus 
                        />
                      </div>
                    ) : (
                      <div 
                        onClick={() => onStartEdit(shot.id, shot.videoPrompt || '')}
                        className="w-full h-full p-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed whitespace-pre-wrap cursor-text hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors overflow-y-auto custom-scroll"
                      >
                        {shot.videoPrompt || '点击输入视频生成提示词...'}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RenderStep;
