
import { ApiConfig } from '../types';

const BASE_URL = "https://yunwu.ai/v1/video";
const UPLOAD_URL = "https://imageproxy.zhongzhuan.chat/api/upload";

/**
 * 递归查找对象中的视频 URL
 */
function findUrlInObject(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') {
      if (obj.startsWith('http') && (obj.includes('.mp4') || obj.includes('oss') || obj.includes('cdn') || obj.includes('yunwu'))) return obj;
      return null;
  }
  if (typeof obj === 'object') {
      for (let key in obj) {
          const res = findUrlInObject(obj[key]);
          if (res) return res;
      }
  }
  return null;
}

/**
 * 上传图片到 Yunwu 指定图床
 */
export const uploadToYunwu = async (file: File, config: ApiConfig): Promise<string> => {
  if (!config.yunwuKey) throw new Error('Yunwu API Key is missing');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.yunwuKey}` },
      body: formData
    });
    
    const data = await res.json();
    const url = data.url || (data.data && data.data.url) || data.path;
    
    if (!url) throw new Error('图床未返回有效 URL');
    return url;
  } catch (e: any) {
    throw new Error(`Yunwu Upload Failed: ${e.message}`);
  }
};

/**
 * 创建 Yunwu 视频任务
 */
export const createYunwuTask = async (params: any, config: ApiConfig): Promise<string> => {
  if (!config.yunwuKey) throw new Error('Yunwu API Key is missing');

  const payload = {
    model: "sora-2-all",
    prompt: params.prompt || "video",
    orientation: params.aspectRatio === '9:16' ? 'portrait' : 'landscape',
    size: "large",
    duration: params.duration || 10,
    watermark: false,
    private: true,
    images: params.url ? [params.url] : []
  };

  const res = await fetch(`${BASE_URL}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.yunwuKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (res.ok && data.id) {
    return data.id;
  }
  throw new Error(data.message || JSON.stringify(data));
};

/**
 * 轮询 Yunwu 任务状态，适配为通用格式
 */
export const pollYunwuTask = async (taskId: string, config: ApiConfig) => {
  if (!config.yunwuKey) throw new Error('Yunwu API Key is missing');

  const res = await fetch(`${BASE_URL}/query?id=${taskId}`, {
    headers: { 'Authorization': `Bearer ${config.yunwuKey}` }
  });
  
  const data = await res.json();
  
  const statusRaw = (data.status || 'UNKNOWN').toLowerCase();
  let status = 'running';
  let failure_reason = '';
  let results: any[] = [];

  if (statusRaw === 'succeeded' || statusRaw === 'completed' || statusRaw === 'success') {
    status = 'succeeded';
    const videoUrl = findUrlInObject(data);
    if (videoUrl) {
      results = [{ url: videoUrl }];
    } else {
      // 成功但没找到 URL，视为失败
      status = 'failed';
      failure_reason = 'Task succeeded but no video URL found';
    }
  } else if (statusRaw === 'failed') {
    status = 'failed';
    failure_reason = data.message || 'Task failed';
  }

  // 构造适配 App.tsx 的返回格式
  return {
    code: 0,
    data: {
      status,
      progress: status === 'succeeded' ? 100 : 50,
      failure_reason,
      results
    }
  };
};
