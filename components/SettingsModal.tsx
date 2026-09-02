
import React, { useState, useEffect } from 'react';
import { ApiConfig } from '../types';
import MD3Select from './MD3Select';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  canClose?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave, theme, onToggleTheme, canClose = true }) => {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);

  useEffect(() => {
    // 强制默认使用国内直连地址，并同步外部配置
    setLocalConfig({
        ...config,
        host: 'https://grsai.dakka.com.cn'
    });
  }, [config, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-[320] backdrop-blur-sm transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-xl w-[90%] max-w-sm shadow-2xl transition-colors duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <i className="fa-solid fa-gear text-slate-500 dark:text-slate-400"></i> API 配置
          </h3>
          
          {/* Theme Toggle Switch */}
          <button 
            onClick={onToggleTheme}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none flex items-center
              ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'}
            `}
            title="切换主题"
          >
            <div 
              className={`
                absolute w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center text-[10px]
                ${theme === 'dark' 
                  ? 'translate-x-6 bg-slate-900 text-yellow-400' 
                  : 'translate-x-1 bg-white text-orange-400'
                }
              `}
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`}></i>
            </div>
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Grsai Config - Updated Style to Blue (Matching Yunwu) */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
            <h4 className="text-xs font-bold text-blue-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-paintbrush"></i> Grsai(绘图引擎)
            </h4>
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5 ml-1">API Key</label>
                    <input 
                    type="password" 
                    className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all placeholder-slate-400 dark:placeholder-slate-600"
                    placeholder="sk-..."
                    value={localConfig.key}
                    onChange={e => setLocalConfig({...localConfig, key: e.target.value})}
                    />
                </div>
            </div>
          </div>

          {/* Yunwu Config */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
            <h4 className="text-xs font-bold text-blue-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-cloud"></i> 云雾 Sora (主视频引擎)
            </h4>
            <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5 ml-1">Yunwu API Key</label>
                <input 
                type="password" 
                className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all placeholder-slate-400 dark:placeholder-slate-600"
                placeholder="Bearer Key"
                value={localConfig.yunwuKey || ''}
                onChange={e => setLocalConfig({...localConfig, yunwuKey: e.target.value})}
                />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          {canClose && (
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs transition-colors"
            >
              取消
            </button>
          )}
          <button 
            onClick={() => onSave(localConfig)}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-purple-900/20"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
