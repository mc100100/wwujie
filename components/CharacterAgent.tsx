import React, { useState, useEffect, useRef } from 'react';
import { ApiConfig } from '../types';

interface CharacterAgentProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
  onSendToSidebar?: (prompt: string) => void;
}

const SYSTEM_PROMPT = `你是一位专业的高级概念设计师和AI提示词工程师。你的核心目标是根据用户提供的六大关键参数，生成一个结构完整、美学指向明确、且能够直接用于Midjourney/Stable Diffusion等AI绘图工具的高精准度角色设计提示词（中文）。

⚙️ 核心设计框架（六大参数）：
你必须基于以下六个参数来构建你的提示词，确保每个参数都在最终输出中得到体现或支持：

theme_type (题材类型): 确定整体视觉风格基调（如玄幻、仙侠、武侠、赛博等）。
script_content (剧本内容): 提取角色的核心视觉特征（如性格、行为、背景）。
core_fixed_elements (核心固定元素): 确保识别符号和视觉锤与角色身份强绑定。
design_style_triple (设计风格三重定位): 确保风格统一性，参考具体的案例和艺术流派。
role_weight (角色权重): 决定细节的丰富程度和渲染复杂度（主角高细节，配角简化）。
moral_orientation (正邪属性): 核心视觉导向，通过色彩、造型、光影等进行强化区分。
📄 输出格式要求：
你必须清晰的输出最终提示词，使用粗体和中文标签进行标注，以便用户理解和使用：
只需要输出角色描述词，不需要输出思考过程，以及补全参数的过程，艺术风格里写“参考用户上传图片风格”
核心描述 (Core Prompt)： 包含角色身份、表情、关键动作和环境背景。
➡️ 工作流程：
接收输入： 接收用户对新角色的描述（可能只包含身份，如“宗门长老”，或包含全部六个参数）。
参数补全（若需要）： 如果用户输入不完整，你必须先基于其身份（如：宗门长老）主动设定其余五个参数。
提示词生成： 根据补全或确认后的六大参数，严格按照下面括号中的示例输出生最终的中文提示词。（**核心描述**: 玄幻宗门大师兄，身姿挺拔，面容俊朗中带着一丝沉稳与威严，正手持一柄泛着淡淡青光的古朴长剑，立于云雾缭绕的仙山之巅，俯瞰着下方广阔的宗门建筑群。他身着一袭绣有祥云纹路的墨绿色长袍，衣袂随风轻扬，周身环绕着若隐若现的灵气波动。

**设计风格**: 东方玄幻风格，融合古典水墨意境与现代光影处理，参考用户上传图片风格。

**角色权重**: 主角级别，高细节，高渲染复杂度。

**正邪属性**: 纯正，通过清澈的眼神、端正的姿态和灵动的青光来表现其浩然正气。）
只输出角色设计提示词部分，其他的废话禁止输出，请严格执行设定
初始指令： “请提供您想要设计的角色的核心身份或详细参数。我将为您生成一个高精准度的角色设计提示词。”`;

const CharacterAgent: React.FC<CharacterAgentProps> = ({ isOpen, onClose, apiConfig, onSendToSidebar }) => {
  const [history, setHistory] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(40, newHeight)}px`; // Min height ~40px
    }
  }, [input]);

  // Draggable logic
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

      // Center handling initialization
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

  const sendMessage = async () => {
    if (!input.trim() || isResponding || !apiConfig.key) return;
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    
    setIsResponding(true);
    setStreamingContent('');

    try {
        const messagesToSend = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newHistory
        ];

        const response = await fetch(`${apiConfig.host}/v1/chat/completions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${apiConfig.key}` 
            },
            body: JSON.stringify({ 
                model: 'gemini-2.5-flash', // Use a fast model for prompt generation
                stream: true, 
                messages: messagesToSend 
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

  const renderMarkdown = (text: string) => {
    const marked = (window as any).marked;
    if (typeof marked !== 'undefined') {
        return { __html: marked.parse(text) };
    }
    return { __html: text };
  };

  return (
    <>
      <style>{`
        #char-agent-window {
            position: fixed; top: 50%; left: 50%; 
            width: 440px; height: 620px; 
            max-width: 90vw; max-height: 85vh;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(236, 72, 153, 0.2);
            box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.2);
            border-radius: 24px;
            z-index: 210;
            display: flex; flex-direction: column;
            opacity: 0; pointer-events: none;
            transform: translate(-50%, -50%) scale(0.95);
            transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .dark #char-agent-window {
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(236, 72, 153, 0.2);
            box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.7);
        }
        #char-agent-window.active { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
      `}</style>

      <div ref={winRef} id="char-agent-window" className={isOpen ? 'active' : ''}>
        {/* Header */}
        <div 
            ref={headerRef}
            className="h-14 flex items-center justify-between px-5 shrink-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-b border-pink-500/10 cursor-move rounded-t-3xl touch-none"
        >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                    <i className="fa-solid fa-user-pen text-xs"></i>
                </div>
                <span className="font-bold tracking-wide text-sm">角色设计</span>
            </div>
            <button 
                onClick={onClose} 
                onPointerDown={(e) => e.stopPropagation()}
                className="w-10 h-10 rounded-full hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition flex items-center justify-center cursor-pointer"
            >
                <i className="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div 
                ref={historyRef}
                className="flex-1 bg-slate-50 dark:bg-black/20 rounded-xl p-3 overflow-y-auto flex flex-col gap-3 custom-scroll mb-3"
            >
                {history.length === 0 && (
                     <div className="text-center text-slate-500 text-xs py-10 flex flex-col items-center gap-2 h-full justify-center select-none">
                         <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mb-2 ring-1 ring-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                             <i className="fa-solid fa-user-pen text-2xl text-transparent bg-clip-text bg-gradient-to-br from-pink-500 to-purple-500"></i>
                         </div>
                         <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">角色设计助手</h3>
                         <p className="max-w-[260px] leading-relaxed text-slate-500 dark:text-slate-400">
                            请提供您想要设计的角色的<strong>核心身份</strong>或<strong>详细参数</strong>。我将为您生成一个高精准度的角色设计提示词。
                         </p>
                     </div>
                )}
                
                {history.map((msg, i) => (
                    <div key={i} className={`text-sm p-3 rounded-lg max-w-[90%] ${
                        msg.role === 'user' 
                        ? 'bg-slate-200 dark:bg-slate-700 self-end text-slate-800 dark:text-white rounded-br-none' 
                        : 'bg-white dark:bg-slate-800 border border-pink-500/10 self-start text-slate-700 dark:text-slate-200 rounded-bl-none shadow-sm'
                    }`}>
                        <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                        {msg.role === 'assistant' && (
                             <div className="flex gap-2 mt-2 flex-wrap">
                                 <button 
                                    onClick={() => copyToClipboard(msg.content)}
                                    className="text-[10px] flex items-center gap-1 text-pink-500 hover:text-pink-600 transition-colors border border-pink-500/20 px-2 py-1 rounded bg-pink-50 dark:bg-pink-900/10"
                                 >
                                    <i className="fa-regular fa-copy"></i> 复制提示词
                                 </button>
                                 {onSendToSidebar && (
                                     <button 
                                        onClick={() => onSendToSidebar(msg.content)}
                                        className="text-[10px] flex items-center gap-1 text-purple-500 hover:text-purple-600 transition-colors border border-purple-500/20 px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/10"
                                     >
                                        <i className="fa-solid fa-paintbrush"></i> 文生图
                                     </button>
                                 )}
                             </div>
                        )}
                    </div>
                ))}
                {isResponding && (
                    <div className="text-sm p-3 rounded-lg max-w-[90%] bg-white dark:bg-slate-800 border border-pink-500/10 self-start shadow-sm">
                        {streamingContent ? <div dangerouslySetInnerHTML={renderMarkdown(streamingContent)} /> : <i className="fa-solid fa-circle-notch fa-spin text-pink-500"></i>}
                    </div>
                )}
            </div>

            <div className="relative shrink-0 flex items-center gap-2">
                <textarea 
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    className="flex-1 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 transition-all dark:text-white custom-scroll"
                    placeholder="例如：一个赛博朋克风格的女刺客..."
                    style={{ minHeight: '40px' }}
                />
                <button 
                    onClick={sendMessage}
                    disabled={isResponding || !input.trim()}
                    className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 transition flex items-center justify-center disabled:opacity-50 shadow-lg shadow-pink-500/20"
                >
                    <i className="fa-solid fa-paper-plane"></i>
                </button>
            </div>
            
            <div className="flex justify-between mt-2 px-1">
                 <button onClick={() => setHistory([])} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <i className="fa-solid fa-rotate-right mr-1"></i>重置会话
                 </button>
                 <span className="text-[10px] text-pink-500/50 font-mono">DESIGN AGENT</span>
            </div>
        </div>
      </div>
    </>
  );
};

export default CharacterAgent;