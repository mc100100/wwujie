import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel, zIndex = 100 }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
      style={{ zIndex }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-[90%] shadow-2xl scale-100 animate-in zoom-in-95 duration-200 transition-colors">
        <h3 className="text-slate-800 dark:text-white font-bold text-lg mb-2 flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation text-yellow-500"></i>
          {title}
        </h3>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-sm transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
          >
            取消
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }} 
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-900/30 transition-transform active:scale-95"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;