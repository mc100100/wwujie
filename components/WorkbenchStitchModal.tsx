
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { exportStitchedImage, generateStitchBlob } from '../utils/canvasStitcher';
import { CanvasElement, ElementType, Viewport, Position } from '../types';
import { formatMediaUrl } from '../utils/url';
import { toast } from '../utils/toast';
import { screenToWorld, getDistance, getMidpoint } from '../utils/geometry';

interface StitchItem {
  id: string;
  url: string;
  name: string;
}

interface WorkbenchStitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StitchItem[];
  title?: string;
  onUpload?: (blob: Blob) => Promise<void>;
}

// 扩展类型：imageHeight 用于记录纯图片的高度（不含文字区域）
interface StitchedElement extends CanvasElement {
  imageHeight: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const LABEL_HEIGHT = 40; // 底部文字区域高度

const WorkbenchStitchModal: React.FC<WorkbenchStitchModalProps> = ({ isOpen, onClose, items, title = "拼图画布", onUpload }) => {
  // 画布核心状态：默认缩放 50%
  const [elements, setElements] = useState<StitchedElement[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 0.5 });
  const [isExporting, setIsExporting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // 交互 Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingItem = useRef<string | null>(null);
  const dragOffset = useRef<Position | null>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef<Position>({ x: 0, y: 0 });
  const viewportRef = useRef<Viewport>(viewport);

  // 多点触控 Refs (用于双指缩放)
  const activePointers = useRef<Map<number, Position>>(new Map());
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMidpoint = useRef<Position | null>(null);

  // 缓存上一次的 items 签名，防止轮询导致的重置
  const prevItemsSignature = useRef<string>('');

  // 同步 viewport ref
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // 初始化：将传入的 items 转换为 CanvasElement 并自动排列
  useEffect(() => {
    if (isOpen && items.length > 0) {
        // 生成签名
        const signature = items.map(i => `${i.id}|${i.url}`).join(';');
        
        if (prevItemsSignature.current === signature) {
            return;
        }
        prevItemsSignature.current = signature;

        const initCanvas = async () => {
            setIsReady(false);
            const loadedElements: StitchedElement[] = [];
            // 强制固定为 2 列布局
            const COLS = 2; 
            const BASE_WIDTH = 400;
            // 无间隙排列
            const GAP = 0;

            // 用于记录每列当前的底部 Y 坐标，实现紧凑堆叠 (Masonry-like)
            const colBottoms = new Array(COLS).fill(0);

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                // 按顺序分配列：左->右，左->右
                const col = i % COLS;
                
                let aspectRatio = 16/9;
                let width = BASE_WIDTH;
                // 计算纯图片高度
                let imageHeight = width / aspectRatio;

                try {
                    await new Promise<void>((resolve) => {
                        const img = new Image();
                        img.src = formatMediaUrl(item.url);
                        img.onload = () => {
                            if (img.width > 0 && img.height > 0) {
                                aspectRatio = img.width / img.height;
                                imageHeight = width / aspectRatio;
                            }
                            resolve();
                        }
                        img.onerror = () => resolve();
                    });
                } catch (e) {}

                // 元素总高度 = 图片高度 + 文字区域高度
                const totalHeight = imageHeight + LABEL_HEIGHT;

                // 计算坐标
                // X: 基于列索引，无间隙
                const x = col * BASE_WIDTH; 
                
                // Y: 接在当前列的底部，实现无缝垂直拼接
                // 注意：CanvasElement 的 x,y 是中心点，所以需要加上半个高度
                const y = colBottoms[col] + totalHeight / 2;
                
                // 更新该列的底部位置
                colBottoms[col] += totalHeight;

                loadedElements.push({
                    id: item.id,
                    type: ElementType.IMAGE,
                    src: item.url,
                    x: x, 
                    y: y, 
                    width: width,
                    height: totalHeight, // 整体高度
                    imageHeight: imageHeight, // 纯图片高度 (辅助绘制)
                    aspectRatio: width / totalHeight,
                    content: item.name,
                });
            }

            // 计算包围盒以居中视图
            if (loadedElements.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                loadedElements.forEach(el => {
                    minX = Math.min(minX, el.x - el.width/2);
                    maxX = Math.max(maxX, el.x + el.width/2);
                    minY = Math.min(minY, el.y - el.height/2);
                    maxY = Math.max(maxY, el.y + el.height/2);
                });
                
                const contentW = maxX - minX;
                const contentH = maxY - minY;
                
                const containerW = window.innerWidth * 0.8; 
                const containerH = window.innerHeight * 0.7;

                // 初始缩放设为 0.5 (50%)
                const scale = 0.5;

                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const viewX = (containerRef.current?.clientWidth || containerW) / 2 - centerX * scale;
                const viewY = (containerRef.current?.clientHeight || containerH) / 2 - centerY * scale;

                setViewport({ x: viewX, y: viewY, scale });
            }

            setElements(loadedElements);
            setIsReady(true);
        };
        initCanvas();
    } else if (!isOpen) {
        prevItemsSignature.current = '';
    }
  }, [isOpen, items]);

  // --- 交互处理 ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // 记录指针
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    // 如果是多点触控，进入缩放逻辑，不处理拖拽
    if (activePointers.current.size === 2) {
        const pts = Array.from(activePointers.current.values()) as Position[];
        lastPinchDist.current = getDistance(pts[0], pts[1]);
        lastPinchMidpoint.current = getMidpoint(pts[0], pts[1]);
        return;
    }

    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    
    // 检测是否在拖拽卡片整体
    const itemEl = target.closest('[data-stitch-id]') as HTMLElement;
    if (itemEl) {
        const id = itemEl.getAttribute('data-stitch-id')!;
        const el = elements.find(e => e.id === id);
        if (el) {
            e.stopPropagation();
            isDraggingItem.current = id;
            const worldPos = screenToWorld({ x: e.clientX, y: e.clientY }, viewportRef.current);
            dragOffset.current = { x: worldPos.x - el.x, y: worldPos.y - el.y };
            (target as Element).setPointerCapture(e.pointerId);
        }
    } else {
        // 拖拽画布
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // 1. 处理双指缩放
    if (activePointers.current.size === 2) {
        const pts = Array.from(activePointers.current.values()) as Position[];
        const dist = getDistance(pts[0], pts[1]);
        const mid = getMidpoint(pts[0], pts[1]);

        if (lastPinchDist.current !== null && lastPinchMidpoint.current !== null) {
            const factor = dist / lastPinchDist.current;
            const currentVp = viewportRef.current;
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentVp.scale * factor));
            
            const worldX = (lastPinchMidpoint.current.x - currentVp.x) / currentVp.scale;
            const worldY = (lastPinchMidpoint.current.y - currentVp.y) / currentVp.scale;

            setViewport({
                x: mid.x - worldX * newScale,
                y: mid.y - worldY * newScale,
                scale: newScale
            });
        }
        lastPinchDist.current = dist;
        lastPinchMidpoint.current = mid;
        return; 
    }

    // 2. 处理图片/卡片拖拽
    if (isDraggingItem.current) {
        const worldPos = screenToWorld({ x: e.clientX, y: e.clientY }, viewportRef.current);
        const newX = worldPos.x - (dragOffset.current?.x || 0);
        const newY = worldPos.y - (dragOffset.current?.y || 0);
        
        setElements(prev => prev.map(el => 
            el.id === isDraggingItem.current ? { ...el, x: newX, y: newY } : el
        ));
    } else if (isPanning.current) {
        // 3. 处理画布平移
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
        lastPinchDist.current = null;
        lastPinchMidpoint.current = null;
    }

    isDraggingItem.current = null;
    isPanning.current = false;
    dragOffset.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch(e){}
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const currentVp = viewportRef.current;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentVp.scale * factor));
    
    const worldBefore = screenToWorld({ x: e.clientX, y: e.clientY }, currentVp);
    const newX = e.clientX - worldBefore.x * newScale;
    const newY = e.clientY - worldBefore.y * newScale; 
    
    setViewport({ x: newX, y: newY, scale: newScale });
  };

  const handleExportAction = async () => {
    if (elements.length === 0) return;
    setIsExporting(true);
    try {
        const selectedIds = new Set<string>(elements.map(e => e.id));
        const isDark = document.documentElement.classList.contains('dark');
        await exportStitchedImage(elements, selectedIds, isDark ? 'dark' : 'light');
        onClose();
    } catch (e: any) {
        console.error(e);
        toast.error('拼图生成失败');
    } finally {
        setIsExporting(false);
    }
  };

  const handleUploadAction = async () => {
    if (elements.length === 0) return;
    setIsExporting(true);
    try {
        const selectedIds = new Set<string>(elements.map(e => e.id));
        const isDark = document.documentElement.classList.contains('dark');
        const blob = await generateStitchBlob(elements, selectedIds, isDark ? 'dark' : 'light');
        if (onUpload) {
            await onUpload(blob);
        }
    } catch (e: any) {
        console.error(e);
        toast.error('上传失败: ' + e.message);
    } finally {
        setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const gridSize = 100 * viewport.scale;
  const gridOffset = `${viewport.x}px ${viewport.y}px`;

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-[90vw] h-[90vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10">
            {/* Header */}
            <div className="h-16 px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-white/5 z-10 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <i className="fa-solid fa-puzzle-piece text-lg"></i>
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-slate-800 dark:text-white">{title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">双指缩放画布 · 自由拖拽排列</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition flex items-center justify-center">
                    <i className="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>

            {/* Canvas Area */}
            <div 
                ref={containerRef}
                className="flex-1 relative overflow-hidden bg-slate-100 dark:bg-[#111] touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
            >
                {/* Grid Background */}
                <div 
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: `
                          linear-gradient(to right, #888 1px, transparent 1px),
                          linear-gradient(to bottom, #888 1px, transparent 1px)
                        `,
                        backgroundSize: `${gridSize}px ${gridSize}px`,
                        backgroundPosition: gridOffset,
                    }}
                />

                {/* Elements Layer */}
                <div
                    className="absolute origin-top-left"
                    style={{
                        transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
                        willChange: 'transform'
                    }}
                >
                    {!isReady ? (
                        <div className="absolute top-0 left-0 w-20 h-20 flex items-center justify-center">
                            <i className="fa-solid fa-circle-notch fa-spin text-slate-400 text-2xl"></i>
                        </div>
                    ) : (
                        elements.map(el => (
                            <div
                                key={el.id}
                                data-stitch-id={el.id}
                                className="absolute group select-none shadow-xl"
                                style={{
                                    left: el.x,
                                    top: el.y,
                                    width: el.width,
                                    height: el.height, // 包含文字区域的总高度
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: isDraggingItem.current === el.id ? 100 : 1
                                }}
                            >
                                <div className="w-full h-full relative overflow-hidden bg-white border-4 border-transparent hover:border-indigo-500 transition-colors cursor-move flex flex-col">
                                    {/* 图片区域 */}
                                    <div style={{ height: el.imageHeight }} className="w-full relative bg-slate-200">
                                         <img 
                                            src={formatMediaUrl(el.src)} 
                                            className="w-full h-full object-cover pointer-events-none"
                                            draggable={false}
                                        />
                                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    </div>
                                    
                                    {/* 文字区域 (固定在下方，白色背景，黑色文字) */}
                                    <div 
                                        className="flex-1 bg-white flex items-center justify-center px-2"
                                        style={{ height: LABEL_HEIGHT }}
                                    >
                                        <p className="text-xl font-black truncate text-center text-black">
                                            {el.content}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                {/* HUD Controls */}
                <div className="absolute bottom-6 left-6 pointer-events-auto bg-white/80 dark:bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-600 dark:text-slate-300 select-none shadow-sm">
                    {Math.round(viewport.scale * 100)}%
                </div>
            </div>

            {/* Footer */}
            <div className="h-20 px-6 border-t border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10 relative">
                <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                        已载入 {elements.length} 张图片
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                         自动拼接为卡片样式
                    </span>
                </div>
                <div className="flex gap-3">
                    {onUpload ? (
                        <button 
                            onClick={handleUploadAction}
                            disabled={isExporting || elements.length === 0}
                            className="px-6 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition-colors flex items-center gap-2"
                        >
                            {isExporting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                            上传
                        </button>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                            取消
                        </button>
                    )}
                    
                    <button 
                        onClick={handleExportAction}
                        disabled={isExporting || elements.length === 0}
                        className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isExporting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-download"></i>}
                        保存
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default WorkbenchStitchModal;
