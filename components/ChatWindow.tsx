
import React, { useState, useEffect, useRef } from 'react';
import { ApiConfig } from '../types';
import MD3Select from './MD3Select';

interface ChatWindowProps {
  apiConfig: ApiConfig;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenCharacterAgent: () => void;
  onOpenStoryboardAgent: () => void;
}

const GeminiIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    height="1.1em" 
    width="1.1em" 
    viewBox="0 0 24 24" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flex: 'none', lineHeight: 1 }}
  >
    <title>Gemini</title>
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path>
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#lobe-icons-gemini-fill-0)"></path>
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#lobe-icons-gemini-fill-1)"></path>
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#lobe-icons-gemini-fill-2)"></path>
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-gemini-fill-0" x1="7" x2="11" y1="15.5" y2="12">
        <stop stopColor="#08B962"></stop>
        <stop offset="1" stopColor="#08B962" stopOpacity="0"></stop>
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-gemini-fill-1" x1="8" x2="11.5" y1="5.5" y2="11">
        <stop stopColor="#F94543"></stop>
        <stop offset="1" stopColor="#F94543" stopOpacity="0"></stop>
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-gemini-fill-2" x1="3.5" x2="17.5" y1="13.5" y2="12">
        <stop stopColor="#FABC12"></stop>
        <stop offset=".46" stopColor="#FABC12" stopOpacity="0"></stop>
      </linearGradient>
    </defs>
  </svg>
);

const ChatWindow: React.FC<ChatWindowProps> = ({ apiConfig, isOpen, onClose, onOpenSettings, onOpenCharacterAgent, onOpenStoryboardAgent }) => {
  const [history, setHistory] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gemini-3-flash');
  const [isResponding, setIsResponding] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  
  const winRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history, streamingContent, isOpen]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(40, newHeight)}px`;
    }
  }, [input]);

  useEffect(() => {
    const makeDraggable = (element: HTMLElement | null, handle: HTMLElement | null) => {
      if (!element || !handle) return;
      
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;

      const onPointerDown = (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON' && (e.target as HTMLElement) !== handle) return;
        e.preventDefault();
        isDragging = true;
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (err) {
          console.warn('Failed to capture pointer', err);
        }
        
        // Reset transform to absolute positioning on first drag if centered
        if (element.style.left === '50%' || element.style.left === '') {
             const rect = element.getBoundingClientRect();
             element.style.transform = 'scale(1)';
             element.style.left = rect.left + 'px';
             element.style.top = rect.top + 'px';
        }
        
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = (initialLeft + dx) + 'px';
        element.style.top = (initialTop + dy) + 'px';
      };

      const onPointerUp = (e: PointerEvent) => {
        isDragging = false;
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch (err) {}
      };

      handle.addEventListener('pointerdown', onPointerDown as EventListener);
      handle.addEventListener('pointermove', onPointerMove as EventListener);
      handle.addEventListener('pointerup', onPointerUp as EventListener);
      handle.addEventListener('pointercancel', onPointerUp as EventListener);

      return () => {
        handle.removeEventListener('pointerdown', onPointerDown as EventListener);
        handle.removeEventListener('pointermove', onPointerMove as EventListener);
        handle.removeEventListener('pointerup', onPointerUp as EventListener);
        handle.removeEventListener('pointercancel', onPointerUp as EventListener);
      };
    };

    const cleanupWindow = makeDraggable(winRef.current, headerRef.current);
    return () => {
        if (cleanupWindow) cleanupWindow();
    };
  }, []);

  useEffect(() => {
    if (!isOpen && winRef.current) {
        if (winRef.current.style.left && winRef.current.style.left !== '50%') {
             winRef.current.style.transform = 'scale(1)';
        }
    }
  }, [isOpen]);

  const clearChat = () => {
    setHistory([]);
    setStreamingContent('');
    const Swal = (window as any).Swal;
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success', 
            title: '对话已清空', 
            toast: true, 
            position: 'top', 
            timer: 1500, 
            background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
            color: document.documentElement.classList.contains('dark') ? '#fff' : '#1e293b',
            showConfirmButton: false
        });
    }
  };

  const copyToClipboard = async (text: string, btnId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById(btnId);
      if(btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => btn.innerHTML = original, 1500);
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const performApiCall = async (messages: {role: string, content: string}[]) => {
    setIsResponding(true);
    setStreamingContent('');

    try {
        const response = await fetch(`${apiConfig.host}/v1/chat/completions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${apiConfig.key}` 
            },
            body: JSON.stringify({ 
                model: model, 
                stream: true, 
                messages: messages 
            })
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr.trim() === '[DONE]') break;
                    try {
                        const data = JSON.parse(jsonStr);
                        const content = data.choices[0]?.delta?.content || "";
                        fullText += content;
                        setStreamingContent(fullText);
                    } catch (e) {}
                }
            }
        }
        setHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
        setStreamingContent('');
    } catch (e: any) {
        setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
        setIsResponding(false);
    }
  };

  const showApiKeyWarning = () => {
    const Swal = (window as any).Swal;
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'info',
            title: '请先配置 API Key',
            text: '需要 API Key 才能与 Gemini 对话',
            timer: 2000,
            showConfirmButton: false,
            background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
            color: document.documentElement.classList.contains('dark') ? '#fff' : '#1e293b',
            toast: true,
            position: 'top'
        });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isResponding) return;
    if (!apiConfig.key) {
        showApiKeyWarning();
        onOpenSettings();
        return;
    }
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    await performApiCall(newHistory);
  };

  const regenerateMessage = async (index: number) => {
    if (isResponding) return;
    if (!apiConfig.key) {
        showApiKeyWarning();
        onOpenSettings();
        return;
    }
    const context = history.slice(0, index);
    setHistory(context);
    await performApiCall(context);
  };

  const renderMarkdown = (text: string) => {
    const marked = (window as any).marked;
    if (typeof marked !== 'undefined') {
        return { __html: marked.parse(text) };
    }
    return { __html: text };
  };

  const modelOptions = [
    { label: 'gemini-3-pro', value: 'gemini-3-pro' },
    { label: 'gemini-3-flash', value: 'gemini-3-flash' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
  ];

  return (
    <>
      <style>{`
        #chat-window {
            position: fixed; top: 50%; left: 50%; 
            width: 440px; height: 620px; 
            max-width: 90vw; max-height: 85vh;
            background: white;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 24px;
            z-index: 200;
            display: flex; flex-direction: column;
            opacity: 0; pointer-events: none;
            transform: translate(-50%, -50%) scale(0.95);
            transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .dark #chat-window {
            background: #1e293b;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        #chat-window.active { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .welcome-anim { animation: fadeInUp 0.6s ease-out 0.2s forwards; opacity: 0; }
        .msg-bubble { 
            position: relative; padding: 10px 14px 24px 14px; 
            border-radius: 16px; font-size: 14px; line-height: 1.6; 
            max-width: 88%; word-break: break-word; user-select: text; 
        }
        .msg-user { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .msg-ai { background: white; color: #1e293b; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid rgba(0,0,0,0.1); }
        .dark .msg-ai { background: rgba(255, 255, 255, 0.08); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.05); }
        .msg-ai p { margin-bottom: 8px; } .msg-ai p:last-child { margin-bottom: 0; }
        .msg-ai pre { background: #f1f5f9; color: #334155; padding: 10px; border-radius: 8px; overflow-x: auto; margin: 6px 0; font-family: monospace; font-size: 12px; border: 1px solid rgba(0,0,0,0.1); }
        .dark .msg-ai pre { background: rgba(0,0,0,0.3); color: #f1f5f9; border: 1px solid rgba(255,255,255,0.1); }
        .msg-ai code { background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; font-family: monospace; color: #d97706; font-size: 0.9em; }
        .dark .msg-ai code { background: rgba(255,255,255,0.1); color: #fbbf24; }
        .msg-actions { position: absolute; bottom: 4px; right: 8px; display: flex; gap: 6px; opacity: 0.4; transition: opacity 0.2s; }
        .msg-bubble:hover .msg-actions { opacity: 1; }
        .action-btn { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: inherit; cursor: pointer; font-size: 10px; background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.1); transition: all 0.2s; }
        .dark .action-btn { background: rgba(0,0,0,0.1); border: 1px solid rgba(255, 255, 255, 0.1); }
        .action-btn:hover { background: rgba(0,0,0,0.1); transform: scale(1.1); }
        .dark .action-btn:hover { background: rgba(255,255,255,0.2); }
        .msg-user .action-btn { color: white; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); }
      `}</style>
      <div ref={winRef} id="chat-window" className={isOpen ? 'active' : ''}>
        <div ref={headerRef} className="h-16 flex items-center justify-between px-5 shrink-0 bg-slate-50 dark:bg-white/5 border-b border-black/5 dark:border-white/5 cursor-move rounded-t-3xl touch-none">
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="font-bold tracking-wide text-base bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-400 flex items-center gap-2">
                    <GeminiIcon className="text-xl" /> Gemini Box
                </span>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={onOpenSettings} onPointerDown={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition flex items-center justify-center" title="API Settings"><i className="fa-solid fa-gear text-xs"></i></button>
                <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition flex items-center justify-center" title="Close"><i className="fa-solid fa-xmark text-sm"></i></button>
            </div>
        </div>
        <div className="flex-1 flex flex-col px-4 pb-4 overflow-hidden">
            <div className="shrink-0 mb-3 flex justify-end w-40 ml-auto z-10">
                <MD3Select value={model} options={modelOptions} onChange={(val) => setModel(val)} className="w-full" />
            </div>
            <div ref={historyRef} className="flex-1 bg-slate-50 dark:bg-black/10 rounded-2xl p-4 overflow-y-auto flex flex-col gap-4 border border-black/5 dark:border-white/5 custom-scroll mb-3">
                {history.length === 0 && (
                    <div className="text-center text-slate-500 text-xs py-10 flex flex-col items-center gap-2 welcome-anim h-full justify-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 ring-1 ring-black/5 dark:ring-white/10"><GeminiIcon className="text-4xl" /></div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">欢迎使用 Gemini Box</h3>
                        <p className="max-w-[240px] Math.leading-relaxed text-slate-500 dark:text-slate-400">我是您的 AI 创意助手。配置 API Key 后，我可以帮您生成提示词、撰写脚本或解答疑问。</p>
                        <button onClick={onOpenSettings} className="mt-2 text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 underline underline-offset-4 decoration-purple-500/30 transition-colors cursor-pointer">立即配置 API</button>
                    </div>
                )}
                {history.map((msg, i) => (
                    <div key={i} className={`msg-bubble ${msg.role === 'user' ? 'msg-user' : 'msg-ai'}`}>
                        <div dangerouslySetInnerHTML={msg.role === 'assistant' ? renderMarkdown(msg.content) : { __html: msg.content }} />
                        <div className="msg-actions">
                            <div id={`btn-copy-${i}`} className="action-btn" onClick={() => copyToClipboard(msg.content, `btn-copy-${i}`)} title="复制"><i className="fa-regular fa-copy"></i></div>
                            {msg.role === 'assistant' && (
                                <div className="action-btn" onClick={() => regenerateMessage(i)} title="重新生成"><i className="fa-solid fa-rotate-right"></i></div>
                            )}
                        </div>
                    </div>
                ))}
                {isResponding && (
                    <div className="msg-bubble msg-ai w-fit">
                        {streamingContent ? ( <div dangerouslySetInnerHTML={renderMarkdown(streamingContent)} /> ) : (
                             <div className="flex gap-1 px-1">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                             </div>
                        )}
                    </div>
                )}
            </div>
            <div className="relative shrink-0 flex items-center gap-2">
                <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} className="flex-1 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all dark:text-white custom-scroll" placeholder="输入你想说的话..." style={{ minHeight: '40px' }} />
                <button onClick={sendMessage} disabled={isResponding || !input.trim()} className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 transition flex items-center justify-center disabled:opacity-50"><i className="fa-solid fa-paper-plane text-xs"></i></button>
            </div>
            <div className="flex justify-between mt-2 px-2 items-center">
                 <div className="flex gap-2">
                     <button onClick={onOpenCharacterAgent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-700/50 text-purple-600 dark:text-purple-300 transition-all text-[10px] font-bold"><div className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center"><i className="fa-solid fa-user-pen text-[8px]"></i></div>角色设计</button>
                     <button onClick={onOpenStoryboardAgent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 text-emerald-600 dark:text-emerald-300 transition-all text-[10px] font-bold"><div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center"><i className="fa-solid fa-clapperboard text-[8px]"></i></div>分镜大师</button>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">GEMINI BOX</span>
                    <button onClick={clearChat} className="text-[10px] text-slate-500 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 transition" title="清空对话"><i className="fa-solid fa-trash"></i></button>
                 </div>
            </div>
        </div>
      </div>
    </>
  );
};
export default ChatWindow;
