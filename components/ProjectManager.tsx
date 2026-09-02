import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { createNewProjectTemplate, getAllProjects, saveProject } from '../utils/db';
import ConfirmModal from './ConfirmModal';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string | null;
  onSwitchProject: (project: Project) => void;
  onDeleteProject: (id: string) => Promise<void>; 
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ isOpen, onClose, currentProjectId, onSwitchProject, onDeleteProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null); // For loading spinner state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null); // For modal visibility state
  
  const winRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const list = await getAllProjects();
      setProjects(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    const newProj = createNewProjectTemplate(newProjectName.trim());
    await saveProject(newProj);
    setNewProjectName('');
    setIsCreating(false);
    await loadProjects();
    onSwitchProject(newProj); 
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId) return; // Prevent double clicks
    setConfirmDeleteId(id);
  };

  const performDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    
    setConfirmDeleteId(null);
    setDeletingId(id);
    
    try {
      // Delegate to parent App component to handle state switching and deletion safely
      await onDeleteProject(id);
      // Reload list after deletion is confirmed
      await loadProjects();
    } catch (error) {
      console.error("Deletion error:", error);
      alert("删除失败，请重试");
    } finally {
      setDeletingId(null);
    }
  };

  // 导出项目逻辑
  const handleExport = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    try {
      const jsonStr = JSON.stringify(project, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("导出失败");
    }
  };

  // 导入项目逻辑
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        const data = JSON.parse(content);

        // 简单校验
        if (!data.name || !Array.isArray(data.elements)) {
          alert('无效的项目文件格式');
          return;
        }

        // 生成新 ID 以避免冲突，视为新项目导入
        const newProject: Project = {
          ...data,
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
          name: `${data.name} (导入)`,
          updatedAt: Date.now()
        };

        await saveProject(newProject);
        await loadProjects();
        
        // 重置 input
        if (importInputRef.current) importInputRef.current.value = '';
      } catch (err) {
        console.error(err);
        alert('导入失败：文件损坏或格式错误');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-[300] backdrop-blur-sm transition-colors duration-300">
      <div 
        ref={winRef}
        className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 w-[500px] max-w-[90vw] h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3 text-slate-800 dark:text-white">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-folder-open"></i>
            </div>
            <div>
               <h2 className="font-bold text-lg">我的项目</h2>
               <p className="text-xs text-slate-500 dark:text-slate-400">管理您的所有分镜工程</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition flex items-center justify-center">
             <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scroll">
           
           {/* Create New / Import Buttons */}
           {!isCreating ? (
             <div className="flex gap-3 mb-4">
               <button 
                  onClick={() => setIsCreating(true)}
                  className="flex-1 h-14 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
               >
                  <i className="fa-solid fa-plus group-hover:scale-110 transition-transform"></i>
                  <span className="font-bold text-sm">新建项目</span>
               </button>
               <button 
                  onClick={() => importInputRef.current?.click()}
                  className="w-14 h-14 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
                  title="导入项目"
               >
                  <i className="fa-solid fa-file-import text-lg group-hover:scale-110 transition-transform"></i>
               </button>
               <input 
                  type="file" 
                  ref={importInputRef} 
                  className="hidden" 
                  accept=".json" 
                  onChange={handleImportFile} 
               />
             </div>
           ) : (
             <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-blue-500/30 mb-4 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs text-slate-500 block mb-2">项目名称</label>
                <div className="flex gap-2">
                   <input 
                      autoFocus
                      type="text" 
                      value={newProjectName}
                      onChange={e => setNewProjectName(e.target.value)}
                      placeholder="例如：Sora宣传片分镜..."
                      className="flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                   />
                   <button onClick={handleCreate} disabled={!newProjectName.trim()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors">创建</button>
                   <button onClick={() => setIsCreating(false)} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-600 dark:text-slate-300 px-4 rounded-lg text-sm font-bold transition-colors">取消</button>
                </div>
             </div>
           )}

           {/* Project List */}
           <div className="space-y-3">
              {isLoading ? (
                 <div className="text-center py-10 text-slate-400"><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> 加载中...</div>
              ) : projects.length === 0 && !isCreating ? (
                 <div className="text-center py-12 text-slate-400 dark:text-slate-600 select-none">
                    <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
                    <p className="text-sm">暂无项目，创建一个吧！</p>
                 </div>
              ) : (
                 projects.map(project => (
                    <div 
                      key={project.id}
                      onClick={() => {
                        if (deletingId) return; // Don't switch if deleting
                        onSwitchProject(project);
                        onClose();
                      }}
                      className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between
                        ${currentProjectId === project.id 
                           ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-500/50 shadow-md shadow-blue-500/10' 
                           : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/30 hover:shadow-md'
                        }
                      `}
                    >
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg
                             ${currentProjectId === project.id ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-500'}
                          `}>
                             <i className="fa-solid fa-layer-group"></i>
                          </div>
                          <div>
                             <h3 className={`font-bold text-sm ${currentProjectId === project.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'}`}>{project.name}</h3>
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {project.elements.length} 个元素 · 更新于 {new Date(project.updatedAt).toLocaleDateString()}
                             </p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2 relative z-20">
                           {currentProjectId === project.id && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold mr-2">当前</span>
                           )}
                           
                           <button 
                             onClick={(e) => handleExport(e, project)}
                             className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-300 hover:text-blue-500 transition flex items-center justify-center"
                             title="导出项目"
                           >
                              <i className="fa-solid fa-file-export"></i>
                           </button>

                           <button 
                             onClick={(e) => handleDeleteClick(e, project.id)}
                             disabled={!!deletingId}
                             className={`w-8 h-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 transition flex items-center justify-center relative z-50 ${deletingId === project.id ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
                             title="删除项目"
                           >
                             {deletingId === project.id ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                             ) : (
                                <i className="fa-solid fa-trash-can"></i>
                             )}
                           </button>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </div>
      </div>
    </div>
    
    <ConfirmModal 
      isOpen={!!confirmDeleteId}
      title="删除项目"
      message="确定要删除这个项目吗？此操作无法撤销。"
      onConfirm={performDelete}
      onCancel={() => setConfirmDeleteId(null)}
      zIndex={350} 
    />
    </>
  );
};

export default ProjectManager;