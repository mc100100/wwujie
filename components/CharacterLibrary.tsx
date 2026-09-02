
import React, { useState, useEffect, useRef } from 'react';
import { uploadFile } from '../utils/api';
import { ApiConfig } from '../types';
import { formatMediaUrl } from '../utils/url';
import { toast } from '../utils/toast';

interface SoraCharacter {
  id: string;
  soraId: string;
  name: string;
  coverUrl: string;
  createdAt: number;
}

interface CharacterLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (character: SoraCharacter) => void;
  onCreateCharacter?: () => void;
  apiConfig: ApiConfig;
  initialSoraId?: string;
  // onPreview removed
}

const CharacterLibrary: React.FC<CharacterLibraryProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  onCreateCharacter, 
  apiConfig,
  initialSoraId
}) => {
  const [characters, setCharacters] = useState<SoraCharacter[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // New Character Form State
  const [newName, setNewName] = useState('');
  const [newSoraId, setNewSoraId] = useState('');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
      // Auto-open add form if ID is provided
      if (initialSoraId) {
        setIsAdding(true);
        setNewSoraId(initialSoraId);
        // Clear other fields to ensure clean state
        setNewName('');
        setNewCoverUrl('');
      }
    }
  }, [isOpen, initialSoraId]);

  const loadCharacters = () => {
    try {
      const stored = localStorage.getItem('grsai_sora_chars');
      if (stored) {
        setCharacters(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load characters", e);
    }
  };

  const saveCharacters = (list: SoraCharacter[]) => {
    localStorage.setItem('grsai_sora_chars', JSON.stringify(list));
    setCharacters(list);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadFile(file, apiConfig);
      setNewCoverUrl(url);
    } catch (e: any) {
      toast.error('封面上传失败');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAdd = () => {
    if (!newName.trim() || !newSoraId.trim() || !newCoverUrl) {
      toast.warning('请填写完整信息（名称、Sora ID、封面）');
      return;
    }

    const newChar: SoraCharacter = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName.trim(),
      soraId: newSoraId.trim(),
      coverUrl: newCoverUrl,
      createdAt: Date.now()
    };

    const updatedList = [newChar, ...characters];
    saveCharacters(updatedList);
    
    // Reset Form
    setNewName('');
    setNewSoraId('');
    setNewCoverUrl('');
    setIsAdding(false);
    toast.success('角色已添加');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); // 关键：阻止事件冒泡到卡片的 onClick
    
    const Swal = (window as any).Swal;
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '确定删除该角色?',
            text: "删除后将无法恢复，且本地绑定记录可能失效。",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
            color: document.documentElement.classList.contains('dark') ? '#fff' : '#1e293b',
            target: document.body // Ensure it renders on top
        }).then((result: any) => {
            if (result.isConfirmed) {
                const updatedList = characters.filter(c => c.id !== id);
                saveCharacters(updatedList);
                toast.success('角色已删除');
            }
        });
    } else {
        if (window.confirm("确定要删除这个角色吗？")) {
            const updatedList = characters.filter(c => c.id !== id);
            saveCharacters(updatedList);
            toast.success('角色已删除');
        }
    }
  };

  const handleCopyId = (e: React.MouseEvent, soraId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(soraId);
    toast.success('ID 已复制');
  };

  const handleCardClick = (char: SoraCharacter) => {
      if (onSelect) {
          onSelect(char);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-[600px] max-w-[95vw] h-[70vh] rounded-2xl flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <i className="fa-solid fa-users-viewfinder text-blue-500"></i>
            <h3 className="font-bold">Sora 角色库</h3>
          </div>
          <div className="flex gap-2">
             {onCreateCharacter && !isAdding && (
               <button 
                 onClick={onCreateCharacter} 
                 className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-md shadow-purple-500/20"
               >
                 <i className="fa-solid fa-wand-magic-sparkles"></i> 创建角色
               </button>
             )}
             {!isAdding && (
               <button 
                 onClick={() => setIsAdding(true)} 
                 className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
               >
                 <i className="fa-solid fa-plus"></i> 添加角色
               </button>
             )}
             <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition">
               <i className="fa-solid fa-xmark text-lg"></i>
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scroll bg-slate-100 dark:bg-[#0f172a]">
          
          {/* Add Form */}
          {isAdding && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-blue-500/30 mb-4 animate-in slide-in-from-top-2">
               <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">录入新角色</h4>
               <div className="flex gap-4">
                  {/* Image Upload */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 shrink-0 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors relative overflow-hidden group"
                  >
                     {newCoverUrl ? (
                        <img src={formatMediaUrl(newCoverUrl)} className="w-full h-full object-cover" />
                     ) : (
                        <>
                           {isUploading ? <i className="fa-solid fa-spinner fa-spin text-blue-500"></i> : <i className="fa-solid fa-camera text-slate-400 text-xl"></i>}
                           <span className="text-[10px] text-slate-400 mt-1">上传封面</span>
                        </>
                     )}
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">更换</div>
                  </div>
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />

                  {/* Fields */}
                  <div className="flex-1 flex flex-col gap-3">
                     <input 
                       type="text" 
                       value={newName}
                       onChange={e => setNewName(e.target.value)}
                       placeholder="角色名称 (如: 赛博杀手)"
                       className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                     />
                     <input 
                       type="text" 
                       value={newSoraId}
                       onChange={e => setNewSoraId(e.target.value)}
                       placeholder="Sora Character ID (如: ch_123abc...)"
                       className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono"
                     />
                     <div className="flex gap-2 justify-end mt-auto">
                        <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-xs">取消</button>
                        <button onClick={handleAdd} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md">保存</button>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* List */}
          {characters.length === 0 && !isAdding ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <i className="fa-regular fa-address-book text-4xl mb-3 opacity-30"></i>
                <p className="text-xs">暂无角色，请点击右上角添加</p>
             </div>
          ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {characters.map(char => (
                   <div 
                     key={char.id}
                     onClick={() => handleCardClick(char)}
                     className={`bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all group relative ${onSelect ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500' : 'cursor-default'}`}
                   >
                      <div className="aspect-[16/9] bg-slate-100 dark:bg-black/20 rounded-lg overflow-hidden mb-2 relative border border-slate-100 dark:border-white/5">
                         <img src={formatMediaUrl(char.coverUrl)} className="w-full h-full object-cover" />
                         {onSelect && <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors pointer-events-none"></div>}
                      </div>
                      <div className="px-1 relative">
                         <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate pr-6">{char.name}</h4>
                         <div className="flex items-center gap-1.5 mt-0.5">
                             <p className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]" title={char.soraId}>{char.soraId}</p>
                             <button 
                                onClick={(e) => handleCopyId(e, char.soraId)}
                                className="text-slate-300 hover:text-blue-500 transition-colors px-1 rounded hover:bg-slate-100 dark:hover:bg-white/10"
                                title="复制 ID"
                             >
                                <i className="fa-regular fa-copy text-[10px]"></i>
                             </button>
                         </div>
                      </div>
                      
                      {/* Delete Button - Updated: Hidden by default, visible on hover */}
                      <button 
                        onClick={(e) => handleDelete(e, char.id)}
                        onPointerDown={(e) => e.stopPropagation()} 
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md z-20 transition-all duration-200 active:scale-95 opacity-0 group-hover:opacity-100"
                        title="删除"
                      >
                        <i className="fa-solid fa-trash text-[10px]"></i>
                      </button>
                   </div>
                ))}
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CharacterLibrary;
