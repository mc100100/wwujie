
import React from 'react';
import { AssetEntity } from './DirectorAssetStep';
import { formatMediaUrl } from '../utils/url';

interface DirectorAssetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  assets: AssetEntity[];
  selectedAssetIds: string[];
  onToggle: (assetId: string) => void;
}

const DirectorAssetSelector: React.FC<DirectorAssetSelectorProps> = ({
  isOpen, onClose, assets, selectedAssetIds, onToggle
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-[330px] aspect-[3/4] rounded-2xl flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-14 px-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-white/5">
           <h3 className="font-bold text-slate-800 dark:text-white">添加关联资产</h3>
           <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition">
             <i className="fa-solid fa-xmark text-lg"></i>
           </button>
        </div>
        <div className="p-4 overflow-y-auto custom-scroll">
           <div className="grid grid-cols-3 gap-2">
              {assets.map(asset => {
                 const isSelected = selectedAssetIds.includes(asset.id);
                 return (
                    <div 
                      key={asset.id} 
                      className={`relative flex flex-col items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer group
                        ${isSelected 
                           ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500/50' 
                           : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/30'
                        }
                      `}
                      onClick={() => onToggle(asset.id)}
                    >
                       <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 relative border border-slate-100 dark:border-white/5 shrink-0">
                          {asset.resultUrl ? (
                             <img src={formatMediaUrl(asset.resultUrl)} className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <i className={`fa-solid ${asset.type === 'character' ? 'fa-user' : asset.type === 'scene' ? 'fa-image' : 'fa-cube'}`}></i>
                             </div>
                          )}
                          
                          {/* Selection Indicator Overlay */}
                          {isSelected && (
                             <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-sm">
                                   <i className="fa-solid fa-check text-xs"></i>
                                </div>
                             </div>
                          )}
                       </div>
                       
                       <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {asset.name}
                       </span>

                       {/* Hover Add Icon (if not selected) */}
                       {!isSelected && (
                          <div className="absolute top-1 right-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                             <i className="fa-solid fa-circle-plus text-base bg-white dark:bg-slate-800 rounded-full"></i>
                          </div>
                       )}
                    </div>
                 );
              })}
           </div>
           {assets.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">暂无可用资产</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default DirectorAssetSelector;
