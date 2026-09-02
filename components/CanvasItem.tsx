
import React, { memo, useRef, useEffect } from 'react';
import { CanvasElement, ElementType } from '../types';
import { formatMediaUrl } from '../utils/url';
import { toast } from '../utils/toast';

interface CanvasItemProps {
  item: CanvasElement;
  isSelected: boolean;
  isEditing?: boolean;
  isSimpleView?: boolean; // LOD Mode
  onContentChange?: (id: string, content: string) => void;
  onScriptsChange?: (id: string, scripts: string[]) => void;
  onSizeChange?: (id: string, width: number, height: number) => void;
  onEditEnd?: () => void;
  onDelete?: (id: string) => void;
  // 批量模式 props
  isBatchMode?: boolean;
  isBatchSelected?: boolean;
  onBatchToggle?: () => void;
}

const CanvasItem: React.FC<CanvasItemProps> = ({ 
  item, isSelected, isEditing = false, isSimpleView = false, 
  onContentChange, onScriptsChange, onSizeChange, onEditEnd, onDelete,
  isBatchMode, isBatchSelected, onBatchToggle 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
    }
  }, [isEditing]);

  const handleTextBlur = () => {
    if (onEditEnd) onEditEnd();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onContentChange) onContentChange(item.id, e.target.value);
  };
  
  const handleScriptItemChange = (index: number, val: string) => {
      if (item.scripts && onScriptsChange) {
          const newScripts = [...item.scripts];
          newScripts[index] = val;
          onScriptsChange(item.id, newScripts);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isEditing) {
       e.stopPropagation();
       if (e.key === 'Escape') {
         e.preventDefault();
         textRef.current?.blur();
       } 
    }
  };

  // 批量模式下禁止文本编辑交互
  const isTextLocked = item.locked && item.type === ElementType.TEXT;
  const canInteractWithText = (isEditing || isTextLocked) && !isBatchMode;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${item.x}px`,
    top: `${item.y}px`,
    width: `${item.width}px`,
    height: `${item.height}px`,
    transform: 'translate3d(-50%, -50%, 0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    cursor: isBatchMode ? 'pointer' : (canInteractWithText ? (isEditing ? 'text' : 'default') : (item.locked ? 'default' : 'grab')),
    touchAction: (item.type === ElementType.TEXT && isEditing && !isBatchMode) ? 'pan-y' : 'none',
    willChange: isSelected ? 'transform' : 'auto', 
    zIndex: isSelected || isBatchSelected ? 10 : 1, // 选中时提高层级
    contain: 'layout style paint', 
  };

  // 批量模式下的样式调整
  let borderClass = '';
  if (isBatchMode) {
     if (isBatchSelected) {
       borderClass = 'ring-4 ring-green-500 scale-[1.02] shadow-xl';
     } else {
       borderClass = 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-white/20 opacity-90';
     }
  } else {
    borderClass = isSelected 
      ? `scale-[1.01] ring-2 ${isEditing ? 'ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'ring-blue-500 shadow-2xl'}` 
      : 'hover:ring-1 hover:ring-slate-400 dark:hover:ring-white/30 shadow-md';
  }
  
  if (item.type === ElementType.SCRIPT_BOARD) {
     borderClass += ' border border-rose-200 dark:border-rose-900/30';
  }

  const dynamicFontSize = Math.max(12, item.width / 22);

  const textAreaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    resize: 'none',
    background: 'transparent', 
    border: 'none',
    outline: 'none',
    fontSize: `${dynamicFontSize}px`, 
    lineHeight: 1.65,
    textAlign: 'left', 
    overflow: 'auto',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    padding: '16px',
    paddingTop: '40px', 
    cursor: isEditing ? 'text' : 'inherit',
    pointerEvents: isEditing ? 'auto' : 'none',
    boxSizing: 'border-box'
  };

  const mediaUrl = formatMediaUrl(item.src);
  const posterUrl = item.poster ? formatMediaUrl(item.poster) : '';

  // LOD Optimization: Render simplified block
  if (isSimpleView) {
    let bgColor = '';
    let borderColor = '';
    let iconClass = '';
    let iconColor = '';

    if (item.type === ElementType.IMAGE) {
        bgColor = 'bg-yellow-100/90 dark:bg-yellow-900/60';
        borderColor = 'border-yellow-300 dark:border-yellow-700/50';
        iconClass = 'fa-image';
        iconColor = 'text-yellow-600 dark:text-yellow-400';
    } else if (item.type === ElementType.VIDEO) {
        bgColor = 'bg-red-100/90 dark:bg-red-900/60';
        borderColor = 'border-red-300 dark:border-red-700/50';
        iconClass = 'fa-film';
        iconColor = 'text-red-600 dark:text-red-400';
    } else if (item.type === ElementType.SCRIPT_BOARD) {
        bgColor = 'bg-rose-100/90 dark:bg-rose-900/60';
        borderColor = 'border-rose-300 dark:border-rose-700/50';
        iconClass = 'fa-clapperboard';
        iconColor = 'text-rose-600 dark:text-rose-400';
    } else {
        bgColor = 'bg-blue-100/90 dark:bg-blue-900/60';
        borderColor = 'border-blue-300 dark:border-blue-700/50';
        iconClass = 'fa-font';
        iconColor = 'text-blue-600 dark:text-blue-400';
    }

    return (
        <div 
           data-id={item.id}
           style={style}
           className={`group rounded-lg overflow-hidden transition-all duration-200 ${borderClass} ${bgColor} border ${borderColor} flex items-center justify-center relative`}
        >
            <i className={`fa-solid ${iconClass} text-[4em] ${iconColor} opacity-50`}></i>
            {/* 批量模式选中状态简略图也显示，并添加点击事件 */}
            {isBatchMode && (
              <div 
                className="absolute inset-0 z-30 bg-transparent cursor-pointer flex items-center justify-center"
                onClick={(e) => {
                   e.stopPropagation();
                   onBatchToggle?.();
                }}
              >
                 {isBatchSelected && (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shadow-md">
                        <i className="fa-solid fa-check"></i>
                    </div>
                 )}
              </div>
            )}
        </div>
    );
  }

  // Normal Render
  return (
    <div 
      data-id={item.id}
      style={style} 
      className={`group rounded-xl overflow-hidden transition-all duration-300 ${borderClass} ${item.type === ElementType.VIDEO ? 'bg-slate-200 dark:bg-slate-800' : ''} ${item.type === ElementType.SCRIPT_BOARD ? 'bg-slate-200/50 dark:bg-black/20 backdrop-blur-sm' : ''} relative`}
    >
      {item.type === ElementType.IMAGE && (
        <img 
          src={mediaUrl} 
          alt="canvas-item" 
          loading="lazy"
          className="w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
        />
      )}
      
      {item.type === ElementType.VIDEO && (
        isSelected && !isBatchMode ? (
          <video 
            ref={videoRef}
            src={mediaUrl} 
            controls
            autoPlay
            loop
            playsInline
            crossOrigin="anonymous"
            preload="auto"
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative pointer-events-none video-placeholder">
             <div 
               style={{ 
                 backgroundImage: `url(${posterUrl || mediaUrl + '#t=0.1'}), url(https://gallery-image.spbst.cn/webp/1996842084186718208/bbc94cff-35d9-499e-9b9c-dced72a044f6)`, 
                 backgroundSize: 'cover',
                 backgroundPosition: 'center'
               }}
               className="absolute inset-0 w-full h-full"
             />
             
             <div className="relative z-10 w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-white border border-white/40 group-hover:scale-110 group-hover:bg-white/40 transition-all">
                <i className="fa-solid fa-play ml-1"></i>
             </div>
             <div className="absolute bottom-3 z-10 text-[9px] text-white font-mono uppercase tracking-[0.2em] select-none bg-black/40 px-2 py-1 rounded border border-white/10">
                Video Preview
             </div>
          </div>
        )
      )}

      {item.type === ElementType.TEXT && (
        <div className={`w-full h-full relative border flex flex-col overflow-hidden pointer-events-none transition-colors duration-300
          ${isEditing ? 'bg-white dark:bg-slate-950/90 border-purple-500/50' : 'bg-[#fcfcfc] dark:bg-slate-900 border-slate-300 dark:border-white/10'}
        `}>
            {/* 装饰侧边条 */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 z-30
              ${isEditing ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-700'}
            `} />

            {/* 精致的顶部标题栏 */}
            <div className={`absolute top-0 left-0 right-0 h-9 flex items-center justify-between px-4 z-20 select-none pointer-events-none
              ${isEditing ? 'bg-purple-500/10' : 'bg-slate-100/50 dark:bg-white/5'}
            `}>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest
                      ${isEditing ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}
                    `}>
                        {isEditing ? <i className="fa-solid fa-pen-nib mr-1 animate-pulse"></i> : <i className="fa-solid fa-scroll mr-1 opacity-50"></i>}
                        {isEditing ? 'Editing Scene' : 'Storyboard Script'}
                    </span>
                    {item.locked && <i className="fa-solid fa-lock text-[8px] text-slate-400 opacity-60"></i>}
                </div>
                <div className="flex gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
            </div>

            <div className="flex-1 w-full relative">
                {isEditing && !isBatchMode ? (
                  <textarea
                      ref={textRef}
                      value={item.content || ''}
                      onChange={handleTextChange}
                      onBlur={handleTextBlur}
                      onKeyDown={handleKeyDown}
                      style={{ ...textAreaStyle, pointerEvents: 'auto' }}
                      className="w-full h-full text-slate-800 dark:text-slate-100 custom-scroll caret-purple-500"
                      placeholder="在这里输入漫剧剧本内容..."
                  />
                ) : (
                  <div 
                    style={textAreaStyle}
                    className="w-full h-full text-slate-700 dark:text-slate-300 custom-scroll whitespace-pre-wrap break-words italic font-light"
                  >
                    {item.content || <span className="opacity-30">暂无内容</span>}
                  </div>
                )}
            </div>

            {/* 底部装饰：模拟纸张计数 */}
            <div className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-300 dark:text-slate-700 select-none pointer-events-none uppercase">
                Scene_{item.id.slice(0, 4)}
            </div>
        </div>
      )}
      
      {item.type === ElementType.SCRIPT_BOARD && item.scripts && (
         <div className="w-full h-full relative flex flex-col p-4">
             {/* Header with Batch Generate Button */}
             <div className="h-10 flex items-center justify-between mb-4 bg-white/50 dark:bg-black/40 rounded-lg px-3 border border-slate-200 dark:border-white/5 no-drag pointer-events-auto">
                 <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <i className="fa-solid fa-layer-group text-rose-500"></i>
                    <span>分镜组 ({item.scripts.length})</span>
                 </div>
                 <button 
                   onClick={() => toast.info('功能开发中 (Batch Generate TBD)')}
                   className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded shadow-lg shadow-rose-500/20 transition-all active:scale-95"
                 >
                    批量生成
                 </button>
             </div>

             {/* Grid of Text Areas */}
             <div className="flex-1 overflow-y-auto custom-scroll grid grid-cols-5 gap-3 pb-2 no-drag pointer-events-auto">
                 {item.scripts.map((script, index) => (
                    <div key={index} className="relative aspect-[3/4] bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden group/card hover:ring-2 hover:ring-rose-500/30 transition-all">
                        <div className="absolute top-0 left-0 right-0 h-6 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-2">
                             <span className="text-[9px] font-bold text-slate-400">SHOT {index + 1}</span>
                        </div>
                        <textarea
                            value={script}
                            onChange={(e) => handleScriptItemChange(index, e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()} 
                            className="w-full h-full pt-8 p-2 text-[10px] bg-transparent border-none outline-none resize-none text-slate-700 dark:text-slate-300 custom-scroll font-mono leading-relaxed"
                        />
                    </div>
                 ))}
             </div>
         </div>
      )}
      
      {/* 覆盖层：处理拖拽和批量点击 */}
      {!isEditing && item.type !== ElementType.SCRIPT_BOARD && (
        <div className="absolute inset-0 bg-transparent z-20 cursor-grab active:cursor-grabbing" />
      )}
      {/* For Script Board, we need the background to be draggable but not the inputs */}
      {item.type === ElementType.SCRIPT_BOARD && (
        <div className="absolute inset-0 bg-transparent z-[-1] cursor-grab active:cursor-grabbing" />
      )}

      {/* 批量模式的选中遮罩：全覆盖，添加 onClick 事件处理 */}
      {isBatchMode && (
         <div 
             className="absolute inset-0 z-30 bg-transparent cursor-pointer"
             onClick={(e) => {
                // 阻止事件冒泡，防止触发画布背景点击
                e.stopPropagation();
                onBatchToggle?.();
             }}
         >
             {/* 选中时的对勾 */}
             {isBatchSelected && (
                 <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200 border border-white/20">
                     <i className="fa-solid fa-check text-white text-xs"></i>
                 </div>
             )}
             {/* 未选中时的空圈 (增加视觉提示) */}
             {!isBatchSelected && (
                 <div className="absolute top-2 right-2 w-6 h-6 bg-black/20 dark:bg-white/20 rounded-full border-2 border-white/50 dark:border-white/30 hover:bg-black/40 transition-colors"></div>
             )}
         </div>
      )}
    </div>
  );
};

export default memo(CanvasItem);
