
import React, { useState, useRef, useEffect } from 'react';
import { ApiConfig } from '../types';

interface FloatingMenuProps {
  onUploadToCanvas: (url: string, type: 'image' | 'video') => void;
  onUploadFile: (file: File, type: 'image' | 'video') => void;
  onToggleSidebar: () => void;
  onClearCanvas: () => void;
  onCreateCharacter: () => void;
  onAddText: () => void;
  apiConfig: ApiConfig;
  onToggleAssetLibrary: () => void;
  onToggleBatchMode: () => void;
  onOpenDirectorAgent: () => void;
  onOpenGemini: () => void;
  onOpenSoraLibrary: () => void; // New Prop
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ 
  onUploadToCanvas, 
  onUploadFile, 
  onToggleSidebar, 
  onClearCanvas, 
  onCreateCharacter, 
  onAddText,
  apiConfig,
  onToggleAssetLibrary,
  onToggleBatchMode,
  onOpenDirectorAgent,
  onOpenGemini,
  onOpenSoraLibrary
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsOpen(false);
    Array.from(e.target.files).forEach(file => {
      onUploadFile(file, type);
    });
    e.target.value = '';
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <>
      <div 
        className="fixed bottom-10 right-8 z-[80] flex flex-col items-end gap-4 pointer-events-none"
        style={{ touchAction: 'none' }}
      >
        <div 
          ref={menuRef}
          className={`flex flex-col items-end gap-3 transition-all duration-300 origin-bottom-right`}
          style={{
             opacity: isOpen ? 1 : 0,
             transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
             pointerEvents: isOpen ? 'auto' : 'none',
             marginBottom: '10px'
          }}
        >
          <FabItem label="批量管理" icon="fa-list-check" color="bg-orange-500" onClick={() => { setIsOpen(false); onToggleBatchMode(); }} />
          <FabItem label="Gemini" icon="fa-robot" color="bg-gradient-to-r from-blue-500 to-purple-600" onClick={() => { setIsOpen(false); onOpenGemini(); }} />
          <FabItem label="项目资产" icon="fa-users-viewfinder" color="bg-indigo-600" onClick={() => { setIsOpen(false); onOpenSoraLibrary(); }} />
          <FabItem label="新建文本" icon="fa-font" color="bg-yellow-500" onClick={() => { setIsOpen(false); onAddText(); }} />
          <FabItem label="上传图片" icon="fa-image" color="bg-blue-600" onClick={() => imgInputRef.current?.click()} />
          <FabItem label="上传视频" icon="fa-film" color="bg-emerald-600" onClick={() => vidInputRef.current?.click()} />
          <FabItem label="创建角色" icon="fa-user-astronaut" color="bg-indigo-500" onClick={() => { setIsOpen(false); onCreateCharacter(); }} />
          {/* 我的资产功能暂时隐藏 */}
          {/* <FabItem label="我的资产" icon="fa-photo-film" color="bg-blue-500" onClick={() => { setIsOpen(false); onToggleAssetLibrary(); }} /> */}
          <FabItem label="清空画布" icon="fa-trash-can" color="bg-red-600" onClick={() => { setIsOpen(false); onClearCanvas(); }} />
        </div>

        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl cursor-pointer pointer-events-auto 
          ${isOpen ? 'bg-slate-800 rotate-45' : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-110 shadow-xl'}
          transition-all duration-200 border border-white/10`}
        >
          <i className="fa-solid fa-plus"></i>
        </button>
      </div>

      <input type="file" ref={imgInputRef} accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
      <input type="file" ref={vidInputRef} accept="video/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
    </>
  );
};

const FabItem: React.FC<{ label: string, icon: string, color: string, onClick: () => void }> = ({ label, icon, color, onClick }) => (
  <div className="flex items-center gap-2 pr-1">
    <span className="bg-white/90 dark:bg-black/80 backdrop-blur-sm text-slate-800 dark:text-white py-1.5 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-white/10 shadow-sm transition-colors w-20 flex justify-center">{label}</span>
    <button onClick={onClick} className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center hover:brightness-110 transition-all active:scale-95 border border-white/10 shadow-md`}>
      <i className={`fa-solid ${icon} text-sm`}></i>
    </button>
  </div>
);

export default FloatingMenu;
