import React from 'react';
import { formatMediaUrl } from '../utils/url';

interface LightboxProps {
  url: string | null;
  type: 'image' | 'video' | null;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ url, type, onClose }) => {
  if (!url) return null;
  
  // 核心修复：此处进行转换，无论传入的是 file:// 还是 http://，都能在 WebView 中正确显示
  const mediaUrl = formatMediaUrl(url);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div 
        onClick={onClose}
        className="absolute top-5 right-5 text-white text-3xl cursor-pointer p-4 hover:text-red-400 transition-colors z-[210]"
      >
        <i className="fa-solid fa-xmark"></i>
      </div>
      
      <div className="max-w-[95%] max-h-[85%] relative flex items-center justify-center">
        {type === 'image' && (
          <img 
            src={mediaUrl} 
            alt="Full view" 
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10 object-contain"
            onError={(e) => {
              // 预览图加载失败时的兜底
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = '<div class="text-white text-center"><i class="fa-solid fa-triangle-exclamation text-4xl mb-2 text-yellow-500"></i><p>原文件已丢失或无法读取</p></div>';
            }}
          />
        )}
        {type === 'video' && (
          <video 
            src={mediaUrl} 
            controls 
            autoPlay 
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10"
          />
        )}
      </div>
    </div>
  );
};

export default Lightbox;