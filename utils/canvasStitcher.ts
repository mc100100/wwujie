
import { CanvasElement, ElementType } from '../types';
import { formatMediaUrl } from './url';
import { toast } from './toast';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// 底部文字区域的高度常量，需与组件保持一致或成比例
const LABEL_HEIGHT = 40; 

// 核心绘图逻辑提取
const drawStitchToCanvas = async (
  elements: CanvasElement[],
  selectedIds: Set<string>,
  theme: 'light' | 'dark'
): Promise<HTMLCanvasElement | null> => {
    // 过滤选中的元素
    const selectedEls = elements
        .filter(e => selectedIds.has(e.id))
        .map(e => ({ ...e }));

    if (selectedEls.length === 0) return null;

    // 1. 计算包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedEls.forEach(el => {
        minX = Math.min(minX, el.x - el.width / 2);
        minY = Math.min(minY, el.y - el.height / 2);
        maxX = Math.max(maxX, el.x + el.width / 2);
        maxY = Math.max(maxY, el.y + el.height / 2);
    });

    const PADDING = 0;
    const layoutWidth = maxX - minX + (PADDING * 2);
    const layoutHeight = maxY - minY + (PADDING * 2);

    // 2. 预加载图片资源
    const loadedImages = new Map<string, HTMLImageElement>();
    let maxScaleNeeded = 1;

    await Promise.all(selectedEls.map(async (el) => {
        if (el.type === ElementType.IMAGE || el.type === ElementType.VIDEO) {
            const src = el.type === ElementType.VIDEO ? (el.poster || el.src) : el.src;
            if (!src) return;

            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise<void>((resolve) => {
                img.onload = () => {
                    loadedImages.set(el.id, img);
                    const scaleW = img.naturalWidth / el.width;
                    const scaleH = img.naturalHeight / el.height;
                    const scale = Math.max(scaleW, scaleH);
                    if (scale > maxScaleNeeded) maxScaleNeeded = scale;
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = formatMediaUrl(src);
            });
        } else if (el.type === ElementType.TEXT) {
            if (maxScaleNeeded < 2) maxScaleNeeded = 2;
        }
    }));

    // 3. 确定最终 Canvas 尺寸
    const MAX_DIMENSION = 4096;
    let finalScale = maxScaleNeeded;

    if (layoutWidth * finalScale > MAX_DIMENSION) {
            finalScale = MAX_DIMENSION / layoutWidth;
    }
    if (layoutHeight * finalScale > MAX_DIMENSION) {
            finalScale = Math.min(finalScale, MAX_DIMENSION / layoutHeight);
    }
    
    finalScale = Math.max(1, finalScale);

    const canvasWidth = Math.ceil(layoutWidth * finalScale);
    const canvasHeight = Math.ceil(layoutHeight * finalScale);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context creation failed");

    // 4. 绘制背景与内容
    ctx.fillStyle = theme === 'dark' ? '#111827' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.scale(finalScale, finalScale);

    for (const el of selectedEls) {
        const drawX = el.x - el.width / 2 - minX + PADDING;
        const drawY = el.y - el.height / 2 - minY + PADDING;

        if (el.type === ElementType.TEXT) {
            // 文本卡片处理 (保持原有逻辑)
            const fontSize = Math.max(12, el.width / 25);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
            ctx.textBaseline = 'top';
            
            const lines = (el.content || '').split('\n');
            const lineHeight = fontSize * 1.5;
            lines.forEach((line, i) => {
                ctx.fillText(line, drawX + 12, drawY + 24 + (i * lineHeight));
            });
            
            ctx.strokeStyle = theme === 'dark' ? '#334155' : '#cbd5e1';
            ctx.lineWidth = 1; 
            ctx.strokeRect(drawX, drawY, el.width, el.height);

        } else {
            // 图片/视频处理 (修改为卡片样式)
            // 如果 el 中没有 imageHeight 属性 (普通画布元素)，则默认留出底部空间或者使用全部
            // 对于 WorkbenchStitchModal 传来的元素，el.height 已经包含了 LABEL_HEIGHT
            
            // 我们这里假设如果是拼图工作台过来的数据，它的 height 是 (图片+文字)。
            // 但如果是从主画布过来的数据，height 是图片本身的 height。
            // 为了区分，这里使用一种简单的启发式：看 el 是否有 imageHeight 属性（需强转）
            
            const extendedEl = el as any;
            const hasExtraLabelArea = extendedEl.imageHeight !== undefined;
            
            const imageHeight = hasExtraLabelArea ? extendedEl.imageHeight : el.height;
            const hasBottomBar = hasExtraLabelArea; 

            // 绘制白色卡片背景
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(drawX, drawY, el.width, el.height);

            const img = loadedImages.get(el.id);
            if (img) {
                // 绘制图片
                ctx.drawImage(img, drawX, drawY, el.width, imageHeight);
                
                // 绘制视频播放图标
                if (el.type === ElementType.VIDEO) {
                    const cx = drawX + el.width/2;
                    const cy = drawY + imageHeight/2;
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.moveTo(cx - 5, cy - 8);
                    ctx.lineTo(cx + 8, cy);
                    ctx.lineTo(cx - 5, cy + 8);
                    ctx.fill();
                }

                // 绘制底部文字
                if (el.content) {
                    const baseFontSize = 21; 
                    const scaledFontSize = baseFontSize; 
                    
                    ctx.font = `900 ${scaledFontSize}px sans-serif`; 
                    ctx.fillStyle = '#000000'; // 强制黑色文字
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // 计算文字位置
                    let textY;
                    if (hasBottomBar) {
                        // 在底部白条居中
                        textY = drawY + imageHeight + (LABEL_HEIGHT / 2);
                    } else {
                        // 兼容主画布：文字浮动在底部 (保持之前的样式或改为底部白条)
                        // 这里为了保持主画布导出的一致性，如果没白条，就浮动显示，但用户这波需求主要是针对拼图工作台
                        textY = drawY + el.height - 20;
                        ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
                        ctx.shadowBlur = 3;
                    }

                    ctx.fillText(el.content, drawX + el.width / 2, textY);
                    
                    // 重置阴影
                    ctx.shadowBlur = 0;
                }
            }
        }
    }
    
    return canvas;
};

// 生成 Blob 数据 (用于上传)
export const generateStitchBlob = async (
  elements: CanvasElement[],
  selectedIds: Set<string>,
  theme: 'light' | 'dark'
): Promise<Blob> => {
    const canvas = await drawStitchToCanvas(elements, selectedIds, theme);
    if (!canvas) throw new Error("Nothing to stitch");
    
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas blob conversion failed"));
        }, 'image/png');
    });
};

// 导出并保存 (原有逻辑，复用 drawStitchToCanvas)
export const exportStitchedImage = async (
  elements: CanvasElement[], 
  selectedIds: Set<string>,
  theme: 'light' | 'dark'
): Promise<void> => {
    const canvas = await drawStitchToCanvas(elements, selectedIds, theme);
    if (!canvas) return;

    // 5. 导出与保存
    const base64 = canvas.toDataURL('image/png', 1.0); 
    
    if (Capacitor.isNativePlatform()) {
            const fileName = `stitch_${Date.now()}.png`;
            const data = base64.split(',')[1];
            await Filesystem.writeFile({
                path: `无界/exports/${fileName}`,
                data: data,
                directory: Directory.Documents,
                recursive: true
            });
            toast.success(`已保存到文档/无界/exports/${fileName}`, 4000);

    } else {
            const a = document.createElement('a');
            a.href = base64;
            a.download = `stitch_${Date.now()}.png`;
            a.click();
            toast.success("拼图下载成功");
    }
};
