
import React, { useState, useEffect, useRef, useCallback } from 'react';
import InfiniteCanvas, { InfiniteCanvasRef } from './components/InfiniteCanvas';
import { Sidebar } from './components/Sidebar';
import FloatingMenu from './components/FloatingMenu';
import SettingsModal from './components/SettingsModal';
import Lightbox from './components/Lightbox';
import ConfirmModal from './components/ConfirmModal';
import ChatWindow from './components/ChatWindow';
import CharacterCreator from './components/CharacterCreator';
import CharacterAgent from './components/CharacterAgent'; 
import StoryboardAgent from './components/StoryboardAgent';
import DirectorAgent from './components/DirectorAgent'; 
import ProjectManager from './components/ProjectManager'; 
import AssetLibrary from './components/AssetLibrary'; 
import CharacterLibrary from './components/CharacterLibrary'; 
import ToastContainer from './components/ToastContainer';
import { toast } from './utils/toast';
import { ApiConfig, CanvasElement, ElementType, GenerationTask, MenuAction, Project, Asset, WorkbenchState } from './types';
import { createGenerationTask, pollTaskResult, uploadFile, uploadToR2 } from './utils/api';
import { createYunwuTask, pollYunwuTask } from './utils/yunwuApi';
import { createNewProjectTemplate, getAllProjects, saveProject, deleteProject, getAllAssets, saveAsset, deleteAsset } from './utils/db'; 
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { formatMediaUrl } from './utils/url';
import { exportStitchedImage } from './utils/canvasStitcher';

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);

const autoSaveAsset = async (url: string, type: 'image' | 'video', projectName: string = '默认工程'): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  if (!url.startsWith('http')) return null;

  try {
    // 处理项目名称中的非法字符，防止路径错误
    const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_');
    
    const folderName = type === 'image' ? 'image' : 'video';
    const ext = type === 'image' ? 'png' : 'mp4';
    const fileName = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${ext}`;
    
    // 修改路径结构: 无界/项目名称/image/xxx.png
    const targetDir = `无界/${safeProjectName}/${folderName}`;
    const targetPath = `${targetDir}/${fileName}`;
    
    try {
      await Filesystem.mkdir({
        path: targetDir,
        directory: Directory.Documents,
        recursive: true
      });
    } catch (e) {}

    const result = await Filesystem.downloadFile({
      url: url,
      path: targetPath,
      directory: Directory.Documents
    });

    const savedPath = result.path;
    if (savedPath) {
        return savedPath.startsWith('file://') ? savedPath : `file://${savedPath}`;
    }
    return null;

  } catch (error) {
    console.error("Auto-save failed:", error);
    return null;
  }
};

const checkCollision = (x: number, y: number, w: number, h: number, elements: CanvasElement[]) => {
  const newArea = w * h;
  const maxOverlap = newArea / 5; 

  const l1 = x - w / 2;
  const r1 = x + w / 2;
  const t1 = y - h / 2;
  const b1 = y + h / 2;

  for (const el of elements) {
    const l2 = el.x - el.width / 2;
    const r2 = el.x + el.width / 2;
    const t2 = el.y - el.height / 2;
    const b2 = el.y + el.height / 2;

    const lInt = Math.max(l1, l2);
    const rInt = Math.min(r1, r2);
    const tInt = Math.max(t1, t2);
    const bInt = Math.min(b1, b2);

    if (rInt > lInt && bInt > tInt) {
       const overlapArea = (rInt - lInt) * (bInt - tInt);
       if (overlapArea > maxOverlap) {
         return true; 
       }
    }
  }
  return false;
};

const findSafePosition = (w: number, h: number, elements: CanvasElement[]) => {
  if (elements.length === 0) {
    return { x: 0, y: 0 };
  }

  for (let i = 0; i < 50; i++) {
    const target = elements[Math.floor(Math.random() * elements.length)];
    const angle = Math.random() * Math.PI * 2;
    const targetRadius = Math.max(target.width, target.height) / 2;
    const selfRadius = Math.max(w, h) / 2;
    const distScale = 0.6 + Math.random() * 0.7; 
    const dist = (targetRadius + selfRadius) * distScale;

    const px = target.x + Math.cos(angle) * dist;
    const py = target.y + Math.sin(angle) * dist;

    if (!checkCollision(px, py, w, h, elements)) {
       return { x: px, y: py };
    }
  }

  const scatterRange = 800 + elements.length * 50;
  return {
     x: (Math.random() - 0.5) * scatterRange,
     y: (Math.random() - 0.5) * scatterRange
  };
};

export default function App() {
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    const savedStorage = localStorage.getItem('grsai_storage');
    return {
      host: localStorage.getItem('grsai_host') || 'https://grsai.dakka.com.cn',
      key: localStorage.getItem('grsai_apikey') || '',
      secondaryHost: localStorage.getItem('grsai_secondary_host') || '',
      secondaryKey: localStorage.getItem('grsai_secondary_key') || '',
      activeProvider: (localStorage.getItem('grsai_active_provider') as any) || 'primary',
      storage: savedStorage ? JSON.parse(savedStorage) : { enabled: false },
      yunwuKey: localStorage.getItem('grsai_yunwu_key') || ''
    };
  });
  
  const [tasks, setTasks] = useState<GenerationTask[]>(() => {
    try { return JSON.parse(localStorage.getItem('grsai_tasks') || '[]'); } catch { return []; }
  });
  
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [workbenchState, setWorkbenchState] = useState<WorkbenchState | undefined>(); 
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  
  // 使用 Ref 追踪当前项目，以便在异步轮询中获取最新值
  const currentProjectRef = useRef<Project | null>(null);
  useEffect(() => { currentProjectRef.current = currentProject; }, [currentProject]);

  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  // Default to 'dark' instead of 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('grsai_theme') as 'light' | 'dark') || 'dark';
  });

  const [assets, setAssets] = useState<Asset[]>([]);
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
  const [isSoraLibraryOpen, setIsSoraLibraryOpen] = useState(false); // Global Sora Library State
  const [tempSoraId, setTempSoraId] = useState<string>(''); // Temp ID for passing from Creator to Library

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => !localStorage.getItem('grsai_apikey'));
  const [isCharacterCreatorOpen, setIsCharacterCreatorOpen] = useState(false);
  const [isCharacterAgentOpen, setIsCharacterAgentOpen] = useState(false);
  const [isStoryboardAgentOpen, setIsStoryboardAgentOpen] = useState(false);
  const [isDirectorAgentOpen, setIsDirectorAgentOpen] = useState(false); 
  const [isChatOpen, setIsChatOpen] = useState(false); // Gemini Chat state lifted up
  
  const [lightbox, setLightbox] = useState<{ url: string | null, type: 'image' | 'video' | null }>({ url: null, type: null });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'tasks'>('image');
  const [unreadTasks, setUnreadTasks] = useState(0); 
  
  const [imgRefs, setImgRefs] = useState<string[]>([]);
  const [vidRef, setVidRef] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [vidPrompt, setVidPrompt] = useState<string>('');

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
  const [isStitching, setIsStitching] = useState(false);

  const canvasRef = useRef<InfiniteCanvasRef>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('android') > -1) {
      document.documentElement.classList.add('is-android');
    }

    const initData = async () => {
      try {
        const projects = await getAllProjects();
        if (projects.length > 0) {
           const lastActiveId = localStorage.getItem('grsai_last_project_id');
           const target = projects.find(p => p.id === lastActiveId) || projects[0];
           setCurrentProject(target);
           setElements(target.elements);
           setWorkbenchState(target.workbenchState); 
        } else {
           const newProject = createNewProjectTemplate('默认工程');
           await saveProject(newProject);
           setCurrentProject(newProject);
        }
        const assetList = await getAllAssets();
        setAssets(assetList);
      } catch (e) { console.error("Data init failed", e); }
    };
    initData();
  }, []);

  useEffect(() => localStorage.setItem('grsai_host', apiConfig.host), [apiConfig.host]);
  useEffect(() => localStorage.setItem('grsai_apikey', apiConfig.key), [apiConfig.key]);
  useEffect(() => {
    if (apiConfig.secondaryHost) localStorage.setItem('grsai_secondary_host', apiConfig.secondaryHost);
    if (apiConfig.secondaryKey) localStorage.setItem('grsai_secondary_key', apiConfig.secondaryKey);
    if (apiConfig.activeProvider) localStorage.setItem('grsai_active_provider', apiConfig.activeProvider);
    if (apiConfig.storage) localStorage.setItem('grsai_storage', JSON.stringify(apiConfig.storage));
    if (apiConfig.yunwuKey) localStorage.setItem('grsai_yunwu_key', apiConfig.yunwuKey);
  }, [apiConfig]);

  useEffect(() => localStorage.setItem('grsai_tasks', JSON.stringify(tasks)), [tasks]);
  useEffect(() => {
     if (currentProject) localStorage.setItem('grsai_last_project_id', currentProject.id);
  }, [currentProject]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('grsai_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      setUnreadTasks(0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!currentProject) return;
    const timer = setTimeout(() => {
      const updatedProject = { 
        ...currentProject, 
        elements: elements, 
        workbenchState: workbenchState, 
        updatedAt: Date.now() 
      };
      saveProject(updatedProject).catch(e => console.error("Auto-save failed", e));
    }, 1000); 
    return () => clearTimeout(timer);
  }, [elements, workbenchState, currentProject]);

  const toggleBatchSelect = useCallback((id: string) => {
     setBatchSelection(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
     });
  }, []);

  const handleToggleBatchMode = () => {
     if (isBatchMode) {
        setIsBatchMode(false);
        setBatchSelection(new Set());
     } else {
        setIsBatchMode(true);
        toast.info("进入批量选择模式，点击元素进行多选");
     }
  };

  const handleSelectAll = () => {
     setBatchSelection(new Set(elements.map(e => e.id)));
  };

  const handleDeleteSelected = () => {
    if (batchSelection.size === 0) return;
    setConfirmModal({
        isOpen: true,
        title: '批量删除',
        message: `确定要删除选中的 ${batchSelection.size} 个元素吗？`,
        onConfirm: () => {
            setElements(prev => prev.filter(e => !batchSelection.has(e.id)));
            setBatchSelection(new Set());
            toast.success("已批量删除");
        }
    });
  };

  const handleStitchExport = async () => {
    if (batchSelection.size === 0) return;
    setIsStitching(true);

    try {
        await exportStitchedImage(elements, batchSelection, theme);
        
        setIsBatchMode(false);
        setBatchSelection(new Set());

    } catch (err: any) {
        console.error("Export failed", err);
        toast.error("导出失败: " + err.message);
    } finally {
        setIsStitching(false);
    }
  };

  const handleSaveToLibrary = useCallback(async (url: string, type: 'image' | 'video', prompt: string, poster?: string) => {
     const assetId = generateId();
     const newAsset: Asset = {
       id: assetId,
       type,
       url, 
       prompt,
       poster,
       createdAt: Date.now()
     };
     
     await saveAsset(newAsset);
     setAssets(prev => [newAsset, ...prev]);

     toast.success('已存入我的资产库');
     
     if (apiConfig.storage?.enabled && apiConfig.storage.r2WorkerUrl) {
        try {
            const cloudUrl = await uploadToR2(url, apiConfig.storage);
            const updatedAsset = { ...newAsset, cloudUrl };
            await saveAsset(updatedAsset);
            setAssets(prev => prev.map(a => a.id === assetId ? updatedAsset : a));
        } catch (err) {
            console.error("云端同步失败 (Asset Library Only):", err);
        }
     }
  }, [apiConfig.storage]);

  const handleDeleteAsset = async (id: string) => {
     await deleteAsset(id);
     setAssets(prev => prev.filter(a => a.id !== id));
     toast.success('资产已删除');
  };

  const handleSwitchProject = (project: Project) => {
    setElements([]); 
    setWorkbenchState(project.workbenchState); 
    setTimeout(() => {
        setCurrentProject(project);
        setElements(project.elements);
        canvasRef.current?.resetView(0.3); 
        toast.success(`已切换到项目: ${project.name}`);
    }, 50);
  };

  const handleDeleteProject = async (id: string): Promise<void> => {
    try {
      if (currentProject?.id === id) {
          const all = await getAllProjects();
          let next = all.find(p => p.id !== id);
          if (!next) {
              next = createNewProjectTemplate('默认工程');
              await saveProject(next);
          }
          setCurrentProject(next);
          setElements(next.elements);
          setWorkbenchState(next.workbenchState); 
          canvasRef.current?.resetView(0.3);
          await new Promise(resolve => setTimeout(resolve, 300));
          await deleteProject(id);
      } else { await deleteProject(id); }
      toast.success('项目已删除');
    } catch (e) { console.error("Failed to delete project:", e); throw e; }
  };

  const handleAddToCanvas = useCallback((url: string, type: 'image' | 'video', id?: string, poster?: string) => {
    return new Promise<void>((resolve) => {
      const newId = id || generateId();
      if (type === 'image') {
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          const width = 300;
          const height = width / ratio;
          
          setElements(prev => {
            const pos = findSafePosition(width, height, prev);
            return [...prev, {
              id: newId, type: ElementType.IMAGE, src: url,
              x: pos.x, y: pos.y, 
              width, height, aspectRatio: ratio
            }];
          });
          resolve();
        };
        img.onerror = () => resolve(); 
        img.src = formatMediaUrl(url);
      } else {
        const vid = document.createElement('video');
        vid.onloadedmetadata = () => {
          const ratio = vid.videoWidth / vid.videoHeight || 1.77;
          const width = 400;
          const height = width / ratio;
          
          setElements(prev => {
            const pos = findSafePosition(width, height, prev);
            return [...prev, {
              id: newId, type: ElementType.VIDEO, src: url,
              x: pos.x, y: pos.y,
              width, height, aspectRatio: ratio,
              poster: poster
            }];
          });
          resolve();
        };
        vid.onerror = () => resolve();
        vid.src = formatMediaUrl(url);
      }
    });
  }, []);

  const handleAddText = useCallback(() => {
    const newId = generateId();
    const width = 300;
    const height = 450;
    setElements(prev => {
        const pos = findSafePosition(width, height, prev);
        return [...prev, {
          id: newId, type: ElementType.TEXT, src: '', content: '', 
          x: pos.x, y: pos.y, width, height, aspectRatio: 3/4.5
        }];
    });
  }, []);

  const handleAddTextNodes = useCallback((contents: string[]) => {
    if (contents.length === 0) return;
    const COLUMNS = 5;
    const GAP_X = 320; 
    const GAP_Y = 470; 
    
    setElements(prev => {
       const totalRows = Math.ceil(contents.length / COLUMNS);
       const currentRowCount = Math.min(contents.length, COLUMNS);
       const blockW = currentRowCount * GAP_X;
       const blockH = totalRows * GAP_Y;
       
       const startPos = findSafePosition(blockW, blockH, prev);
       const originX = startPos.x - (blockW / 2) + (GAP_X / 2);
       const originY = startPos.y - (blockH / 2) + (GAP_Y / 2);

       const newElements: CanvasElement[] = contents.map((content, index) => {
          const colIndex = index % COLUMNS;
          const rowIndex = Math.floor(index / COLUMNS);
          return {
            id: generateId(), type: ElementType.TEXT, src: '', content: content.trim(),
            x: originX + (colIndex * GAP_X), 
            y: originY + (rowIndex * GAP_Y),
            width: 300, height: 450, aspectRatio: 3/4.5, locked: true 
          };
       });
       return [...prev, ...newElements];
    });
    toast.success(`已添加 ${contents.length} 个分镜卡片`);
  }, []);

  const handleAddDirectorBoard = useCallback((contents: string[]) => {
      if (contents.length === 0) return;
      const COLUMNS = 5;
      const ROWS = Math.ceil(contents.length / COLUMNS);
      const BOARD_WIDTH = Math.min(contents.length, COLUMNS) * 260 + 40; 
      const BOARD_HEIGHT = 60 + ROWS * 340 + 40;

      setElements(prev => {
          const pos = findSafePosition(BOARD_WIDTH, BOARD_HEIGHT, prev);
          return [...prev, {
              id: generateId(),
              type: ElementType.SCRIPT_BOARD,
              src: '',
              scripts: contents, 
              x: pos.x,
              y: pos.y,
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              aspectRatio: BOARD_WIDTH / BOARD_HEIGHT
          }];
      });
      toast.success(`已创建包含 ${contents.length} 个分镜的剧本板`);
  }, []);

  const handleUploadAndAdd = useCallback(async (file: File, type: 'image' | 'video') => {
    const blobUrl = URL.createObjectURL(file);
    const tempId = generateId();
    
    const convertToBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
    };
    
    if (type === 'image') {
      const img = new Image();
      img.onload = async () => {
        const ratio = img.width / img.height;
        const width = 300;
        const height = width / ratio;
        
        setElements(prev => {
          const pos = findSafePosition(width, height, prev);
          return [...prev, {
            id: tempId, type: ElementType.IMAGE, src: blobUrl,
            x: pos.x, y: pos.y, 
            width, height, aspectRatio: ratio
          }];
        });

        try {
           const base64 = await convertToBase64(file);
           setElements(prev => prev.map(el => el.id === tempId ? { ...el, src: base64 } : el));
        } catch (e) {
           console.error("Base64 conversion skipped for large file", e);
        }
      };
      img.src = blobUrl;
    } else {
      const vid = document.createElement('video');
      vid.onloadedmetadata = async () => {
        const ratio = vid.videoWidth / vid.videoHeight || 1.77;
        const width = 400;
        const height = width / ratio;
        
        setElements(prev => {
          const pos = findSafePosition(width, height, prev);
          return [...prev, {
            id: tempId, type: ElementType.VIDEO, src: blobUrl,
            x: pos.x, y: pos.y,
            width, height, aspectRatio: ratio
          }];
        });
        
        if (file.size < 10 * 1024 * 1024) { 
            try {
              const base64 = await convertToBase64(file);
              setElements(prev => prev.map(el => el.id === tempId ? { ...el, src: base64 } : el));
            } catch (e) {
              console.error("Video Base64 conversion failed", e);
            }
        }
      };
      vid.src = blobUrl;
    }
  }, [apiConfig]);

  const processingRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTasks = tasksRef.current;
      const activeTasks = currentTasks.filter(t => t.status === 'running' || t.status === 'pending');
      
      if (activeTasks.length === 0) return;

      activeTasks.forEach(async (task) => {
        if (!task.id) return;
        if (processingRef.current.has(task.id)) return;
        
        try {
          // 根据任务引擎类型选择不同的轮询逻辑
          let res;
          if (task.engine === 'yunwu') {
              res = await pollYunwuTask(task.id, apiConfig);
          } else {
              res = await pollTaskResult(task.id, apiConfig);
          }

          if (res.code === 0) {
            if (res.data.status === 'succeeded' && task.status !== 'succeeded') {
                if (processingRef.current.has(task.id)) return;
                processingRef.current.add(task.id);
                
                const rawResults = res.data.results || [];
                
                setTasks(prev => prev.map(t => 
                  t.id === task.id ? { ...t, status: 'succeeded', progress: 100, results: rawResults } : t
                ));

                const networkUrlToCanvasId = new Map<string, string>();

                // 优化：无论是否为 agentTask，都自动添加到画布（满足用户“工作台生成的图自动加载到画布”需求）
                for (const r of rawResults) {
                   const canvasElementId = generateId();
                   networkUrlToCanvasId.set(r.url, canvasElementId);
                   await handleAddToCanvas(r.url, task.type, canvasElementId, task.poster);
                }

                toast.success(task.type === 'image' ? '生成完成！' : '视频生成完成！');

                const finalResults = await Promise.all(rawResults.map(async (r: any) => {
                    const networkUrl = r.url;
                    
                    // 获取当前项目名称
                    const projectName = currentProjectRef.current?.name || '默认工程';
                    // 传入 projectName 进行路径隔离
                    const localPath = await autoSaveAsset(networkUrl, task.type, projectName);
                    
                    if (localPath) {
                        const elemId = networkUrlToCanvasId.get(networkUrl);
                        if (elemId) {
                            setElements(prev => prev.map(el => 
                                el.id === elemId ? { ...el, src: localPath } : el
                            ));
                        }
                        return { ...r, url: localPath };
                    }
                    return r;
                }));

                setTasks(prev => prev.map(t => 
                  t.id === task.id ? { ...t, results: finalResults } : t
                ));
            } else {
               setTasks(prev => prev.map(t => 
                 t.id === task.id ? { 
                   ...t, 
                   status: res.data.status, 
                   progress: res.data.progress, 
                   msg: res.data.status === 'failed' ? res.data.failure_reason : t.msg 
                 } : t
               ));
               if (res.data.status === 'failed') {
                   toast.error(`任务失败: ${res.data.failure_reason}`);
               }
            }
          }
        } catch (e) { 
          console.error('Poll failed', e); 
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [apiConfig, handleAddToCanvas]);

  const handleSubmitTask = async (type: 'image' | 'video', params: any, agentTaskId?: string) => {
    // 检查 Key
    if (params.engine === 'yunwu') {
        if (!apiConfig.yunwuKey) {
            toast.warning('请先配置 Yunwu API Key');
            return setIsSettingsOpen(true);
        }
    } else {
        if (!apiConfig.key) {
            toast.warning('请先配置默认 API Key');
            return setIsSettingsOpen(true);
        }
    }

    const newTask: GenerationTask = { 
      id: null, type, prompt: params.prompt, status: 'pending', progress: 0, createdAt: Date.now(),
      poster: type === 'video' ? params.url : undefined,
      agentTaskId: agentTaskId,
      engine: params.engine || 'backup'
    };
    setTasks(prev => [...prev, newTask]);
    if (activeTab !== 'tasks') setUnreadTasks(prev => prev + 1);
    
    toast.info('任务已提交');

    try {
      let id;
      if (params.engine === 'yunwu') {
          id = await createYunwuTask(params, apiConfig);
      } else {
          id = await createGenerationTask(type, params, apiConfig);
      }
      setTasks(prev => prev.map(t => t === newTask ? { ...t, id, status: 'running' } : t));
    } catch (e: any) { 
        setTasks(prev => prev.map(t => t === newTask ? { ...t, status: 'failed', msg: e.message } : t)); 
        toast.error('提交失败: ' + e.message);
    }
  };

  const handleFusionAction = async (action: MenuAction, source: CanvasElement, target: CanvasElement) => {
      setIsSidebarOpen(true);
      if (action === 'FUSION_REF_IMAGE') {
          setActiveTab('image');
          setPrompt(target.content || '');
      } else if (action === 'FUSION_REF_VIDEO') {
          setActiveTab('video');
          setVidPrompt(target.content || '');
      }

      let targetUrl = source.src;
      try {
          const fetchUrl = formatMediaUrl(source.src);
          if (fetchUrl.startsWith('data:') || fetchUrl.startsWith('blob:') || fetchUrl.startsWith('file://')) {
               if (!apiConfig.key) {
                  setIsSettingsOpen(true);
                  return;
              }
              const res = await fetch(fetchUrl);
              const blob = await res.blob();
              const file = new File([blob], `fusion_ref.png`, { type: blob.type });
              targetUrl = await uploadFile(file, apiConfig);
          }
      } catch (e) {
          console.error(e);
          toast.error("处理参考图失败");
          return;
      }

      if (action === 'FUSION_REF_IMAGE') {
          if (imgRefs.length < 4 && !imgRefs.includes(targetUrl)) {
              setImgRefs(prev => [...prev, targetUrl]);
          }
      } else if (action === 'FUSION_REF_VIDEO') {
          setVidRef(targetUrl);
      }
  };

  const handleContextMenuAction = async (action: MenuAction, itemId: string, itemSrc: string, itemType: ElementType) => {
    if (action === 'DELETE') {
      setConfirmModal({ isOpen: true, title: '删除元素', message: '确定要删除这个元素吗？', onConfirm: () => setElements(prev => prev.filter(e => e.id !== itemId)) });
      return;
    }
    if (action === 'SAVE_TO_LIBRARY') {
       const el = elements.find(e => e.id === itemId);
       if (el) handleSaveToLibrary(el.src, el.type === ElementType.VIDEO ? 'video' : 'image', el.content || '', el.poster);
       return;
    }
    if (action === 'SPLIT_STORYBOARD') {
      const el = elements.find(e => e.id === itemId);
      if (!el || !el.content) return;

      const Swal = (window as any).Swal;
      const { value: keyword } = await Swal.fire({
        title: '分镜拆分',
        input: 'text',
        inputLabel: '请输入拆分关键词 (如: 镜头, 分镜)',
        inputValue: '分镜',
        showCancelButton: true,
        inputValidator: (value: string) => {
          if (!value) return '关键词不能为空';
        },
        background: theme === 'dark' ? '#1e293b' : '#fff',
        color: theme === 'dark' ? '#fff' : '#1e293b',
      });

      if (keyword) {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|\\n)[^\\n\\r]{0,10}${escapedKeyword}\\s*\\d+[\\s\\S]*?(?=\\n[^\\n\\r]{0,10}${escapedKeyword}\\s*\\d+|$)`, 'g');
        const matches = [...el.content.matchAll(regex)];
        
        if (matches.length > 0) {
           const scripts = matches.map(m => m[0].trim());
           handleAddTextNodes(scripts);
        } else {
           toast.warning(`未在文本中识别到包含关键词 "${keyword}" 且跟随数字的分镜标题`);
        }
      }
      return;
    }
    if (action === 'TXT2IMG') { setIsSidebarOpen(true); setActiveTab('image'); setPrompt(itemSrc); return; }
    if (action === 'TXT2VID') { setIsSidebarOpen(true); setActiveTab('video'); setVidPrompt(itemSrc); return; }
    const requiresUpload = ['REF_IMAGE', 'REF_VIDEO', 'REF_GACHA', 'GEN_VIEW'].includes(action);
    let targetUrl = itemSrc;
    if (requiresUpload) {
        setIsSidebarOpen(true);
        if (action === 'REF_VIDEO') setActiveTab('video'); else setActiveTab('image');
        try {
            const fetchUrl = formatMediaUrl(itemSrc);
            const res = await fetch(fetchUrl);
            const blob = await res.blob();
            const file = new File([blob], `temp_ref.png`, { type: blob.type });
            if (apiConfig.key) targetUrl = await uploadFile(file, apiConfig); else { setIsSettingsOpen(true); return; }
        } catch (e) { 
            console.error(e);
            toast.error("上传参考图失败");
            return; 
        }
    }
    if (action === 'REF_IMAGE') { if (imgRefs.length < 4 && !imgRefs.includes(targetUrl)) setImgRefs(prev => [...prev, targetUrl]); }
    else if (action === 'REF_VIDEO') { setVidRef(targetUrl); }
    else if (action === 'REF_GACHA') { setPrompt("参考图片风格生成五列男/女生的面部特写，人物不同"); if (imgRefs.length < 4 && !imgRefs.includes(targetUrl)) setImgRefs(prev => [...prev, targetUrl]); }
    else if (action === 'GEN_VIEW') { setPrompt("把参考图上左边第*个人物补全身体，白色背景，左侧4/6的区域放置正面和背面全身视图（头身比 1:8），右侧2/6的区域为正面肩部以上特写。"); if (imgRefs.length < 4 && !imgRefs.includes(targetUrl)) setImgRefs(prev => [...prev, targetUrl]); }
  };

  const handleClearCanvas = () => {
    setConfirmModal({ isOpen: true, title: '清空画布', message: '确定要清空画布上所有内容吗？', onConfirm: () => { setElements([]); toast.info('画布已清空'); } });
  };

  const onDeleteTask = useCallback((index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearHistory = () => {
    setConfirmModal({ 
      isOpen: true, 
      title: '清空历史', 
      message: '确定要清空所有历史记录吗？此操作无法撤销。', 
      onConfirm: () => { setTasks([]); toast.info('历史记录已清空'); }
    });
  };

  const handleAddCreatedCharacterToLibrary = (id: string) => {
    setTempSoraId(id);
    setIsCharacterCreatorOpen(false);
    setIsSoraLibraryOpen(true);
  };

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-[#111] transition-colors duration-300">
      <ToastContainer />

      <div className="absolute top-[36px] left-4 z-40 flex items-center gap-2">
          {currentProject && (
              <button 
                onClick={() => setIsProjectManagerOpen(true)} 
                className="bg-white/80 dark:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 dark:border-white/10 flex items-center gap-2 hover:bg-white dark:hover:bg-black/80 transition-all active:scale-95 group shadow-sm"
              >
                 <i className="fa-regular fa-folder-open text-slate-500 group-hover:text-blue-500"></i>
                 <span className="font-bold text-xs text-slate-700 dark:text-slate-300 max-w-[150px] truncate">{currentProject.name}</span>
                 <i className="fa-solid fa-chevron-down text-[8px] text-slate-300"></i>
              </button>
          )}
      </div>

      <div className="absolute top-[36px] right-4 z-40 flex items-center gap-2">
          <button 
            onClick={() => setIsDirectorAgentOpen(true)} 
            className="bg-white/80 dark:bg-black/60 backdrop-blur-md text-slate-800 dark:text-white px-4 py-1.5 rounded-full flex items-center gap-2 hover:bg-white dark:hover:bg-black/80 border border-white/20 dark:border-white/10 transition-all active:scale-95 font-bold text-xs shadow-sm"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-purple-500"></i>
            <span>工作台</span>
          </button>
      </div>

      {isBatchMode && (
        <div className="absolute top-0 left-0 right-0 h-[80px] bg-gradient-to-r from-blue-600 to-purple-600 z-[60] flex items-end px-4 pb-3 shadow-lg animate-in slide-in-from-top duration-300">
           <div className="flex-1 flex items-center justify-between text-white">
               <div className="flex items-center gap-4">
                  <button onClick={handleToggleBatchMode} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                      <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <div>
                      <h3 className="font-bold text-lg leading-none">批量管理</h3>
                      <p className="text-[10px] opacity-80 mt-1">已选择 {batchSelection.size} 个元素</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                   <button onClick={handleSelectAll} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition">全选</button>
                   <button onClick={handleDeleteSelected} disabled={batchSelection.size === 0} className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-xs font-bold transition disabled:opacity-50">删除</button>
                   <button 
                      onClick={handleStitchExport}
                      disabled={batchSelection.size === 0 || isStitching}
                      className="px-4 py-1.5 rounded-lg bg-white text-blue-600 hover:bg-slate-100 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                   >
                      {isStitching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-panorama"></i>}
                      生成拼图
                   </button>
               </div>
           </div>
        </div>
      )}

      <InfiniteCanvas 
        ref={canvasRef}
        elements={elements}
        onElementsChange={setElements}
        onContextMenuAction={handleContextMenuAction}
        onCanvasDoubleClick={() => setIsSidebarOpen(prev => !prev)}
        isBatchMode={isBatchMode}
        selectedBatchIds={batchSelection}
        onBatchSelect={toggleBatchSelect}
        onFusionAction={handleFusionAction}
      />
      
      <Sidebar 
        isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} onSettings={() => setIsSettingsOpen(true)}
        onClearHistory={handleClearHistory} tasks={tasks} onDeleteTask={onDeleteTask}
        onSubmitTask={handleSubmitTask} onAddToCanvas={handleAddToCanvas} onUploadFile={handleUploadAndAdd} onViewMedia={(url, type) => setLightbox({ url, type })}
        apiConfig={apiConfig} activeTab={activeTab} setActiveTab={setActiveTab} unreadTasks={unreadTasks}
        imgRefs={imgRefs} setImgRefs={setImgRefs}
        vidRef={vidRef} setVidRef={setVidRef} prompt={prompt} setPrompt={setPrompt} vidPrompt={vidPrompt} setVidPrompt={setVidPrompt}
      />

      <AssetLibrary 
        isOpen={isAssetLibraryOpen} 
        onClose={() => setIsAssetLibraryOpen(false)} 
        assets={assets}
        onDeleteAsset={handleDeleteAsset}
        onAddToCanvas={handleAddToCanvas}
        onView={(url, type) => setLightbox({ url, type })}
      />

      {/* Global Sora Library */}
      <CharacterLibrary 
        isOpen={isSoraLibraryOpen} 
        onClose={() => { setIsSoraLibraryOpen(false); setTempSoraId(''); }} 
        apiConfig={apiConfig}
        onSelect={(char) => {
            navigator.clipboard.writeText(char.soraId);
            toast.success("已复制角色ID");
            setIsSoraLibraryOpen(false);
        }}
        onCreateCharacter={() => {
            setIsSoraLibraryOpen(false);
            setIsCharacterCreatorOpen(true);
        }}
        initialSoraId={tempSoraId}
        // onPreview={(url) => setLightbox({ url, type: 'image' })} // Enable preview
      />

      {!isBatchMode && (
        <FloatingMenu 
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onUploadToCanvas={handleAddToCanvas}
            onUploadFile={handleUploadAndAdd}
            onClearCanvas={handleClearCanvas}
            onCreateCharacter={() => setIsCharacterCreatorOpen(true)}
            onAddText={handleAddText}
            apiConfig={apiConfig}
            onToggleAssetLibrary={() => setIsAssetLibraryOpen(prev => !prev)}
            onToggleBatchMode={handleToggleBatchMode} 
            onOpenDirectorAgent={() => setIsDirectorAgentOpen(true)}
            onOpenGemini={() => setIsChatOpen(true)}
            onOpenSoraLibrary={() => setIsSoraLibraryOpen(true)}
        />
      )}

      <ChatWindow 
        apiConfig={apiConfig} 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onOpenCharacterAgent={() => setIsCharacterAgentOpen(true)} 
        onOpenStoryboardAgent={() => setIsStoryboardAgentOpen(true)} 
      />
      <CharacterCreator 
        isOpen={isCharacterCreatorOpen} 
        onClose={() => setIsCharacterCreatorOpen(false)} 
        apiConfig={apiConfig} 
        onAddToLibrary={handleAddCreatedCharacterToLibrary}
      />
      <CharacterAgent isOpen={isCharacterAgentOpen} onClose={() => setIsCharacterAgentOpen(false)} apiConfig={apiConfig} onSendToSidebar={(text) => { setPrompt(text); setActiveTab('image'); setIsSidebarOpen(true); setIsCharacterAgentOpen(false); }} />
      <StoryboardAgent isOpen={isStoryboardAgentOpen} onClose={() => setIsStoryboardAgentOpen(false)} apiConfig={apiConfig} onAddScriptToCanvas={handleAddTextNodes} />
      <DirectorAgent 
        key={currentProject?.id}
        isOpen={isDirectorAgentOpen} 
        onClose={() => setIsDirectorAgentOpen(false)} 
        apiConfig={apiConfig} 
        onAddScriptBoard={handleAddDirectorBoard} 
        tasks={tasks} 
        onSubmitTask={handleSubmitTask}
        initialState={workbenchState} 
        onStateChange={setWorkbenchState} 
      />
      <ProjectManager isOpen={isProjectManagerOpen} onClose={() => setIsProjectManagerOpen(false)} currentProjectId={currentProject?.id || null} onSwitchProject={handleSwitchProject} onDeleteProject={handleDeleteProject} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => { if (apiConfig.key) setIsSettingsOpen(false); }} config={apiConfig} onSave={(c) => { setApiConfig(c); setIsSettingsOpen(false); toast.success('设置已保存'); }} theme={theme} onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} canClose={!!apiConfig.key} />
      <Lightbox url={lightbox.url} type={lightbox.type} onClose={() => setLightbox({ url: null, type: null })} />
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
}
