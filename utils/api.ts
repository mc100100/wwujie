
import { ApiConfig, UploadResponse, StorageConfig } from '../types';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * 默认上传逻辑（临时保存至 Grsai 服务器）
 */
export const uploadFile = async (file: File, config: ApiConfig): Promise<string> => {
  if (!config.key) throw new Error('API Key is missing');
  const sux = file.name.split('.').pop() || 'png';
  
  const tokenRes = await fetch(`${config.host}/client/resource/newUploadTokenZH`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`
    },
    body: JSON.stringify({ sux })
  });
  
  const tokenData: UploadResponse = await tokenRes.json();
  if (tokenData.code !== 0 && (tokenData as any).msg) {
     throw new Error((tokenData as any).msg);
  }
  
  const d = tokenData.data;
  const fd = new FormData();
  fd.append('token', d.token);
  fd.append('key', d.key);
  fd.append('file', file);
  
  await fetch(d.url || d.upload_url, {
    method: 'POST',
    body: fd
  });

  const domain = d.domain.endsWith('/') ? d.domain : d.domain + '/';
  return domain + d.key;
};

/**
 * 带进度监控的上传逻辑 (XHR 实现)
 * timeout: 180s
 */
export const uploadFileWithProgress = async (
  file: File, 
  config: ApiConfig,
  onProgress: (percent: number) => void
): Promise<string> => {
  if (!config.key) throw new Error('API Key is missing');
  const sux = file.name.split('.').pop() || 'mp4';

  // 1. 获取上传 Token (保持 Fetch，因为这步很快)
  const tokenRes = await fetch(`${config.host}/client/resource/newUploadTokenZH`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`
    },
    body: JSON.stringify({ sux })
  });

  const tokenData: UploadResponse = await tokenRes.json();
  if (tokenData.code !== 0 && (tokenData as any).msg) {
     throw new Error((tokenData as any).msg);
  }

  const d = tokenData.data;
  const fd = new FormData();
  fd.append('token', d.token);
  fd.append('key', d.key);
  fd.append('file', file);

  // 2. 使用 XMLHttpRequest 上传文件以获取进度
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', d.url || d.upload_url);
    xhr.timeout = 180000; // 180秒超时

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const domain = d.domain.endsWith('/') ? d.domain : d.domain + '/';
        resolve(domain + d.key);
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out (180s)'));

    xhr.send(fd);
  });
};

/**
 * Cloudflare R2 私人网关同步逻辑 (方案 A)
 * 修正了对 Capacitor 原生路径的处理和 Fetch 兼容性
 */
export const uploadToR2 = async (url: string, storage: StorageConfig): Promise<string> => {
  if (!storage.r2WorkerUrl) throw new Error('未配置 R2 Worker 终端地址');

  let blob: Blob;

  // 1. 处理文件数据获取
  try {
    if (Capacitor.isNativePlatform() && url.startsWith('http') && (url.includes('_cap_file_') || url.includes('localhost'))) {
      // 如果是原生路径，需要通过 Filesystem 读取
      const path = url.split('?')[0].replace(/^.*?\/_cap_file_/, '');
      const fileData = await Filesystem.readFile({ path });
      const base64Res = await fetch(`data:application/octet-stream;base64,${fileData.data}`);
      blob = await base64Res.blob();
    } else {
      // 普通网络路径或 Blob 路径
      const res = await fetch(url);
      blob = await res.blob();
    }
  } catch (e) {
    throw new Error(`无法读取原始文件数据: ${e instanceof Error ? e.message : '未知错误'}`);
  }
  
  // 2. 构造文件名
  const ext = blob.type.split('/')[1] || 'png';
  const fileName = `grsai-sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
  
  // 3. 构建上传请求
  const workerEndpoint = storage.r2WorkerUrl.endsWith('/') 
    ? storage.r2WorkerUrl 
    : `${storage.r2WorkerUrl}/`;
    
  const targetUrl = `${workerEndpoint}${fileName}`;

  // 4. 发送 PUT 请求
  const response = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': blob.type,
      // 双重保险：同时发送 Token 和 Bearer Auth
      'X-Auth-Token': storage.r2Token || '', 
      'Authorization': storage.r2Token ? `Bearer ${storage.r2Token}` : ''
    },
    body: blob
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 网关响应异常 (${response.status}): ${errorText || '请检查 Worker 是否配置 CORS'}`);
  }

  return targetUrl;
};

export const createGenerationTask = async (
  type: 'image' | 'video',
  params: any,
  config: ApiConfig
): Promise<string> => {
  if (!config.key) throw new Error('API Key is missing');
  const endpoint = type === 'image' ? '/v1/draw/nano-banana' : '/v1/video/sora-video';
  const body = { ...params, webHook: "-1", shutProgress: false };
  const res = await fetch(`${config.host}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.code === 0) return data.data.id;
  throw new Error(data.msg || 'Task creation failed');
};

export const pollTaskResult = async (taskId: string, config: ApiConfig) => {
  const res = await fetch(`${config.host}/v1/draw/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify({ id: taskId })
  });
  return await res.json();
};

export const createCharacterTask = async (
  params: { url: string; timestamps: string },
  config: ApiConfig
): Promise<string> => {
  if (!config.key) throw new Error('API Key is missing');
  const res = await fetch(`${config.host}/v1/video/sora-upload-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify({ ...params, webHook: "-1" })
  });
  const rawText = await res.text();
  let data;
  try { data = JSON.parse(rawText.replace(/^data:\s*/, '')); } catch (e) { throw new Error(`API Response Parse Error`); }
  if (data.code === 0) return data.data.id;
  throw new Error(data.msg || data.error || 'Character creation failed');
};
