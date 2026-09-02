import React, { useState } from 'react';
import { Asset } from '../types';
import { formatMediaUrl } from '../utils/url';

interface AssetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onDeleteAsset: (id: string) => void;
  onAddToCanvas: (url: string, type: 'image' | 'video', id?: string, poster?: string) => void;
  onView: (url: string, type: 'image' | 'video') => void;
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({ 
  isOpen, 
  onClose, 
  assets, 
  onDeleteAsset, 
  onAddToCanvas,
  onView
}) => {
  // Fix: Added missing useState import from 'react'
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const filteredAssets = assets.filter(a => filter === 'all' || a.type === filter);

  const handleDeleteWithConfirm = (id: string) => {
    const Swal = (window as any).Swal;
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: '确定删除吗？',
        text: '该资产将从本地资产库永久移除。',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1e293b'
      }).then((result: any) => {
        if (result.isConfirmed) {
          onDeleteAsset(id);
        }
      });
    } else {
      if (window.confirm("确定要删除该资产吗？")) {
        onDeleteAsset(id);
      }
    }
  };

  return (
    <aside 
      className={`fixed top-1/2 left-[2.5vw] w-[95vw] h-[80vh] 
        bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl 
        z-[150] flex flex-col transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isOpen ? 'translate-x-0 -translate-y-1/2 opacity-100' : 'translate-x-[110vw] -translate-y-1/2 opacity-0'}
        shadow-[0_25px_70px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] 
        overflow-hidden
      `}
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-5 shrink-0 bg-slate-50/80 dark:bg-white/5 backdrop-blur-md rounded-t-3xl">
        <div className="flex items-center gap-3 text-slate-800 dark:text-white">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <i className="fa-solid fa-photo-film text-blue-500 text-base"></i>
          </div>
          <h1 className="font-black tracking-tight text-sm">我的资产库</h1>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/10">
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>

      {/* Tabs Filter */}
      <div className="px-5 pt-4 pb-2 shrink-0">
        <div className="flex p-1.5 gap-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-white/5">
          {(['all', 'image', 'video'] as const).map((t) => (
            <button 
              key={t}
              onClick={() => setFilter(t)} 
              className={`flex-1 py-1.5 rounded-xl font-black text-[10px] transition-all uppercase tracking-wider ${filter === t ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              {t === 'all' ? '全部' : t === 'image' ? '图片' : '视频'}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-10 custom-scroll">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-700 select-none">
            <div className="w-20 h-20 rounded-full border-4 border-dashed border-current flex items-center justify-center mb-4 opacity-20">
              <i className="fa-regular fa-folder-open text-3xl"></i>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-40">资产库空空如也</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredAssets.map((asset) => {
              const mediaUrl = asset.cloudUrl || formatMediaUrl(asset.url);
              const posterUrl = asset.poster ? formatMediaUrl(asset.poster) : '';
              
              return (
                <div 
                  key={asset.id} 
                  className="group relative aspect-[16/9] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-50 dark:bg-slate-800/50 hover:shadow-xl transition-all duration-300 cursor-zoom-in"
                  onClick={() => onView(mediaUrl, asset.type)}
                >
                  {/* 媒体内容容器 */}
                  <div className="w-full h-full">
                    {asset.type === 'image' ? (
                      <img src={mediaUrl} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full relative">
                        <div 
                          style={{ 
                            backgroundImage: `url(${posterUrl || mediaUrl + '#t=0.1'}), url(https://gallery-image.spbst.cn/webp/1996842084186718208/bbc94cff-35d9-499e-9b9c-dced72a044f6)`,
                            backgroundSize: 'cover', backgroundPosition: 'center'
                          }}
                          className="absolute inset-0"
                        />
                        <div className="absolute inset-0 bg-black/5 flex items-center justify-center transition-colors group-hover:bg-black/20" />
                      </div>
                    )}
                  </div>
                  
                  {/* 悬浮控制面板 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 gap-2">
                     <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => onAddToCanvas(asset.url, asset.type, undefined, asset.poster)}
                          className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
                        >
                          <i className="fa-solid fa-plus text-[9px]"></i>
                          添加到画布
                        </button>
                     </div>
                     
                     <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteWithConfirm(asset.id); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 hover:bg-red-600 text-white rounded-lg flex items-center justify-center text-[10px] transition-colors shadow-lg shadow-red-500/10"
                      title="从我的资产移除"
                     >
                       <i className="fa-solid fa-trash-can"></i>
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export default AssetLibrary;