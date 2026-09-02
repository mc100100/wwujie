
import React, { useState, useRef, useEffect } from 'react';
import { Episode } from '../types';

interface DirectorEpisodeSelectorProps {
  episodes: Episode[];
  activeEpisodeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

const DirectorEpisodeSelector: React.FC<DirectorEpisodeSelectorProps> = ({
  episodes,
  activeEpisodeId,
  onSwitch,
  onAdd,
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeEpisode = episodes.find(e => e.id === activeEpisodeId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Prevent deleting the last episode
    if (episodes.length <= 1) {
       return;
    }
    const Swal = (window as any).Swal;
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '删除此剧集?',
            text: "删除后无法恢复",
            icon: 'warning',
            width: 360, // Adjusted: ~25% smaller than default (360px)
            padding: '1em',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            target: document.body,
            customClass: {
               container: 'z-[9999]',
               popup: 'rounded-2xl',
               title: 'text-sm font-bold', // Smaller title
               htmlContainer: 'text-xs', // Smaller text
               actions: 'mt-2 gap-2',
               confirmButton: 'text-xs py-1.5 px-3 rounded-lg',
               cancelButton: 'text-xs py-1.5 px-3 rounded-lg'
            }
        }).then((result: any) => {
            if (result.isConfirmed) {
                onDelete(id);
                if (activeEpisodeId === id) setIsOpen(false); // Close if deleting current
            }
        });
    } else {
        if (confirm("删除后无法恢复，确定吗？")) {
            onDelete(id);
        }
    }
  };

  return (
    <div className="relative z-[100]" ref={containerRef}>
      {/* Trigger Button - Size Optimized (Smaller) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all active:scale-95
          ${isOpen 
            ? 'bg-slate-200 dark:bg-white/20 border-slate-300 dark:border-white/20' 
            : 'bg-white/80 dark:bg-black/40 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
          }
        `}
      >
        <i className="fa-solid fa-layer-group text-rose-500 text-[10px]"></i>
        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 min-w-[2.5em] text-left leading-none pt-0.5">
          {activeEpisode?.name || '剧集'}
        </span>
        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {/* Dropdown Menu - Size Optimized */}
      <div 
        className={`
          absolute top-full left-0 mt-1.5 w-36 bg-white dark:bg-[#1e293b] rounded-xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden transform origin-top-left transition-all duration-200
          ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
        `}
      >
        <div className="max-h-[200px] overflow-y-auto custom-scroll py-1">
          {episodes.map(ep => (
            <div 
              key={ep.id}
              onClick={() => { onSwitch(ep.id); setIsOpen(false); }}
              className={`
                group flex items-center justify-between px-3 py-2 cursor-pointer text-[10px] transition-colors
                ${ep.id === activeEpisodeId 
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }
              `}
            >
              <span>{ep.name}</span>
              {episodes.length > 1 && (
                <button 
                  onClick={(e) => handleDelete(e, ep.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5"
                  title="删除"
                >
                  <i className="fa-solid fa-trash-can text-[9px]"></i>
                </button>
              )}
            </div>
          ))}
        </div>
        
        <div className="border-t border-slate-100 dark:border-white/5 p-1">
          <button 
            onClick={() => { onAdd(); setIsOpen(false); }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-plus text-[9px]"></i> 新建剧集
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectorEpisodeSelector;
