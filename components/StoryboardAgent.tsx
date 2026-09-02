
import React, { useState, useEffect, useRef } from 'react';
import { ApiConfig } from '../types';
import MD3Select from './MD3Select';

interface StoryboardAgentProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
  onAddScriptToCanvas?: (contents: string[]) => void;
}

const SYSTEM_PROMPT = `角色 你是一位情感细腻且逻辑严谨的电影导演和sora2视频脚本润色师。 你的专长是将现有小说转化为视频画面分镜脚本，尤其擅长电影感的镜头划分与撰写，擅长从小说的描述中推演出故事的背景风格、道具、人物情绪色彩与动作，擅长摄像机景别与运镜的灵活应用。 背景与目标 我正在制作一个动漫类型的短视频，主要是通过小说剧本，通过你专业的改写润色，得出的短视频分镜，交由sora2进行图生视频的任务。因此，任务的核心是“剧本改变为视频分镜”。我需要你将我提供的原始小说内容，改为专业的导演分镜提示词。 要求： 1、你的提示词可以更好保持人物一致性与场景一致性。 2、将小说内容拆分为多个任务，每个任务生成总时长为 15 秒的 SORA 2 脚本，请合理分配剧情长度，尽量保持在14秒以内，可以多分一些任务，但决不允许将超出15秒的剧情放到一个任务内，决不允许8秒钟的台词告诉我3秒，诸如此类的事情，决不允许。 3、其中包含1秒的开场黑屏和14秒的有效内容，写清X秒-X秒。 4、sora2提示词以中文展现。 5、对于一些回想的回忆、时间流逝等一些场景要细化，适当扩写，如回忆，可切人物眼部特写，眼睛中有着回忆的场景，从而转场过渡到回忆场景。如时间流逝，如3000年过去，你可以设计一个场景，进行3000年的变化沧海桑田，或者地球全景，整个地球版图变化等等类似的手段，千万不要一笔带过。每一个15秒分镜以“SORA2分镜1，2,3,4…的形式进行命名`;

const StoryboardAgent: React.FC<StoryboardAgentProps> = ({ isOpen, onClose, apiConfig, onAddScriptToCanvas }) => {
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
    const element = winRef.current;
    const handle = headerRef.current;
    if (!element || !handle) return;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      isDragging = true;
      handle.setPointerCapture(e.pointerId);
      if (element.style.left === '' || element.style.left === '50%') {
          const rect = element.getBoundingClientRect();
          element.style.transform = 'none';
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
      handle.releasePointerCapture(e.pointerId);
    };
    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSplitToCanvas = (text: string) => {
    if (!onAddScriptToCanvas) return;
    const keyword = "分镜";
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\n)[^\\n\\r]{0,10}${escapedKeyword}\\s*\\d+[\\s\\S]*?(?=\\n[^\\n\\r]{0,10}${escapedKeyword}\\s*\\d+|$)`, 'g');
    const matches = [...text.matchAll(regex)];
    if (matches.length > 0) {
       const scripts = matches.map(m => m[0].trim());
       onAddScriptToCanvas(scripts);
    } else {
        const Swal = (window as any).Swal;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning', title: '未识别到有效分镜', text: '文本中未发现作为标题的“分镜”段落',
                toast: true, position: 'top', timer: 2500, showConfirmButton: false,
                background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                color: document.documentElement.classList.contains('dark') ? '#fff' : '#1e293b'
            });
        }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isResponding || !apiConfig.key) return;
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    setIsResponding(true);
    setStreamingContent('');
    try {
        const response = await fetch(`${apiConfig.host}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...newHistory] })
        });
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const reader = response.body!.getReader();
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
                        fullText += data.choices[0]?.delta?.content || "";
                        setStreamingContent(fullText);
                    } catch (e) {}
                }
            }
        }
        setHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
        setStreamingContent('');
    } catch (e: any) {
        setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally { setIsResponding(false); }
  };

  const modelOptions = [
    { label: 'gemini-3-pro', value: 'gemini-3-pro' },
    { label: 'gemini-3-flash', value: 'gemini-3-flash' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  ];

  return (
    <>
      <style>{`
        #storyboard-agent-window {
            position: fixed; top: 50%; left: 50%; width: 440px; height: 620px; 
            max-width: 90vw; max-height: 85vh; background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px); border: 1px solid rgba(16, 185, 129, 0.2);
            box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.2); border-radius: 24px;
            z-index: 215; display: flex; flex-direction: column; opacity: 0; pointer-events: none;
            transform: translate(-50%, -50%) scale(0.95); transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .dark #storyboard-agent-window { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(16, 185, 129, 0.2); box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.7); }
        #storyboard-agent-window.active { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
      `}</style>
      <div ref={winRef} id="storyboard-agent-window" className={isOpen ? 'active' : ''}>
        <div ref={headerRef} className="h-14 flex items-center justify-between px-5 shrink-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-emerald-500/10 cursor-move rounded-t-3xl touch-none">
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md"><i className="fa-solid fa-clapperboard text-xs"></i></div>
                <span className="font-bold tracking-wide text-sm">分镜大师</span>
            </div>
            <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition flex items-center justify-center cursor-pointer"><i className="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="shrink-0 mb-3 flex justify-end w-40 ml-auto z-10">
                <MD3Select value={model} options={modelOptions} onChange={(val) => setModel(val)} className="w-full" />
            </div>
            <div ref={historyRef} className="flex-1 bg-slate-50 dark:bg-black/20 rounded-xl p-3 overflow-y-auto flex flex-col gap-3 custom-scroll mb-3">
                {history.length === 0 && (
                     <div className="text-center text-slate-500 text-xs py-10 flex flex-col items-center gap-2 h-full justify-center select-none">
                         <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-2 ring-1 ring-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><i className="fa-solid fa-clapperboard text-2xl text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-500"></i></div>
                         <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">分镜大师</h3>
                         <p className="max-w-[260px] leading-relaxed text-slate-500 dark:text-slate-400">我是您的分镜大师。请提供小说原文，我将为您生成15秒内的 SORA2 视频分镜脚本。</p>
                     </div>
                )}
                {history.map((msg, i) => (
                    <div key={i} className={`text-sm p-3 rounded-lg max-w-[90%] ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 self-end text-slate-800 dark:text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-emerald-500/10 self-start text-slate-700 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                        <div dangerouslySetInnerHTML={{ __html: (window as any).marked?.parse(msg.content) || msg.content }} />
                        {msg.role === 'assistant' && (
                             <div className="flex gap-2 mt-2 flex-wrap">
                                 <button onClick={() => copyToClipboard(msg.content)} className="text-[10px] flex items-center gap-1 text-emerald-500 hover:text-emerald-600 transition-colors border border-emerald-500/20 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/10"><i className="fa-regular fa-copy"></i> 复制内容</button>
                                 {onAddScriptToCanvas && ( <button onClick={() => handleSplitToCanvas(msg.content)} className="text-[10px] flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors border border-blue-500/20 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/10"><i className="fa-solid fa-table-columns"></i> 拆分到画布</button> )}
                             </div>
                        )}
                    </div>
                ))}
                {isResponding && ( <div className="text-sm p-3 rounded-lg max-w-[90%] bg-white dark:bg-slate-800 border border-emerald-500/10 self-start shadow-sm">{streamingContent ? <div dangerouslySetInnerHTML={{__html:(window as any).marked?.parse(streamingContent)}} /> : <i className="fa-solid fa-circle-notch fa-spin text-emerald-500"></i>}</div> )}
            </div>
            <div className="relative shrink-0 flex items-center gap-2">
                <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} className="flex-1 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all dark:text-white custom-scroll" placeholder="输入小说片段..." style={{ minHeight: '40px' }} />
                <button onClick={sendMessage} disabled={isResponding || !input.trim()} className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 transition flex items-center justify-center disabled:opacity-50 shadow-lg shadow-emerald-500/20"><i className="fa-solid fa-paper-plane"></i></button>
            </div>
            <div className="flex justify-between mt-2 px-1">
                 <button onClick={() => setHistory([])} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><i className="fa-solid fa-rotate-right mr-1"></i>重置会话</button>
                 <span className="text-[10px] text-emerald-500/50 font-mono">STORYBOARD AGENT</span>
            </div>
        </div>
      </div>
    </>
  );
};
export default StoryboardAgent;
