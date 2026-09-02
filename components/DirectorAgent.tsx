
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiConfig, GenerationTask, AssetEntity, Shot, WorkbenchState, Episode } from '../types';
import { createGenerationTask, pollTaskResult, uploadFile } from '../utils/api';
import { toast } from '../utils/toast';
import { formatMediaUrl } from '../utils/url';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

// 导入子组件
import { SYSTEM_PROMPT_BUNDLE } from './DirectorConstants';
import ScriptStep from './DirectorScriptStep';
import AssetStep from './DirectorAssetStep';
import StoryboardStep from './DirectorStoryboardStep';
import RenderStep from './DirectorRenderStep';
import Lightbox from './Lightbox';
import CharacterLibrary from './CharacterLibrary';
import CharacterCreator from './CharacterCreator';
import MD3Select from './MD3Select';
import DirectorEpisodeSelector from './DirectorEpisodeSelector';
import DirectorAssetSelector from './DirectorAssetSelector';

interface DirectorAgentProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
  onAddScriptBoard: (contents: string[]) => void;
  tasks: GenerationTask[]; 
  onSubmitTask: (type: 'image' | 'video', params: any, agentTaskId?: string) => void;
  initialState?: WorkbenchState; 
  onStateChange?: (state: WorkbenchState) => void; 
}

type Step = 'SCRIPT' | 'ASSETS' | 'PRODUCTION' | 'VIDEO_GEN';

// 定义影子缓存结构
interface RemoteCacheEntry {
  url: string;
  expiresAt: number;
}

const DirectorAgent: React.FC<DirectorAgentProps> = ({ 
  isOpen, onClose, apiConfig, onAddScriptBoard, tasks, onSubmitTask, initialState, onStateChange 
}) => {
  // --- Episode Management State ---
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('');

  // --- Active Episode State (UI Bindings) ---
  const [step, setStep] = useState<Step>('SCRIPT');
  const [scriptInput, setScriptInput] = useState('');
  const [stylePreset, setStylePreset] = useState('');
  const [styleReferenceUrl, setStyleReferenceUrl] = useState<string | undefined>(undefined);
  const [assetBank, setAssetBank] = useState<AssetEntity[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  
  // 全局引擎配置状态
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [globalLLM, setGlobalLLM] = useState('gemini-3-flash');
  
  // 生图参数
  const [globalImgModel, setGlobalImgModel] = useState('nano-banana-fast');
  const [globalImgRatio, setGlobalImgRatio] = useState('16:9');
  const [globalImgSize, setGlobalImgSize] = useState('1K');

  // 视频参数
  const [globalVidEngine, setGlobalVidEngine] = useState<'yunwu' | 'backup'>('yunwu');
  const [globalVidRatio, setGlobalVidRatio] = useState('16:9');
  const [globalVidDuration, setGlobalVidDuration] = useState('15');

  // 核心优化：影子缓存，用于存储 1 小时内有效的远程 URL，避免重复上传
  const remoteUrlCache = useRef<Map<string, RemoteCacheEntry>>(new Map());
  
  // 修复 BUG：手动覆盖标记集合。记录哪些 ID 被用户手动修改过，防止被旧的任务状态自动覆盖。
  const manualOverrideIdsRef = useRef<Set<string>>(new Set());

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Character Library State
  const [isCharLibraryOpen, setIsCharLibraryOpen] = useState(false);
  const [bindingAssetId, setBindingAssetId] = useState<string | null>(null);
  
  // Character Creator State
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [tempSoraId, setTempSoraId] = useState('');

  // Asset Selector State (Reinstated)
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [selectorShotId, setSelectorShotId] = useState<string | null>(null);

  const uploadingAssetId = useRef<string | null>(null);
  const uploadingShotId = useRef<string | null>(null);

  // 用于防止同步反馈环的标识
  const isInternalUpdate = useRef(false);
  const isSwitchingEpisode = useRef(false);

  /**
   * 影子缓存核心工具函数
   * 确保获取一个有效的远程 URL 用于 API 调用，同时保护本地 Base64 状态
   */
  const ensureRemoteUrl = async (id: string, localUrl: string): Promise<string | null> => {
    if (!localUrl) return null;
    
    // 如果已经是 http 开头且不是本地 localhost (Capacitor 转换的)，直接返回
    if (localUrl.startsWith('http') && !localUrl.startsWith('data:') && !localUrl.startsWith('blob:') && !localUrl.includes('localhost') && !localUrl.includes('_cap_file_')) {
        return localUrl;
    }

    // 检查缓存
    const cached = remoteUrlCache.current.get(id);
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      return cached.url;
    }

    try {
      let file: File;

      // 🟢 针对 Android/iOS 原生环境且为 file:// 协议的处理
      if (Capacitor.isNativePlatform() && localUrl.startsWith('file://')) {
          const urlNoQuery = localUrl.split('?')[0];
          const path = decodeURIComponent(urlNoQuery.replace('file://', ''));
          const fileData = await Filesystem.readFile({ path });
          const base64Response = await fetch(`data:image/png;base64,${fileData.data}`);
          const blob = await base64Response.blob();
          file = new File([blob], `${id}.png`, { type: blob.type });
      } else {
          const res = await fetch(localUrl);
          const blob = await res.blob();
          file = new File([blob], `${id}.png`, { type: blob.type });
      }
      
      const uploadedUrl = await uploadFile(file, apiConfig);
      remoteUrlCache.current.set(id, {
        url: uploadedUrl,
        expiresAt: now + 3600000
      });
      return uploadedUrl;
    } catch (e) {
      console.error(`[Shadow Cache] 上传失败: ${id}`, e);
      return null;
    }
  };

  // --- Init & Migration Logic ---
  useEffect(() => {
    if (initialState && !isInternalUpdate.current && !isSwitchingEpisode.current) {
        if (initialState.version === 2 && initialState.episodes && initialState.episodes.length > 0) {
            // V2 Data Load
            setEpisodes(initialState.episodes);
            const activeId = initialState.activeEpisodeId || initialState.episodes[0].id;
            setActiveEpisodeId(activeId);
            
            const currentEp = initialState.episodes.find(e => e.id === activeId) || initialState.episodes[0];
            setStep(currentEp.lastActiveStep);
            setScriptInput(currentEp.data.scriptInput);
            setStylePreset(currentEp.data.stylePreset);
            setStyleReferenceUrl(currentEp.data.styleReferenceUrl);
            setAssetBank(currentEp.data.assetBank);
            setShots(currentEp.data.shots);
        } else {
            // Legacy Data Migration (V1 -> V2)
            const legacyEpId = 'ep_legacy_1';
            const legacyEp: Episode = {
                id: legacyEpId,
                name: '第 1 集',
                lastActiveStep: initialState.step || 'SCRIPT',
                updatedAt: Date.now(),
                data: {
                    scriptInput: initialState.scriptInput || '',
                    stylePreset: initialState.stylePreset || '',
                    styleReferenceUrl: initialState.styleReferenceUrl,
                    assetBank: initialState.assetBank || [],
                    shots: initialState.shots || []
                }
            };
            setEpisodes([legacyEp]);
            setActiveEpisodeId(legacyEpId);
            // Sync local state
            setStep(legacyEp.lastActiveStep);
            setScriptInput(legacyEp.data.scriptInput);
            setStylePreset(legacyEp.data.stylePreset);
            setStyleReferenceUrl(legacyEp.data.styleReferenceUrl);
            setAssetBank(legacyEp.data.assetBank);
            setShots(legacyEp.data.shots);
        }
    }
    isInternalUpdate.current = false;
    isSwitchingEpisode.current = false;
  }, [initialState, isOpen]);

  // --- Auto Save & Sync Logic ---
  useEffect(() => {
    if (onStateChange) {
        isInternalUpdate.current = true;
        
        const updatedEpisodes = episodes.map(ep => {
            if (ep.id === activeEpisodeId) {
                return {
                    ...ep,
                    lastActiveStep: step,
                    updatedAt: Date.now(),
                    data: {
                        scriptInput,
                        stylePreset,
                        styleReferenceUrl,
                        assetBank,
                        shots
                    }
                };
            }
            return ep;
        });

        if (updatedEpisodes.length === 0 && activeEpisodeId) {
             updatedEpisodes.push({
                id: activeEpisodeId,
                name: '第 1 集',
                lastActiveStep: step,
                updatedAt: Date.now(),
                data: { scriptInput, stylePreset, styleReferenceUrl, assetBank, shots }
             });
        }

        onStateChange({
            version: 2,
            activeEpisodeId,
            episodes: updatedEpisodes,
            step, // Fallback
            scriptInput, // Fallback
            stylePreset, // Fallback
            styleReferenceUrl, // Fallback
            assetBank, // Fallback
            shots // Fallback
        });
    }
  }, [step, scriptInput, stylePreset, styleReferenceUrl, assetBank, shots, activeEpisodeId, episodes.length]);

  // --- Episode Handlers ---
  const handleSwitchEpisode = (targetId: string) => {
      const updatedEpisodes = episodes.map(ep => {
          if (ep.id === activeEpisodeId) {
              return {
                  ...ep,
                  lastActiveStep: step,
                  updatedAt: Date.now(),
                  data: { scriptInput, stylePreset, styleReferenceUrl, assetBank, shots }
              };
          }
          return ep;
      });

      const targetEp = updatedEpisodes.find(e => e.id === targetId);
      if (!targetEp) return;

      isSwitchingEpisode.current = true;
      manualOverrideIdsRef.current.clear();

      setEpisodes(updatedEpisodes);
      setActiveEpisodeId(targetId);
      
      setStep(targetEp.lastActiveStep);
      setScriptInput(targetEp.data.scriptInput);
      setStylePreset(targetEp.data.stylePreset);
      setStyleReferenceUrl(targetEp.data.styleReferenceUrl);
      setAssetBank(targetEp.data.assetBank);
      setShots(targetEp.data.shots);
      
      toast.info(`已切换到：${targetEp.name}`);
  };

  const handleAddEpisode = () => {
      const currentEpisodes = episodes.map(ep => {
          if (ep.id === activeEpisodeId) {
              return {
                  ...ep,
                  lastActiveStep: step,
                  updatedAt: Date.now(),
                  data: { scriptInput, stylePreset, styleReferenceUrl, assetBank, shots }
              };
          }
          return ep;
      });

      const nextNum = currentEpisodes.length + 1;
      const newId = `ep_${Math.random().toString(36).substr(2, 9)}`;
      const newEp: Episode = {
          id: newId,
          name: `第 ${nextNum} 集`,
          lastActiveStep: 'SCRIPT',
          updatedAt: Date.now(),
          data: {
              scriptInput: '',
              stylePreset: '',
              assetBank: [],
              shots: []
          }
      };

      const newEpisodes = [...currentEpisodes, newEp];
      setEpisodes(newEpisodes);
      
      isSwitchingEpisode.current = true;
      manualOverrideIdsRef.current.clear();
      setActiveEpisodeId(newId);
      setStep('SCRIPT');
      setScriptInput('');
      setStylePreset('');
      setStyleReferenceUrl(undefined);
      setAssetBank([]);
      setShots([]);
      
      toast.success(`已创建 ${newEp.name}`);
  };

  const handleDeleteEpisode = (id: string) => {
      let nextEpisodes = episodes.filter(e => e.id !== id);
      if (nextEpisodes.length === 0) return; 

      let nextActiveId = activeEpisodeId;
      
      if (id === activeEpisodeId) {
          const deletedIndex = episodes.findIndex(e => e.id === id);
          const nextEp = nextEpisodes[deletedIndex - 1] || nextEpisodes[0];
          nextActiveId = nextEp.id;
          
          isSwitchingEpisode.current = true;
          manualOverrideIdsRef.current.clear();
          
          setStep(nextEp.lastActiveStep);
          setScriptInput(nextEp.data.scriptInput);
          setStylePreset(nextEp.data.stylePreset);
          setStyleReferenceUrl(nextEp.data.styleReferenceUrl);
          setAssetBank(nextEp.data.assetBank);
          setShots(nextEp.data.shots);
      }

      setEpisodes(nextEpisodes);
      setActiveEpisodeId(nextActiveId);
      toast.success('剧集已删除');
  };

  useEffect(() => {
    if (!isOpen) return;
    
    setAssetBank(prev => prev.map(asset => {
      if (manualOverrideIdsRef.current.has(asset.id)) return asset;
      const match = [...tasks].reverse().find(t => t.agentTaskId === asset.id);
      if (match) {
        if (match.status === 'succeeded' && match.results?.[0]) {
          const url = match.results[0].url;
          const freshUrl = `${url}${url.includes('?') ? '&' : '?'}t=${match.createdAt}`;
          return { ...asset, status: 'success', resultUrl: freshUrl };
        } else if (match.status === 'failed') {
          return { ...asset, status: 'failed' };
        } else if (match.status === 'running' || match.status === 'pending') {
          return { ...asset, status: 'generating' };
        }
      }
      return asset;
    }));

    setShots(prev => prev.map(shot => {
      let updatedShot = { ...shot };
      if (!manualOverrideIdsRef.current.has(shot.id)) {
          const imgMatch = [...tasks].reverse().find(t => t.agentTaskId === shot.id);
          if (imgMatch) {
            if (imgMatch.status === 'succeeded' && imgMatch.results?.[0]) {
              const url = imgMatch.results[0].url;
              updatedShot.status = 'success';
              updatedShot.resultUrl = `${url}${url.includes('?') ? '&' : '?'}t=${imgMatch.createdAt}`;
            } else if (imgMatch.status === 'failed') {
              updatedShot.status = 'failed';
            } else if (imgMatch.status === 'running' || imgMatch.status === 'pending') {
              updatedShot.status = 'generating';
            }
          }
      }
      
      const vidTasks = tasks.filter(t => t.agentTaskId === `${shot.id}_vid`);
      if (vidTasks.length > 0) {
        if (vidTasks.some(t => t.status === 'running' || t.status === 'pending')) {
          updatedShot.videoStatus = 'generating';
        } else if (vidTasks.some(t => t.status === 'succeeded')) {
          updatedShot.videoStatus = 'success';
        } else if (vidTasks.some(t => t.status === 'failed')) {
          updatedShot.videoStatus = 'failed';
        }

        let historySlots = [...(updatedShot.videoHistory || [])];
        vidTasks.forEach((vt, index) => {
            if (vt.status === 'succeeded' && vt.results?.[0]) {
                const url = vt.results[0].url;
                const freshUrl = `${url}${url.includes('?') ? '&' : '?'}t=${vt.createdAt}`;
                const slotIndex = index % 4;
                historySlots[slotIndex] = freshUrl;
                if (index === vidTasks.length - 1) {
                    updatedShot.videoUrl = freshUrl;
                }
            }
        });
        updatedShot.videoHistory = historySlots;
      }
      return updatedShot;
    }));
  }, [tasks, isOpen]);

  const handleAnalyze = async () => {
    if (!scriptInput.trim()) return toast.warning('请输入剧本内容');
    if (!apiConfig.key) return toast.warning('请配置 API Key');
    
    setIsAnalyzing(true);
    try {
        const response = await fetch(`${apiConfig.host}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({ 
                model: globalLLM, 
                messages: [{ role: 'system', content: SYSTEM_PROMPT_BUNDLE }, { role: 'user', content: scriptInput }],
                response_format: { type: "json_object" } 
            })
        });
        
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "{}";
        content = content.replace(/```json\s?|```/g, '').trim();
        const bundle = JSON.parse(content);

        const newAssetBank: AssetEntity[] = [
            ...(bundle.assets?.characters || []).map((a: any) => ({ ...a, id: `char_${Math.random().toString(36).substr(2, 9)}`, type: 'character', status: 'idle' })),
            ...(bundle.assets?.scenes || []).map((a: any) => ({ ...a, id: `scene_${Math.random().toString(36).substr(2, 9)}`, type: 'scene', status: 'idle' })),
            ...(bundle.assets?.items || []).map((a: any) => ({ ...a, id: `item_${Math.random().toString(36).substr(2, 9)}`, type: 'item', status: 'idle' }))
        ];
        setAssetBank(newAssetBank);

        const formattedShots: Shot[] = (bundle.shots || []).map((s: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            duration: s.duration || "15s",
            shotType: s.shotType || "中景",
            movement: s.movement || "固定",
            description: s.image_prompt || "", 
            videoPrompt: s.video_prompt || "",
            voiceover: s.voiceover || "",
            involvedAssetIds: (s.involved_assets || []).map((name: string) => newAssetBank.find(a => a.name === name)?.id).filter(Boolean),
            status: 'idle',
            videoStatus: 'idle',
            selected: true,
            videoHistory: []
        }));
        setShots(formattedShots);
        setStep('ASSETS'); 
    } catch (e: any) {
        toast.error(`分析失败: ${e.message}`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const generateAssetVisual = async (assetId: string) => {
    const asset = assetBank.find(a => a.id === assetId);
    if (!asset) return;
    manualOverrideIdsRef.current.delete(assetId);
    setAssetBank(prev => prev.map(a => a.id === assetId ? { ...a, status: 'generating' } : a));
    const stylePrefix = styleReferenceUrl ? "参考图片风格生成，" : "";
    const fullPrompt = `${stylePrefix}${stylePreset ? stylePreset + ", " : ""}${asset.description}`;
    const urls = styleReferenceUrl ? [styleReferenceUrl] : undefined;
    onSubmitTask('image', { 
      model: globalImgModel, 
      prompt: fullPrompt, 
      urls: urls,
      aspectRatio: globalImgRatio,
      imageSize: globalImgSize 
    }, asset.id);
  };

  const generateReferenceFrame = async (shotId: string) => {
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    manualOverrideIdsRef.current.delete(shotId);
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'generating' } : s));
    const remoteRefUrls = await Promise.all(
        shot.involvedAssetIds.map(async (aid) => {
            const asset = assetBank.find(a => a.id === aid);
            if (!asset?.resultUrl) return null;
            return await ensureRemoteUrl(asset.id, asset.resultUrl);
        })
    );
    const validRefUrls = remoteRefUrls.filter((u): u is string => !!u);
    onSubmitTask('image', { 
      model: globalImgModel, 
      prompt: shot.description, 
      urls: validRefUrls.length > 0 ? validRefUrls.slice(0, 4) : undefined, 
      aspectRatio: globalImgRatio, 
      imageSize: globalImgSize
    }, shot.id);
  };

  const generateFinalVideo = async (shotId: string) => {
    const shot = shots.find(s => s.id === shotId);
    if (!shot || !shot.resultUrl) return toast.warning("请先生成分镜参考图");
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, videoStatus: 'generating' } : s));
    const remoteInputUrl = await ensureRemoteUrl(shot.id, shot.resultUrl);
    const finalPrompt = shot.videoPrompt || shot.description;
    onSubmitTask('video', { 
      model: 'sora-2-all', 
      prompt: finalPrompt, 
      url: remoteInputUrl || undefined, 
      aspectRatio: globalVidRatio,
      duration: parseInt(globalVidDuration),
      engine: globalVidEngine 
    }, `${shot.id}_vid`);
  };

  // --- Clear Image Handlers ---
  const handleClearAssetImage = (id: string) => {
      manualOverrideIdsRef.current.delete(id);
      setAssetBank(prev => prev.map(a => a.id === id ? { ...a, status: 'idle', resultUrl: undefined } : a));
  };

  const handleClearShotImage = (id: string) => {
      manualOverrideIdsRef.current.delete(id);
      setShots(prev => prev.map(s => s.id === id ? { ...s, status: 'idle', resultUrl: undefined } : s));
  };

  const handleAssetUpload = async (id: string) => {
    // Background Logic: Clear image first before upload
    handleClearAssetImage(id);

    uploadingAssetId.current = id;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
       const file = e.target.files?.[0];
       if (!file) return;
       manualOverrideIdsRef.current.add(id);
       try {
         setAssetBank(prev => prev.map(a => a.id === id ? { ...a, status: 'generating' } : a));
         const url = await uploadFile(file, apiConfig);
         setAssetBank(prev => prev.map(a => a.id === id ? { ...a, status: 'success', resultUrl: url } : a));
       } catch (error: any) {
         setAssetBank(prev => prev.map(a => a.id === id ? { ...a, status: 'failed' } : a));
       }
    };
    input.click();
  };

  const handleShotUpload = async (id: string) => {
    // Background Logic: Clear image first before upload
    handleClearShotImage(id);

    uploadingShotId.current = id;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
       const file = e.target.files?.[0];
       if (!file) return;
       manualOverrideIdsRef.current.add(id);
       try {
         setShots(prev => prev.map(s => s.id === id ? { ...s, status: 'generating' } : s));
         const url = await uploadFile(file, apiConfig);
         setShots(prev => prev.map(s => s.id === id ? { ...s, status: 'success', resultUrl: url } : s));
       } catch (error: any) {
         setShots(prev => prev.map(s => s.id === id ? { ...s, status: 'failed' } : s));
       }
    };
    input.click();
  };

  const handleStitchUpload = useCallback(async (shotId: string, blob: Blob) => {
      // Clear image first for stitch upload too if consistent behavior is desired, 
      // but usually stitch overwrites. Let's stick to explicit upload buttons mostly.
      // For consistency with manual upload:
      handleClearShotImage(shotId);

      manualOverrideIdsRef.current.add(shotId);
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'generating' } : s));
      try {
          const file = new File([blob], `stitch_${shotId}.png`, { type: 'image/png' });
          const url = await uploadFile(file, apiConfig);
          setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'success', resultUrl: url } : s));
          toast.success('拼图已应用为参考图');
      } catch (e: any) {
          console.error(e);
          setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'failed' } : s));
          toast.error('上传参考图失败');
      }
  }, [apiConfig]);

  const handleStyleRefUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
              const url = await uploadFile(file, apiConfig);
              setStyleReferenceUrl(url);
              toast.success("风格参考图已应用");
          } catch (err) {
              toast.error("风格图上传失败");
          }
      };
      input.click();
  };

  const toggleAssetLink = (shotId: string, assetId: string) => {
      setShots(prev => prev.map(s => {
          if (s.id !== shotId) return s;
          const currentIds = s.involvedAssetIds || [];
          const exists = currentIds.includes(assetId);
          return { ...s, involvedAssetIds: exists ? currentIds.filter(id => id !== assetId) : [...currentIds, assetId] };
      }));
  };

  const handleOpenCharLibrary = (assetId: string) => {
    setBindingAssetId(assetId);
    setIsCharLibraryOpen(true);
  };

  const handleSelectCharacter = (char: { soraId: string, coverUrl: string }) => {
    if (!bindingAssetId) return;
    
    const assetToBind = assetBank.find(a => a.id === bindingAssetId);
    if (!assetToBind) return;

    const promptPrefix = `@${char.soraId} 这个人是${assetToBind.name}。\n`;
    manualOverrideIdsRef.current.add(bindingAssetId);

    setAssetBank(prev => prev.map(a => {
      if (a.id === bindingAssetId) {
        return { 
          ...a, 
          soraCharacterId: char.soraId,
          resultUrl: char.coverUrl || a.resultUrl, 
          status: 'success'
        };
      }
      return a;
    }));

    setShots(prev => prev.map(shot => {
        const isTarget = shot.involvedAssetIds.includes(bindingAssetId);
        return {
            ...shot,
            videoPrompt: isTarget ? (promptPrefix + (shot.videoPrompt || '')) : (shot.videoPrompt || ''),
            involvedAssetIds: shot.involvedAssetIds.filter(id => id !== bindingAssetId)
        };
    }));
    
    setIsCharLibraryOpen(false);
    setBindingAssetId(null);
    toast.success(`角色 ${assetToBind.name} 绑定成功，已同步分镜提示词`);
  };

  const handleCreatedCharacter = (id: string) => {
    setTempSoraId(id);
    setIsCreatorOpen(false);
    setIsCharLibraryOpen(true);
  };

  // Asset Selector Logic
  const handleOpenAssetSelector = (shotId: string) => {
      setSelectorShotId(shotId);
      setIsAssetSelectorOpen(true);
  };

  const handleToggleAssetFromSelector = (assetId: string) => {
      if (selectorShotId) {
          toggleAssetLink(selectorShotId, assetId);
      }
  };

  const llmOptions = [
    { label: 'Gemini 3.0 Flash', value: 'gemini-3-flash' },
    { label: 'Gemini 3.0 Pro', value: 'gemini-3-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  ];
  
  const imgOptions = [
    { label: 'Nano Banana Fast (极速)', value: 'nano-banana-fast' },
    { label: 'Nano Banana Pro (专业)', value: 'nano-banana-pro' },
  ];
  const imgRatioOptions = [
    { label: '16:9 (横屏)', value: '16:9' },
    { label: '9:16 (竖屏)', value: '9:16' },
    { label: '1:1 (方形)', value: '1:1' },
    { label: '4:3 (标准)', value: '4:3' },
    { label: '3:4 (竖向)', value: '3:4' },
  ];
  const imgSizeOptions = [
    { label: '1K (标准)', value: '1K' },
    { label: '2K (高清)', value: '2K' },
    { label: '4K (超清)', value: '4K' },
  ];

  const vidOptions = [
    { label: '云雾 Sora-2 ', value: 'yunwu' },
    { label: 'Grsai Sora-2 ', value: 'backup' },
  ];
  const vidRatioOptions = [
    { label: '16:9 (横屏)', value: '16:9' },
    { label: '9:16 (竖屏)', value: '9:16' },
  ];
  const vidDurationOptions = [
    { label: '10秒 ', value: '10' },
    { label: '15秒 ', value: '15' },
  ];

  return (
    <div className={`fixed inset-0 z-[220] bg-white dark:bg-[#0f172a] flex flex-col transition-all duration-300 transform ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {previewUrl && (
            <Lightbox url={previewUrl} type="image" onClose={() => setPreviewUrl(null)} />
        )}

        {isCharLibraryOpen && (
            <CharacterLibrary 
                isOpen={isCharLibraryOpen}
                onClose={() => { setIsCharLibraryOpen(false); setBindingAssetId(null); setTempSoraId(''); }}
                onSelect={handleSelectCharacter}
                apiConfig={apiConfig}
                onCreateCharacter={() => {
                    setIsCharLibraryOpen(false);
                    setIsCreatorOpen(true);
                }}
                initialSoraId={tempSoraId}
            />
        )}

        {isCreatorOpen && (
            <CharacterCreator
                isOpen={isCreatorOpen}
                onClose={() => setIsCreatorOpen(false)}
                apiConfig={apiConfig}
                onAddToLibrary={handleCreatedCharacter}
            />
        )}

        {/* Asset Selector Modal */}
        <DirectorAssetSelector 
            isOpen={isAssetSelectorOpen}
            onClose={() => setIsAssetSelectorOpen(false)}
            assets={assetBank}
            selectedAssetIds={selectorShotId ? (shots.find(s => s.id === selectorShotId)?.involvedAssetIds || []) : []}
            onToggle={handleToggleAssetFromSelector}
        />

        {/* 全局设置模态框 */}
        {isConfigOpen && (
            <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsConfigOpen(false)}>
                <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                            <i className="fa-solid fa-sliders text-rose-500"></i> 全局引擎配置
                        </h3>
                        {/* Close button for modal only, not agent */}
                        <button onClick={() => setIsConfigOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition flex items-center justify-center">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">剧本/分镜大模型 (LLM)</label>
                            <MD3Select value={globalLLM} options={llmOptions} onChange={setGlobalLLM} />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">生图引擎 (Image Gen)</label>
                            <MD3Select value={globalImgModel} options={imgOptions} onChange={setGlobalImgModel} />
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <MD3Select value={globalImgRatio} options={imgRatioOptions} onChange={setGlobalImgRatio} />
                                <MD3Select value={globalImgSize} options={imgSizeOptions} onChange={setGlobalImgSize} />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">视频引擎 (Video Gen)</label>
                            <MD3Select value={globalVidEngine} options={vidOptions} onChange={setGlobalVidEngine} />
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <MD3Select value={globalVidRatio} options={vidRatioOptions} onChange={setGlobalVidRatio} />
                                <MD3Select value={globalVidDuration} options={vidDurationOptions} onChange={setGlobalVidDuration} />
                            </div>
                        </div>
                    </div>

                    {/* New: Return to Canvas Button in Settings */}
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-white/5">
                        <button 
                            onClick={() => { setIsConfigOpen(false); onClose(); }} 
                            className="w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                            返回画布
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col shrink-0 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5 pt-[env(safe-area-inset-top)]">
            <div className="h-16 flex items-center justify-between px-3 md:px-4">
                <div className="flex items-center gap-2">
                    {/* 剧集管理组件 - Left side */}
                    <DirectorEpisodeSelector 
                        episodes={episodes}
                        activeEpisodeId={activeEpisodeId}
                        onSwitch={handleSwitchEpisode}
                        onAdd={handleAddEpisode}
                        onDelete={handleDeleteEpisode}
                    />
                    {/* Removed gear button from here */}
                </div>
                
                {/* 居中的导航圆圈 */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4 md:gap-8">
                    {(['SCRIPT', 'ASSETS', 'PRODUCTION', 'VIDEO_GEN'] as Step[]).map((s, i) => (
                        <button key={s} onClick={() => setStep(s)} className="flex flex-col items-center gap-0.5 group transition-all">
                            <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${step === s ? 'bg-rose-500 border-rose-500 text-white scale-110 shadow-lg' : 'border-slate-300 text-slate-400 dark:border-slate-700'}`}>{i + 1}</div>
                            <span className={`text-[8px] md:text-[10px] font-bold ${step === s ? 'text-rose-500' : 'text-slate-400'}`}>{s === 'SCRIPT' ? '剧本' : s === 'ASSETS' ? '资产' : s === 'PRODUCTION' ? '分镜' : '视频'}</span>
                        </button>
                    ))}
                </div>

                {/* Right side - Replaced Close Button with Settings Button */}
                <button 
                    onClick={() => setIsConfigOpen(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all active:scale-95"
                    title="全局引擎配置"
                >
                    <i className="fa-solid fa-gear text-xl"></i>
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col max-w-7xl mx-auto w-full p-4 md:p-8 relative bg-white dark:bg-[#0f172a]">
            {step === 'SCRIPT' && (
                <div key="step-script" className="w-full h-full bg-white dark:bg-[#0f172a]">
                  <ScriptStep 
                      stylePreset={stylePreset} setStylePreset={setStylePreset}
                      scriptInput={scriptInput} setScriptInput={setScriptInput}
                      isAnalyzing={isAnalyzing} onAnalyze={handleAnalyze}
                  />
                </div>
            )}

            {step === 'ASSETS' && (
                <div key="step-assets" className="w-full h-full bg-white dark:bg-[#0f172a]">
                  <AssetStep 
                      assetBank={assetBank}
                      stylePreset={stylePreset}
                      styleReferenceUrl={styleReferenceUrl}
                      onBatchGenerate={() => assetBank.forEach(a => {
                          if (a.status !== 'success' && a.status !== 'generating') {
                              generateAssetVisual(a.id);
                          }
                      })}
                      onGenerateOne={generateAssetVisual}
                      onUpload={handleAssetUpload}
                      onBindCharacter={handleOpenCharLibrary}
                      onUploadStyleRef={handleStyleRefUpload}
                      onClearStyleRef={() => setStyleReferenceUrl(undefined)}
                      onStartEdit={(id, content) => { setEditingItemId(id); setEditContent(content); }}
                      onSaveEdit={(id) => {
                          setAssetBank(prev => prev.map(a => a.id === id ? { ...a, description: editContent } : a));
                          setEditingItemId(null);
                      }}
                      onCancelEdit={() => setEditingItemId(null)}
                      editingItemId={editingItemId}
                      editContent={editContent}
                      setEditContent={setEditContent}
                      onNextStep={() => setStep('PRODUCTION')}
                      onPreview={(url) => setPreviewUrl(url)}
                      onClearImage={handleClearAssetImage}
                  />
                </div>
            )}

            {step === 'PRODUCTION' && (
                <div key="step-prod" className="w-full h-full bg-white dark:bg-[#0f172a]">
                  <StoryboardStep 
                      shots={shots}
                      assetBank={assetBank}
                      onBatchGenerate={() => shots.forEach(s => {
                          if (s.status !== 'success' && s.status !== 'generating') {
                              generateReferenceFrame(s.id);
                          }
                      })}
                      onGenerateOne={generateReferenceFrame}
                      onUpload={handleShotUpload}
                      onStartEdit={(id, content) => { setEditingItemId(id); setEditContent(content); }}
                      onSaveEdit={(id) => {
                          setShots(prev => prev.map(s => {
                              if (s.id === id) {
                                  // Determine if we are editing image prompt or video prompt based on view logic inside component
                                  // For simplicity, we assume generic description update, but component splits logic.
                                  // Here we just update description for now as it's the primary editable field in image phase
                                  return { ...s, description: editContent }; 
                              }
                              return s;
                          }));
                          setEditingItemId(null);
                      }}
                      onCancelEdit={() => setEditingItemId(null)}
                      editingItemId={editingItemId}
                      editContent={editContent}
                      setEditContent={setEditContent}
                      onAddAsset={handleOpenAssetSelector} // Replaced mock with modal handler
                      onToggleAssetLink={toggleAssetLink}
                      onNextStep={() => setStep('VIDEO_GEN')}
                      onPreview={(url) => setPreviewUrl(url)}
                      onStitchUpload={handleStitchUpload}
                      onClearImage={handleClearShotImage}
                  />
                </div>
            )}

            {step === 'VIDEO_GEN' && (
                <div key="step-video" className="w-full h-full bg-white dark:bg-[#0f172a]">
                  <RenderStep 
                      shots={shots}
                      onRenderOne={generateFinalVideo}
                      onRenderAll={() => shots.forEach(s => {
                          if (s.videoStatus !== 'success' && s.videoStatus !== 'generating' && s.resultUrl) {
                              generateFinalVideo(s.id);
                          }
                      })}
                      onExport={() => onAddScriptBoard(shots.map(s => `[${s.id}] ${s.videoPrompt || s.description}`))}
                      onPreview={(url) => setPreviewUrl(url)}
                      editingItemId={editingItemId}
                      editContent={editContent}
                      setEditContent={setEditContent}
                      onStartEdit={(id, content) => { setEditingItemId(id); setEditContent(content); }}
                      onSaveEdit={(id) => {
                          setShots(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: editContent } : s));
                          setEditingItemId(null);
                      }}
                  />
                </div>
            )}
        </div>
    </div>
  );
};

export default DirectorAgent;
