
export enum ElementType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
  SCRIPT_BOARD = 'SCRIPT_BOARD', // New type
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  src: string;
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number; 
  locked?: boolean;
  poster?: string;
  scripts?: string[]; // Array of script contents for SCRIPT_BOARD
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface PointerState {
  id: number;
  x: number;
  y: number;
}

export interface StorageConfig {
  r2WorkerUrl?: string;
  r2Token?: string;
  enabled: boolean;
}

export interface ApiConfig {
  host: string;
  key: string;
  secondaryHost?: string;
  secondaryKey?: string;
  activeProvider?: string;
  storage?: StorageConfig;
  yunwuKey?: string; // 新增云雾 Key
}

export interface TaskResult {
  url: string;
  type?: string; 
}

export interface GenerationTask {
  id: string | null;
  type: 'image' | 'video';
  engine?: 'yunwu' | 'backup'; // 新增引擎标识
  prompt: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  progress: number;
  msg?: string;
  results?: TaskResult[];
  createdAt: number;
  poster?: string;
  agentTaskId?: string; // 关联导演助手的内部资产/分镜 ID
}

export interface UploadResponse {
  code: number;
  data: {
    token: string;
    key: string;
    url?: string;
    upload_url: string;
    domain: string;
  };
}

// 提取 AssetEntity 和 Shot 到全局类型，方便持久化
export interface AssetEntity {
  id: string;
  name: string;
  description: string;
  type: 'character' | 'scene' | 'item';
  resultUrl?: string;
  status: 'idle' | 'generating' | 'success' | 'failed';
  soraCharacterId?: string; // 新增：绑定的 Sora 角色 ID
}

export interface Shot {
  id: string;
  duration: string;
  shotType: string;
  movement: string;
  description: string;
  videoPrompt?: string;
  voiceover: string;
  involvedAssetIds: string[];
  status: 'idle' | 'generating' | 'success' | 'failed';
  videoStatus: 'idle' | 'generating' | 'success' | 'failed';
  resultUrl?: string;
  videoUrl?: string;
  videoHistory?: string[];
  selected: boolean;
}

// 新增：单集数据结构
export interface Episode {
  id: string;
  name: string;
  lastActiveStep: 'SCRIPT' | 'ASSETS' | 'PRODUCTION' | 'VIDEO_GEN';
  data: {
    scriptInput: string;
    stylePreset: string;
    styleReferenceUrl?: string;
    assetBank: AssetEntity[];
    shots: Shot[];
  };
  updatedAt: number;
}

export interface WorkbenchState {
  // --- Legacy Fields (兼容旧数据) ---
  step?: 'SCRIPT' | 'ASSETS' | 'PRODUCTION' | 'VIDEO_GEN';
  scriptInput?: string;
  stylePreset?: string;
  styleReferenceUrl?: string; // 新增：全局风格参考图
  assetBank?: AssetEntity[];
  shots?: Shot[];

  // --- V2 Fields (多剧集支持) ---
  version?: number; // 2
  activeEpisodeId?: string;
  episodes?: Episode[];
}

export interface Project {
  id: string;
  name: string;
  elements: CanvasElement[];
  workbenchState?: WorkbenchState; // 新增：工作台进度
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  id: string;
  type: 'image' | 'video';
  url: string;
  cloudUrl?: string; // 云端持久地址
  prompt: string;
  poster?: string;
  createdAt: number;
}

export type MenuAction = 
  | 'REF_IMAGE' 
  | 'REF_VIDEO' 
  | 'REF_GACHA' 
  | 'GEN_VIEW' 
  | 'EDIT_TEXT'
  | 'TXT2IMG'
  | 'TXT2VID'
  | 'SPLIT_STORYBOARD'
  | 'SAVE' 
  | 'TOGGLE_LOCK'
  | 'DELETE'
  | 'SAVE_TO_LIBRARY'
  | 'FUSION_REF_IMAGE' 
  | 'FUSION_REF_VIDEO';
