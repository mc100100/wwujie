
import React, { useEffect, useRef } from 'react';
import { ElementType, MenuAction } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  itemType: ElementType;
  isLocked?: boolean;
  onClose: () => void;
  onAction: (action: MenuAction) => void;
  variant?: 'default' | 'fusion'; // 新增变体属性
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, itemType, isLocked = false, onClose, onAction, variant = 'default' }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    left: x,
    top: y,
  };
  if (x > window.innerWidth - 200) style.left = x - 180;
  if (y > window.innerHeight - 300) style.top = y - 250;

  // 融合菜单模式
  if (variant === 'fusion') {
      return (
        <div
          ref={menuRef}
          className="fixed z-50 w-44 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] border border-slate-200 dark:border-white/10 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={style}
        >
           <div className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-white/5 mb-1">
              图文操作
           </div>
           <MenuItem icon="fa-paintbrush" label="参考生图" color="text-purple-600 dark:text-purple-400" onClick={() => onAction('FUSION_REF_IMAGE')} />
           <MenuItem icon="fa-film" label="参考生视频" color="text-emerald-600 dark:text-emerald-400" onClick={() => onAction('FUSION_REF_VIDEO')} />
        </div>
      );
  }

  // 默认菜单模式
  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] border border-slate-200 dark:border-white/10 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={style}
    >
      {/* 存入资产库功能已隐藏 */}

      {itemType === ElementType.IMAGE && (
        <>
          <MenuItem icon="fa-paintbrush" label="参考生图" color="text-purple-600 dark:text-purple-400" onClick={() => onAction('REF_IMAGE')} />
          <MenuItem icon="fa-film" label="参考生视频" color="text-emerald-600 dark:text-emerald-400" onClick={() => onAction('REF_VIDEO')} />
          <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
          <MenuItem icon="fa-dice" label="参考抽卡" color="text-yellow-600 dark:text-yellow-400" onClick={() => onAction('REF_GACHA')} />
          <MenuItem icon="fa-cube" label="生成三视图" color="text-blue-600 dark:text-blue-400" onClick={() => onAction('GEN_VIEW')} />
          <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
        </>
      )}

      {itemType === ElementType.TEXT && (
        <>
          <MenuItem icon="fa-pen" label="编辑文本" color="text-slate-800 dark:text-white" onClick={() => onAction('EDIT_TEXT')} />
          <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
          <MenuItem icon="fa-image" label="文生图" color="text-purple-600 dark:text-purple-400" onClick={() => onAction('TXT2IMG')} />
          <MenuItem icon="fa-video" label="文生视频" color="text-emerald-600 dark:text-emerald-400" onClick={() => onAction('TXT2VID')} />
          <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
          <MenuItem icon="fa-scissors" label="分镜拆分" color="text-blue-600 dark:text-blue-400" onClick={() => onAction('SPLIT_STORYBOARD')} />
          <div className="h-px bg-slate-200 dark:bg-white/10 my-1 mx-2" />
        </>
      )}
      
      <MenuItem 
        icon={isLocked ? "fa-lock-open" : "fa-lock"} 
        label={isLocked ? "解锁" : "锁定"} 
        color="text-slate-600 dark:text-slate-400" 
        onClick={() => onAction('TOGGLE_LOCK')} 
      />
      <MenuItem icon="fa-trash" label="删除" color="text-red-500 dark:text-red-400" onClick={() => onAction('DELETE')} danger />
    </div>
  );
};

const MenuItem: React.FC<{ icon: string, label: string, color: string, onClick: () => void, danger?: boolean }> = ({ icon, label, color, onClick, danger }) => (
  <button
    onClick={() => { onClick(); }}
    className={`w-full text-left px-3 py-2 flex items-center gap-3 text-xs font-medium transition-colors
      ${danger 
        ? 'hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 dark:text-red-400' 
        : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
      }
    `}
  >
    <div className={`w-5 text-center ${color}`}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    {label}
  </button>
);

export default ContextMenu;
