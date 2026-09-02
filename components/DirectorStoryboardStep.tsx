
import React, { useEffect, useRef, useState } from 'react';
import { formatMediaUrl } from '../utils/url';
import { AssetEntity } from './DirectorAssetStep';
import { toast } from '../utils/toast';
import WorkbenchStitchModal from './WorkbenchStitchModal';

export interface Shot {
  id: string;
  duration: string;
  shotType: string;
  movement: string;
  description: string;
  videoPrompt?: string;
  voiceover: string;
  involvedAssetIds: string[];
  status: 'idle' | 'generating' | 'success' | 'failed';
  videoStatus: 'idle' | 'generating' | 'success' | 'failed';
  resultUrl?: string;
  videoUrl?: string;
  videoHistory?: string[];
  selected: boolean;
}

interface StoryboardStepProps {
  shots: Shot[];
  assetBank: AssetEntity[];
  onBatchGenerate: () => void;
  onGenerateOne: (id: string) => void;
  onUpload: (id: string) => void;
  onStartEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  editingItemId: string | null;
  editContent: string;
  setEditContent: (val: string) => void;
  onAddAsset: (id: string) => void;
  onToggleAssetLink: (shotId: string, assetId: string) => void;
  onNextStep: () => void;
  onPreview: (url: string) => void;
  onStitchUpload?: (shotId: string, blob: Blob) => Promise<void>;
  onClearImage?: (id: string) => void;
}

const StoryboardStep: React.FC<StoryboardStepProps> = ({
  shots,
  assetBank,
  onBatchGenerate,
  onGenerateOne,
  onUpload,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  editingItemId,
  editContent,
  setEditContent,
  onAddAsset,
  onToggleAssetLink,
  onNextStep,
  onPreview,
  onStitchUpload,
  onClearImage
}) => {
  const editContainerRef = useRef<HTMLDivElement>(null);
  
  // 状态：当前正在进行拼图的 Shot ID
  const [activeStitchShotId, setActiveStitchShotId] = useState<string | null>(null);
  // 状态：全局拼图模式（旧功能）
  const [isGlobalStitchOpen, setIsGlobalStitchOpen] = useState(false);

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

  // 获取全局分镜结果（旧功能）
  const getGlobalStitchItems = () => {
      return shots
        .filter(s => s.status === 'success' && s.resultUrl)
        .map((s, i) => ({
            id: s.id,
            url: s.resultUrl!,
            name: `Shot ${i + 1}`
        }));
  };

  // 获取单个分镜的关联资产（新功能）
  const getAssetStitchItems = (shotId: string) => {
      const shot = shots.find(s => s.id === shotId);
      if (!shot) return [];
      
      return shot.involvedAssetIds
          .map(assetId => {
              const asset = assetBank.find(a => a.id === assetId);
              // 只包含有生成结果或已上传的资产
              if (asset && asset.resultUrl) {
                  // 应用命名规则
                  let displayName = asset.name;
                  if (asset.type === 'character') {
                      displayName = `${asset.name}  人物参考`;
                  } else if (asset.type === 'scene') {
                      displayName = `${asset.name}  场景参考`;
                  }
                  // 道具 (item) 保持原名

                  return {
                      id: asset.id,
                      url: asset.resultUrl,
                      name: displayName
                  };
              }
              return null;
          })
          .filter((item): item is { id: string, url: string, name: string } => item !== null);
  };

  const handleOpenAssetStitch = (shot: Shot) => {
      const items = getAssetStitchItems(shot.id);
      if (items.length === 0) {
          toast.warning('该分镜没有已生成的关联资产，无法拼图');
          return;
      }
      setActiveStitchShotId(shot.id);
  };

  return (
    <>
    <div className="flex flex-col h-full gap-4 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-xl font-black text-slate-800 dark:text-white">分镜生成</h3>
        <div className="flex gap-3">
          {/* 全局导出按钮已移除 */}
          <button onClick={onBatchGenerate} className="px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] md:text-xs transition-all active:scale-95">批量融图</button>
          <button onClick={onNextStep} className="px-6 py-2 bg-rose-600 text-white rounded-xl font-black text-[10px] md:text-xs shadow-lg transition-all active:scale-95">下一步</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scroll pr-2 md:pr-4 space-y-4">
        {shots.map((shot, idx) => (
          <div key={shot.id} className="flex flex-col gap-4 p-4 md:p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-white/5 shadow-lg group">
            <div 
              className="w-[85%] aspect-video bg-slate-100 dark:bg-black/40 rounded-2xl overflow-hidden relative mx-auto border border-slate-200 dark:border-white/5 cursor-zoom-in hover:opacity-95 transition-opacity group/img"
              onClick={() => shot.resultUrl && onPreview(shot.resultUrl)}
            >
              {shot.resultUrl ? <img src={formatMediaUrl(shot.resultUrl)} className="w-full h-full object-cover" alt={`Shot ${idx+1}`} /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">{shot.status === 'generating' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-image text-3xl"></i>}</div>}
              
              {/* 删除按钮 */}
              {shot.resultUrl && onClearImage && (
                  <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          onClearImage(shot.id);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors z-20 backdrop-blur-sm opacity-0 group-hover/img:opacity-100"
                      title="移除参考图"
                  >
                      <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
              )}
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-black/20 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
                <span>#{idx+1} 关联资产</span>
                <button onClick={() => onAddAsset(shot.id)} className="text-rose-500 hover:text-rose-600 transition-colors">+ 添加资产</button>
              </div>
              <div className="flex gap-2 flex-wrap mb-4">
                {shot.involvedAssetIds.map(id => {
                  const asset = assetBank.find(a => a.id === id);
                  return asset ? (
                    <div key={id} className="flex items-center gap-2 bg-white dark:bg-slate-700 p-1 pr-2 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                      <div 
                        className="w-6 h-6 rounded-full overflow-hidden shrink-0 cursor-zoom-in"
                        onClick={() => asset.resultUrl && onPreview(asset.resultUrl)}
                      >
                        {asset.resultUrl ? <img src={formatMediaUrl(asset.resultUrl)} className="w-full h-full object-cover" alt={asset.name} /> : <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[8px]"><i className="fa-solid fa-user"></i></div>}
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200 truncate max-w-[80px]">{asset.name}</span>
                      <button onClick={() => onToggleAssetLink(shot.id, id)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-white/5 flex flex-col gap-3">
                <div className="min-h-[40px]">
                  {editingItemId === shot.id ? (
                    <div ref={editContainerRef} className="w-full">
                      <textarea 
                        value={editContent} 
                        onChange={(e) => setEditContent(e.target.value)} 
                        className="w-full bg-white dark:bg-slate-900 border border-blue-500 rounded-lg p-2 text-[11px] text-slate-800 dark:text-slate-200 outline-none h-24 shadow-inner" 
                        autoFocus 
                      />
                    </div>
                  ) : (
                    <p 
                      onClick={() => onStartEdit(shot.id, shot.description)}
                      className="text-[11px] text-slate-500 italic leading-relaxed cursor-text hover:bg-slate-100/50 dark:hover:bg-white/5 rounded p-1 transition-colors"
                    >
                      <span className="font-black text-slate-400 mr-2 uppercase not-italic">IMG Prompt:</span>{shot.description}
                    </p>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-1">
                  {/* 拼图按钮 */}
                  <button
                    onClick={() => handleOpenAssetStitch(shot)}
                    className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"
                    title="将关联资产组合成参考图"
                  >
                    拼图
                  </button>

                  <button 
                    onClick={() => onUpload(shot.id)} 
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold transition-all active:scale-95"
                  >
                    上传
                  </button>
                  <button 
                    onClick={() => onGenerateOne(shot.id)} 
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 ${shot.status === 'generating' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}
                  >
                    {shot.status === 'generating' && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                    {shot.status === 'generating' ? '再次生成' : '生成'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    
    {/* 全局结果拼图 */}
    <WorkbenchStitchModal 
      isOpen={isGlobalStitchOpen}
      onClose={() => setIsGlobalStitchOpen(false)}
      items={getGlobalStitchItems()}
      title="分镜长图导出"
    />

    {/* 单分镜资产拼图 */}
    <WorkbenchStitchModal 
      isOpen={!!activeStitchShotId}
      onClose={() => setActiveStitchShotId(null)}
      items={activeStitchShotId ? getAssetStitchItems(activeStitchShotId) : []}
      title="资产组合画布"
      onUpload={onStitchUpload && activeStitchShotId ? async (blob) => {
          await onStitchUpload(activeStitchShotId, blob);
          setActiveStitchShotId(null);
      } : undefined}
    />
    </>
  );
};

export default StoryboardStep;
