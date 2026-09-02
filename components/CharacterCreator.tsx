
import React, { useState, useEffect, useRef } from 'react';
import { ApiConfig } from '../types';
import { createCharacterTask, pollTaskResult, uploadFileWithProgress } from '../utils/api';

interface CharacterCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
  onAddToLibrary?: (id: string) => void;
}

const ERROR_MAP: Record<string, string> = {
  "output_moderation": "生成内容涉及违规，已被系统拦截",
  "input_moderation": "上传视频包含违规内容，无法处理",
  "error": "系统内部错误，请重试",
  "Invalid input parameters": "输入参数无效，请检查时间戳或视频格式"
};

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ isOpen, onClose, apiConfig, onAddToLibrary }) => {
  // State
  const [videoUrl, setVideoUrl] = useState('');
  const [timestamps, setTimestamps] = useState('0,3');
  const [logs, setLogs] = useState<{ time: string, msg: string, type: 'info' | 'success' | 'error' }[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(''); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);

  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 假进度条定时器引用
  const progressTimer = useRef<any>(null);

  const winRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, msg, type }]);
  };

  // 启动假进度条：根据预估时间动态调整速率
  const startFakeProgress = (estimatedSeconds: number) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(0);
    
    // 计算每跑 1% 需要的毫秒数
    // 例如 70秒跑完 => 70000ms / 100 = 700ms 更新一次
    const intervalMs = (estimatedSeconds * 1000) / 100;

    progressTimer.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) return 99; // 卡在 99% 等待真实结果
        return prev + 1;
      });
    }, intervalMs); 
  };

  const stopFakeProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = null;
  };

  useEffect(() => {
    const element = winRef.current;
    const handle = headerRef.current;
    if (!element || !handle) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      isDragging = true;
      handle.setPointerCapture(e.pointerId);

      if (element.style.left === '' || element.style.left === '50%') {
         const rect = element.getBoundingClientRect();
         element.style.transform = 'none'; 
         element.style.left = rect.left + 'px';
         element.style.top = rect.top + 'px';
      }

      startX = e.clientX;
      startY = e.clientY;
      initialLeft = element.offsetLeft;
      initialTop = element.offsetTop;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = (initialLeft + dx) + 'px';
      element.style.top = (initialTop + dy) + 'px';
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      handle.releasePointerCapture(e.pointerId);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingFile(true);
      // 上传前清理之前的假进度条
      stopFakeProgress();
      setProgress(0);
      setStatusText('上传视频中...');
      
      try {
        addLog(`开始上传: ${file.name}`, "info");
        // 使用支持进度的上传函数 (真实进度)
        const url = await uploadFileWithProgress(file, apiConfig, (percent) => {
            setProgress(percent);
            setStatusText(`上传视频中 ${percent}%`);
        });
        
        setVideoUrl(url);
        addLog("视频上传成功", "success");
      } catch (error: any) {
        addLog(`上传失败: ${error.message}`, "error");
        setProgress(0);
        setStatusText('上传失败');
      } finally {
        setIsUploadingFile(false);
        e.target.value = '';
      }
    }
  };

  const handleStart = async () => {
    if (!apiConfig.key) return alert("请先配置 API Key");
    if (!videoUrl.trim()) return alert("请提供视频源");

    setIsProcessing(true);
    setResultId(null);
    setLogs([]);
    stopFakeProgress(); // 确保重置
    setProgress(0);
    setStatusText('任务初始化...');
    addLog("开始新任务...");

    try {
      addLog("提交任务中...", "info");
      const taskId = await createCharacterTask({ url: videoUrl, timestamps }, apiConfig);
      addLog(`提交成功，任务ID: ${taskId}`, "success");

      // --- 动态计算预估时间 ---
      let estimatedSeconds = 70; // 默认 3秒内为 70s
      try {
        const [startStr, endStr] = timestamps.split(/[,，]/).map(s => s.trim());
        const start = parseFloat(startStr);
        const end = parseFloat(endStr);
        if (!isNaN(start) && !isNaN(end) && end > start) {
            const duration = end - start;
            // 规则: <=3s -> 70s; >3s 每多1秒+40s (5s -> 150s)
            if (duration > 3) {
                estimatedSeconds = 70 + (duration - 3) * 40;
            }
        }
      } catch (e) {
        console.warn("解析时间戳失败，使用默认时长");
      }
      
      addLog(`预计处理时间: ${Math.round(estimatedSeconds)}秒`, "info");
      
      // 任务提交成功，启动动态假进度条
      startFakeProgress(estimatedSeconds);

      const startTime = Date.now();
      const TIMEOUT_MS = 10 * 60 * 1000; // 放宽到10分钟超时

      const poll = async () => {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000; // 秒

        // 超时检查
        if (now - startTime > TIMEOUT_MS) {
            stopFakeProgress();
            addLog("任务响应超时，请稍后在历史记录中查看", "error");
            setIsProcessing(false);
            setStatusText("任务超时");
            return;
        }

        try {
          const res = await pollTaskResult(taskId, apiConfig);
          
          if (res.code !== 0) {
             if (res.code === -22 && elapsed < 60) {
                 setTimeout(poll, 3000);
                 return;
             }
             throw new Error(res.msg || "Polling error");
          }

          const status = res.data.status;
          // 注意：此处不使用 API 返回的 progress，完全依赖 fakeProgressTimer
          setStatusText(`AI 处理中...`);

          if (status === 'succeeded') {
            stopFakeProgress();
            setProgress(100); // 瞬间补满
            setStatusText('任务完成');
            const charId = res.data.results?.[0]?.character_id;
            if (charId) {
                setResultId(charId);
                addLog(`任务完成! ID已生成`, "success");
            } else {
                addLog("任务完成但未返回ID", "error");
            }
            setIsProcessing(false);
          } else if (status === 'failed') {
            stopFakeProgress();
            setProgress(0);
            setStatusText('任务失败');
            const reason = res.data.failure_reason;
            const errorMsg = ERROR_MAP[reason] || reason || res.data.error || "未知错误";
            addLog(`任务失败: ${errorMsg}`, "error");
            setIsProcessing(false);
          } else {
            // 动态轮询策略
            let nextInterval = 2000;
            if (elapsed < 10) nextInterval = 5000;      // 0-10s: 5s
            else if (elapsed < 45) nextInterval = 3000; // 10-45s: 3s
            else nextInterval = 2000;                   // >45s: 2s

            setTimeout(poll, nextInterval);
          }
        } catch (err: any) {
           addLog(`轮询出错: ${err.message}`, "error");
           setTimeout(poll, 5000); // 出错后慢速重试
        }
      };

      poll();

    } catch (e: any) {
      stopFakeProgress();
      addLog(`错误: ${e.message}`, "error");
      setIsProcessing(false);
      setStatusText("提交错误");
    }
  };

  const copyId = () => {
    if (resultId) {
        navigator.clipboard.writeText(resultId);
        addLog("Character ID 已复制到剪贴板", "success");
    }
  };

  const handleActionClick = () => {
    if (resultId && onAddToLibrary) {
        onAddToLibrary(resultId);
        // Reset State to revert button to "Start Upload"
        setResultId(null);
        setVideoUrl('');
        // Keep logs slightly visible or clear? Clearing to be clean.
        setLogs([]);
        setProgress(0);
        setStatusText('');
        setMode('file');
        setIsUploadingFile(false);
    } else {
        handleStart();
    }
  };

  return (
    <div 
      ref={winRef}
      className={`fixed top-1/2 left-1/2 w-[400px] max-w-[90vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[220] flex flex-col overflow-hidden 
        transition-[opacity,transform] duration-300 ease-out -translate-x-1/2 -translate-y-1/2
        ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
      `}
    >
      {/* Header */}
      <div 
        ref={headerRef}
        className="h-12 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 cursor-move select-none"
      >
        <div className="flex items-center gap-2 text-slate-800 dark:text-white">
          <i className="fa-solid fa-user-astronaut text-blue-500 dark:text-blue-400"></i>
          <span className="font-bold text-sm">Sora 角色创建</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition">
           <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-4">
         
         {/* Inputs */}
         <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-500 dark:text-slate-400">视频源</label>
              <div className="flex gap-2 text-xs">
                <button onClick={() => setMode('file')} className={mode === 'file' ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}>本地</button>
                <button onClick={() => setMode('url')} className={mode === 'url' ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}>链接</button>
              </div>
            </div>

            {mode === 'file' ? (
              <div 
                onClick={() => !isUploadingFile && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 text-center transition-colors relative
                  ${!isUploadingFile ? 'cursor-pointer hover:border-blue-500/50' : 'cursor-default'}
                `}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileUpload} />
                {isUploadingFile ? (
                   <div className="flex flex-col items-center gap-1">
                      <div className="text-blue-500 dark:text-blue-400 text-xs font-bold">{progress}%</div>
                      <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="text-[10px] text-slate-400">上传中，请勿关闭...</div>
                   </div>
                ) : videoUrl ? (
                   <div className="text-xs text-green-600 dark:text-green-400 break-all line-clamp-1"><i className="fa-solid fa-check mr-1"></i> 已上传</div>
                ) : (
                   <div className="text-slate-500 text-xs"><i className="fa-solid fa-cloud-arrow-up text-base mb-1 block"></i> 点击上传视频</div>
                )}
              </div>
            ) : (
              <input 
                 type="text" 
                 value={videoUrl}
                 onChange={e => setVideoUrl(e.target.value)}
                 placeholder="https://example.com/character.mp4"
                 className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
               />
            )}

            <div>
               <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">截取时间 (秒, 例如 0,3)</label>
               <input 
                 type="text" 
                 value={timestamps}
                 onChange={e => setTimestamps(e.target.value)}
                 placeholder="0,3"
                 className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
               />
            </div>
         </div>

         {/* Progress Bar (Global) */}
         <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 dark:text-slate-400 font-bold">{statusText || '等待开始'}</span>
                <span className="text-slate-400">{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${isUploadingFile ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
         </div>

         {/* Logs */}
         <div className="bg-slate-100 dark:bg-black/40 rounded-lg p-3 h-32 overflow-y-auto border border-slate-200 dark:border-white/5 custom-scroll font-mono text-[10px] leading-relaxed">
            {logs.length === 0 && <span className="text-slate-400 dark:text-slate-600">等待任务开始...</span>}
            {logs.map((log, i) => (
                <div key={i} className={`${log.type === 'error' ? 'text-red-500 dark:text-red-400' : log.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    <span className="opacity-50 mr-2">[{log.time}]</span>
                    {log.msg}
                </div>
            ))}
            <div ref={logEndRef} />
         </div>

         {/* Result */}
         {resultId && (
             <div className="bg-green-100 dark:bg-green-900/20 border border-green-500/30 rounded-lg p-3 flex flex-col gap-2 animate-in zoom-in duration-200">
                 <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-bold">
                    <i className="fa-solid fa-check-circle"></i> 角色创建成功
                 </div>
                 <div 
                    onClick={copyId}
                    className="bg-white/50 dark:bg-black/40 border border-green-500/20 rounded p-2 text-xs text-green-700 dark:text-green-300 font-mono break-all cursor-pointer hover:bg-white/80 dark:hover:bg-black/60 transition-colors flex justify-between items-center group"
                    title="点击复制"
                 >
                    {resultId}
                    <i className="fa-regular fa-copy opacity-50 group-hover:opacity-100"></i>
                 </div>
             </div>
         )}

         {/* Action Button */}
         <button 
           onClick={handleActionClick}
           disabled={isProcessing || isUploadingFile}
           className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-[0.98]
             ${isProcessing || isUploadingFile
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' 
                : resultId
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-900/30'
             }
           `}
         >
           {isProcessing ? (
             <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i> 处理中...
             </span>
           ) : resultId ? (
             <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-folder-plus"></i> 加入角色库
             </span>
           ) : (
             <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-rocket"></i> 开始上传
             </span>
           )}
         </button>

      </div>
    </div>
  );
};

export default CharacterCreator;
