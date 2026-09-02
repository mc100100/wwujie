import { Capacitor } from '@capacitor/core';

/**
 * 格式化媒体 URL。
 * 如果是 file:// 协议的本地路径或绝对路径，则使用 Capacitor 转换为 WebView 可用的地址。
 * 这样做可以避免将 http://localhost 等临时映射地址存入数据库导致重启后失效。
 */
export const formatMediaUrl = (url: string | undefined): string => {
  if (!url) return '';
  
  // 1. 如果是 http/https/data/blob，直接返回
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // 2. 原生平台处理 (Android/iOS)
  if (Capacitor.isNativePlatform()) {
    // 兼容 file:// 开头的 URI 和以 / 开头的绝对路径
    if (url.startsWith('file://') || url.startsWith('/')) {
      return Capacitor.convertFileSrc(url);
    }
  }
  
  return url;
};