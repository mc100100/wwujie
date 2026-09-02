
import React, { useState, useEffect } from 'react';
import { toast } from '../utils/toast';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((event) => {
      setToasts((prev) => [...prev, event]);
      
      if (event.duration !== 0) {
        setTimeout(() => {
          removeToast(event.id);
        }, event.duration || 3000);
      }
    });
    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in duration-300
            ${t.type === 'success' ? 'bg-white/90 dark:bg-slate-800/90 border-green-500/30 text-green-600 dark:text-green-400' : ''}
            ${t.type === 'error' ? 'bg-white/90 dark:bg-slate-800/90 border-red-500/30 text-red-600 dark:text-red-400' : ''}
            ${t.type === 'info' ? 'bg-white/90 dark:bg-slate-800/90 border-blue-500/30 text-blue-600 dark:text-blue-400' : ''}
            ${t.type === 'warning' ? 'bg-white/90 dark:bg-slate-800/90 border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : ''}
          `}
        >
          <div className={`
            w-6 h-6 rounded-full flex items-center justify-center shrink-0
            ${t.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' : ''}
            ${t.type === 'error' ? 'bg-red-100 dark:bg-red-900/30' : ''}
            ${t.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
            ${t.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}
          `}>
            <i className={`fa-solid text-xs
              ${t.type === 'success' ? 'fa-check' : ''}
              ${t.type === 'error' ? 'fa-xmark' : ''}
              ${t.type === 'info' ? 'fa-info' : ''}
              ${t.type === 'warning' ? 'fa-exclamation' : ''}
            `}></i>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-all">{t.message}</p>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
