
import React, { useEffect, useRef } from 'react';
import { formatMediaUrl } from '../utils/url';
import { toast } from '../utils/toast';

export interface AssetEntity {
  id: string;
  name: string;
  description: string;
  type: 'character' | 'scene' | 'item';
  resultUrl?: string;
  status: 'idle' | 'generating' | 'success' | 'failed';
  soraCharacterId?: string; // 新增：绑定的 Sora 角色 ID
}

interface AssetStepProps {
  assetBank: AssetEntity[];
  stylePreset: string;
  styleReferenceUrl?: string;
  onBatchGenerate: () => void;
  onGenerateOne: (id: string) => void;
  onUpload: (id: string) => void;
  onBindCharacter?: (id: string) => void; // 新增绑定回调
  onUploadStyleRef: () => void;
  onClearStyleRef: () => void;
  onStartEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  editingItemId: string | null;
  editContent: string;
  setEditContent: (val: string) => void;
  onNextStep: () => void;
  onPreview: (url: string) => void;
  onClearImage?: (id: string) => void;
}

const AssetStep: React.FC<AssetStepProps> = ({
  assetBank,
  stylePreset,
  styleReferenceUrl,
  onBatchGenerate,
  onGenerateOne,
  onUpload,
  onBindCharacter,
  onUploadStyleRef,
  onClearStyleRef,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  editingItemId,
  editContent,
  setEditContent,
  onNextStep,
  onPreview,
  onClearImage
}) => {
  const editContainerRef = useRef<HTMLDivElement>(null);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const isCustomStyle = !stylePreset || stylePreset === '';
  
  const getStyleName = () => {
      if (isCustomStyle) return "自定义";
      let name = stylePreset.split(',')[0].split('(')[0].split('（')[0].trim();
      return name.length > 4 ? name.substring(0, 4) : name;
  };

  const styleDisplayName = getStyleName();

  return (
    <div className="flex flex-col h-full gap-4 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
            <h3 className="text-base md:text-xl font-black text-slate-800 dark:text-white">资产管理</h3>
            
            <div className="flex items-center gap-2 transition-all">
                {isCustomStyle ? (
                    <div className="flex items-center gap-1.5">
                        <span 
                            onClick={onUploadStyleRef}
                            className="text-[11px] md:text-sm font-black text-rose-500 cursor-pointer hover:opacity-80 active:scale-95 transition-all select-none"
                        >
                            参考图模式
                        </span>
                        {styleReferenceUrl && (
                            <div className="relative w-5 h-5 rounded-sm overflow-hidden group border border-rose-500/20 shadow-sm">
                                <img src={formatMediaUrl(styleReferenceUrl)} className="w-full h-full object-cover" alt="ref" />
                                <div 
                                    onClick={(e) => { e.stopPropagation(); onClearStyleRef(); }}
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                >
                                    <i className="fa-solid fa-xmark text-white text-[7px]"></i>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] md:text-sm font-bold text-slate-400 dark:text-slate-500 select-none">
                            风格：<span className="text-rose-500 font-black">{styleDisplayName}</span>
                        </span>
                        {styleReferenceUrl && (
                            <div className="relative w-5 h-5 rounded-sm overflow-hidden group border border-rose-500/20 shadow-sm">
                                <img src={formatMediaUrl(styleReferenceUrl)} className="w-full h-full object-cover" alt="ref" />
                                <div 
                                    onClick={(e) => { e.stopPropagation(); onClearStyleRef(); }}
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                >
                                    <i className="fa-solid fa-xmark text-white text-[7px]"></i>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        
        <div className="flex gap-2 md:gap-3">
          <button onClick={onBatchGenerate} className="px-3 md:px-5 py-2 md:py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-xl font-black text-[10px] md:text-xs transition-all active:scale-95">批量生成</button>
          <button onClick={onNextStep} className="px-4 md:px-8 py-2 md:py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] md:text-xs shadow-lg shadow-rose-600/20 transition-all active:scale-95">下一步</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll pr-2 md:pr-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {assetBank.map(asset => (
          <div key={asset.id} className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-white/5 shadow-md flex gap-4 h-36 relative">
            <div 
              className="h-full aspect-video bg-slate-100 dark:bg-black/40 rounded-xl overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity relative group/img"
              onClick={() => asset.resultUrl && onPreview(asset.resultUrl)}
            >
              {asset.resultUrl ? <img src={formatMediaUrl(asset.resultUrl)} className="w-full h-full object-cover" alt={asset.name} /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">{asset.status === 'generating' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-id-card text-2xl md:text-3xl"></i>}<p className="text-[8px] mt-1 font-bold">待预设</p></div>}
              
              {/* 删除按钮 */}
              {asset.resultUrl && onClearImage && (
                  <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          onClearImage(asset.id);
                      }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors z-20 backdrop-blur-sm opacity-0 group-hover/img:opacity-100"
                      title="移除图片"
                  >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                  </button>
              )}

              {/* Sora ID 绑定标识 */}
              {asset.soraCharacterId && (
                  <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/10 pointer-events-none">
                      <i className="fa-solid fa-link text-emerald-400"></i>
                      <span className="font-mono">{asset.soraCharacterId.slice(0, 4)}...</span>
                  </div>
              )}
            </div>
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">{asset.type}</span>
                  <h4 className="font-black text-sm text-slate-800 dark:text-white truncate" title={asset.name}>{asset.name}</h4>
                </div>
                <button onClick={() => handleCopy(asset.description)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors" title="复制提示词"><i className="fa-solid fa-copy text-[10px]"></i></button>
              </div>
              <div className="flex-1 overflow-hidden relative">
                {editingItemId === asset.id ? (
                  <div ref={editContainerRef} className="absolute inset-0 z-10">
                    <textarea 
                      value={editContent} 
                      onChange={(e) => setEditContent(e.target.value)} 
                      className="w-full h-full bg-slate-50 dark:bg-slate-900 border border-blue-500 rounded p-1 text-[10px] text-slate-800 dark:text-slate-200 outline-none resize-none" 
                      autoFocus 
                    />
                  </div>
                ) : (
                  <p 
                    onClick={() => onStartEdit(asset.id, asset.description)} 
                    className="text-[10px] text-slate-500 leading-relaxed line-clamp-3 cursor-text hover:bg-slate-50 dark:hover:bg-white/5 rounded transition-colors"
                  >
                    {asset.description}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-auto">
                {asset.type === 'character' && onBindCharacter && (
                    <button 
                        onClick={() => onBindCharacter(asset.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 border border-transparent
                            ${asset.soraCharacterId 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600'
                            }
                        `}
                        title="绑定 Sora 角色库"
                    >
                        <i className="fa-solid fa-link text-[9px]"></i>
                        {asset.soraCharacterId ? '已绑定' : '绑定'}
                    </button>
                )}
                
                <button onClick={() => onUpload(asset.id)} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold transition-all active:scale-95">上传</button>
                <button 
                  onClick={() => onGenerateOne(asset.id)} 
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 ${asset.status === 'generating' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}
                >
                  {asset.status === 'generating' && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  {asset.status === 'generating' ? '再次生成' : '生成'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetStep;
