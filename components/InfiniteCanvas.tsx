
import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import { CanvasElement, ElementType, Viewport, PointerState, Position, MenuAction } from '../types';
import { getDistance, getMidpoint, screenToWorld } from '../utils/geometry';
import CanvasItem from './CanvasItem';
import ContextMenu from './ContextMenu';

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const DOUBLE_CLICK_DELAY = 300;
const DRAG_THRESHOLD = 5;
const RENDER_BUFFER = 500; 

interface InfiniteCanvasProps {
  elements: CanvasElement[];
  onElementsChange: (elements: CanvasElement[]) => void;
  onContextMenuAction: (action: MenuAction, itemId: string, itemSrc: string, itemType: ElementType) => void;
  onCanvasDoubleClick?: () => void;
  isBatchMode?: boolean;
  selectedBatchIds?: Set<string>;
  onBatchSelect?: (id: string) => void;
  onFusionAction?: (action: MenuAction, source: CanvasElement, target: CanvasElement) => void; 
}

export interface InfiniteCanvasRef {
  resetView: (scale?: number) => void;
}

const InfiniteCanvas = forwardRef<InfiniteCanvasRef, InfiniteCanvasProps>(({ 
  elements, 
  onElementsChange, 
  onContextMenuAction, 
  onCanvasDoubleClick,
  isBatchMode = false,
  selectedBatchIds,
  onBatchSelect,
  onFusionAction
}, ref) => {
  const [viewport, setViewport] = useState<Viewport>({ x: window.innerWidth/2, y: window.innerHeight/2, scale: 0.5 });
  const [localElements, setLocalElements] = useState<CanvasElement[]>(elements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);
  const [fusionMenu, setFusionMenu] = useState<{ x: number, y: number, source: CanvasElement, target: CanvasElement } | null>(null); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const viewportRef = useRef<Viewport>(viewport);
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<CanvasElement[]>(elements);
  const activePointers = useRef<Map<number, PointerState>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastClickRef = useRef<{ time: number, id: string | null }>({ time: 0, id: null });
  const restoreViewportRef = useRef<Viewport | null>(null);

  const isDraggingItem = useRef<string | null>(null);
  const draggedDOM = useRef<HTMLElement | null>(null);
  const dragOffset = useRef<Position | null>(null); 
  const dragPointerStartScreen = useRef<Position | null>(null);
  const isPanning = useRef<boolean>(false);
  const lastMousePos = useRef<Position>({ x: 0, y: 0 });

  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMidpoint = useRef<Position | null>(null);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  
  useEffect(() => {
    if (!isDraggingItem.current) {
      setLocalElements(elements);
      elementsRef.current = elements;
    }
  }, [elements]);

  useImperativeHandle(ref, () => ({
    resetView: (scale = 0.5) => {
        setIsTransitioning(true);
        setViewport({ x: window.innerWidth/2, y: window.innerHeight/2, scale });
        restoreViewportRef.current = null;
    },
  }));

  const handleContentChange = useCallback((id: string, newContent: string) => {
    setLocalElements(prev => {
        const updated = prev.map(el => el.id === id ? { ...el, content: newContent } : el);
        elementsRef.current = updated;
        onElementsChange(updated);
        return updated;
    });
  }, [onElementsChange]);

  const handleScriptsChange = useCallback((id: string, newScripts: string[]) => {
      setLocalElements(prev => {
          const updated = prev.map(el => el.id === id ? { ...el, scripts: newScripts } : el);
          elementsRef.current = updated;
          onElementsChange(updated);
          return updated;
      });
  }, [onElementsChange]);

  const handleSizeChange = useCallback((id: string, width: number, height: number) => {
    setLocalElements(prev => {
        const updated = prev.map(el => el.id === id ? { ...el, width, height } : el);
        elementsRef.current = updated;
        onElementsChange(updated);
        return updated;
    });
  }, [onElementsChange]);

  const handleDelete = useCallback((id: string) => {
     const item = elementsRef.current.find(e => e.id === id);
     if (item) {
        onContextMenuAction('DELETE', id, item.src || item.content || '', item.type);
     }
  }, [onContextMenuAction]);

  const handleMenuAction = async (action: MenuAction) => {
    if (contextMenu) {
        const item = localElements.find(e => e.id === contextMenu.itemId);
        if (!item) return;

        if (action === 'TOGGLE_LOCK') {
            const updated = localElements.map(el => el.id === item.id ? { ...el, locked: !el.locked } : el);
            setLocalElements(updated);
            elementsRef.current = updated;
            onElementsChange(updated);
            setContextMenu(null);
            return;
        }

        if (action === 'EDIT_TEXT') {
            setEditingId(item.id);
            setContextMenu(null);
            return;
        }

        onContextMenuAction(action, item.id, item.src || item.content || '', item.type);
        setContextMenu(null);
    } else if (fusionMenu) {
        if (onFusionAction) {
            onFusionAction(action, fusionMenu.source, fusionMenu.target);
        }
        setFusionMenu(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    // Check if interaction is inside a textarea or button within a canvas item to prevent dragging
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('.no-drag')) {
        return;
    }

    setIsTransitioning(false); 

    const itemEl = target.closest('[data-id]') as HTMLElement;

    activePointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values()) as PointerState[];
      lastPinchDist.current = getDistance(pts[0], pts[1]);
      lastPinchMidpoint.current = getMidpoint(pts[0], pts[1]);
    }

    if (itemEl) {
      const id = itemEl.getAttribute('data-id')!;
      
      if (isBatchMode) {
         dragPointerStartScreen.current = { x: e.clientX, y: e.clientY };
         return; 
      }

      if (editingId === id) return;

      const item = elementsRef.current.find(el => el.id === id);
      if (!item) return;

      setSelectedId(id);
      setContextMenu(null);
      setFusionMenu(null); 

      if (item.locked) {
          dragPointerStartScreen.current = { x: e.clientX, y: e.clientY }; 
          return;
      }

      const worldClick = screenToWorld({ x: e.clientX, y: e.clientY }, viewportRef.current);
      dragOffset.current = {
        x: worldClick.x - item.x,
        y: worldClick.y - item.y
      };

      isDraggingItem.current = id;
      draggedDOM.current = itemEl;
      dragPointerStartScreen.current = { x: e.clientX, y: e.clientY };
      
      itemEl.style.transition = 'none';
      itemEl.style.cursor = 'grabbing';
      isPanning.current = false;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else {
      setSelectedId(null);
      setContextMenu(null);
      setFusionMenu(null); 
      setEditingId(null);
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      dragPointerStartScreen.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      if (activePointers.current.size === 2) {
        const pts = Array.from(activePointers.current.values()) as PointerState[];
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
      } 
      else if (isDraggingItem.current && draggedDOM.current && dragOffset.current && !isBatchMode) {
        const currentPtr = activePointers.current.get(e.pointerId);
        if (currentPtr) {
          const worldPtr = screenToWorld({ x: currentPtr.x, y: currentPtr.y }, viewportRef.current);
          const newX = worldPtr.x - dragOffset.current.x;
          const newY = worldPtr.y - dragOffset.current.y;
          
          if (Number.isFinite(newX) && Number.isFinite(newY)) {
            draggedDOM.current.style.left = `${newX}px`;
            draggedDOM.current.style.top = `${newY}px`;
          }
        }
      } 
      else if (isPanning.current && activePointers.current.size === 1) {
        const currentPtr = activePointers.current.get(e.pointerId);
        if (currentPtr) {
          const dx = currentPtr.x - lastMousePos.current.x;
          const dy = currentPtr.y - lastMousePos.current.y;
          lastMousePos.current = { x: currentPtr.x, y: currentPtr.y };
          setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        }
      }
      rafRef.current = null;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch(e){}

    if (activePointers.current.size < 2) {
      lastPinchDist.current = null;
      lastPinchMidpoint.current = null;
    }

    let moveDist = 1000;
    if (dragPointerStartScreen.current) {
        const screenDx = e.clientX - dragPointerStartScreen.current.x;
        const screenDy = e.clientY - dragPointerStartScreen.current.y;
        moveDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
    }
    
    if (isBatchMode) {
       isDraggingItem.current = null;
       draggedDOM.current = null;
       isPanning.current = false;
       return;
    }

    if (isDraggingItem.current && draggedDOM.current && dragOffset.current) {
      const draggingId = isDraggingItem.current;
      const draggingEl = elementsRef.current.find(el => el.id === draggingId);
      
      if (draggingEl && draggingEl.type === ElementType.IMAGE) {
          const worldPtr = screenToWorld({ x: e.clientX, y: e.clientY }, viewportRef.current);
          const targetTextEl = elementsRef.current.find(el => {
              if (el.id === draggingId) return false;
              if (el.type !== ElementType.TEXT) return false;
              const halfW = el.width / 2;
              const halfH = el.height / 2;
              return worldPtr.x >= el.x - halfW && worldPtr.x <= el.x + halfW &&
                     worldPtr.y >= el.y - halfH && worldPtr.y <= el.y + halfH;
          });

          if (targetTextEl) {
              e.stopPropagation();
              setFusionMenu({
                  x: e.clientX,
                  y: e.clientY,
                  source: draggingEl,
                  target: targetTextEl
              });
              
              if (draggedDOM.current) {
                  draggedDOM.current.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                  draggedDOM.current.style.left = `${draggingEl.x}px`;
                  draggedDOM.current.style.top = `${draggingEl.y}px`;
                  const dom = draggedDOM.current;
                  setTimeout(() => { if (dom) dom.style.transition = ''; }, 300);
                  dom.style.cursor = 'grab';
              }
              isDraggingItem.current = null;
              draggedDOM.current = null;
              dragOffset.current = null;
              dragPointerStartScreen.current = null;
              return; 
          }
      }

      if (moveDist < DRAG_THRESHOLD) {
         // handleItemClick(e, isDraggingItem.current); 
         // Click handled logic moved down to separate click from drag better
         const item = elementsRef.current.find(el => el.id === isDraggingItem.current);
         if (item) {
            draggedDOM.current.style.left = `${item.x}px`;
            draggedDOM.current.style.top = `${item.y}px`;
            // Trigger click logic if it was a tiny drag (effectively a click)
            handleItemClick(e, isDraggingItem.current);
         }
      } else {
         const worldPtr = screenToWorld({ x: e.clientX, y: e.clientY }, viewportRef.current);
         const finalX = worldPtr.x - dragOffset.current.x;
         const finalY = worldPtr.y - dragOffset.current.y;
         if (Number.isFinite(finalX) && Number.isFinite(finalY)) {
            const nextElements = elementsRef.current.map(el => el.id === isDraggingItem.current ? { ...el, x: finalX, y: finalY } : el);
            setLocalElements(nextElements);
            elementsRef.current = nextElements;
            onElementsChange(nextElements);
         }
      }
      draggedDOM.current.style.transition = '';
      draggedDOM.current.style.cursor = 'grab';
    } else if (selectedId && !isPanning.current && moveDist < DRAG_THRESHOLD) {
        const item = elementsRef.current.find(e => e.id === selectedId);
        if (item?.locked) handleItemClick(e, selectedId);
    } else if (moveDist < DRAG_THRESHOLD && activePointers.current.size === 0) {
        const target = e.target as HTMLElement;
        // Don't reset view if clicking inside a complex board text area
        if (target.tagName !== 'TEXTAREA' && !target.closest('.no-drag')) {
            if (restoreViewportRef.current) {
                setIsTransitioning(true);
                setViewport(restoreViewportRef.current);
                restoreViewportRef.current = null;
            }
        }
    }
    isDraggingItem.current = null;
    draggedDOM.current = null;
    dragOffset.current = null;
    dragPointerStartScreen.current = null;
    isPanning.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const handleItemClick = (e: React.PointerEvent, id: string) => {
      if (isBatchMode) return;
      const now = Date.now();
      if (lastClickRef.current.id === id && now - lastClickRef.current.time < DOUBLE_CLICK_DELAY) {
         e.preventDefault(); 
         setContextMenu({ x: e.clientX, y: e.clientY, itemId: id });
         setFusionMenu(null);
         if (onCanvasDoubleClick) onCanvasDoubleClick();
         lastClickRef.current = { time: 0, id: null };
      } else {
         lastClickRef.current = { time: now, id: id };
         const item = elementsRef.current.find(el => el.id === id);
         if (item) {
             if (!restoreViewportRef.current) restoreViewportRef.current = viewportRef.current;
             // Don't auto-zoom for Board types, too large
             if (item.type !== ElementType.SCRIPT_BOARD) {
                 let targetScale = item.type === ElementType.VIDEO ? 1.15 : 1.5;
                 setIsTransitioning(true);
                 setViewport({ x: window.innerWidth / 2 - item.x * targetScale, y: window.innerHeight / 2 - item.y * targetScale, scale: targetScale });
             }
         }
      }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isBatchMode) return;

    // FIX: Check if we are double clicking a textarea or input to prevent side-effects like opening Sidebar
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('.no-drag')) {
       return;
    }

    const itemEl = target.closest('[data-id]');
    if (itemEl) {
       setContextMenu({ x: e.clientX, y: e.clientY, itemId: itemEl.getAttribute('data-id')! });
       setFusionMenu(null);
       if (onCanvasDoubleClick) onCanvasDoubleClick();
       e.stopPropagation();
    } else if (onCanvasDoubleClick) onCanvasDoubleClick();
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const itemEl = (e.target as HTMLElement).closest('[data-id]');
      if (itemEl) {
          const id = itemEl.getAttribute('data-id');
          const item = elementsRef.current.find(i => i.id === id);
          if ((item?.type === ElementType.TEXT || item?.type === ElementType.SCRIPT_BOARD) && !isBatchMode) { 
              // Check if we are scrolling a textarea inside the item
              if ((e.target as HTMLElement).tagName === 'TEXTAREA') {
                  e.stopPropagation(); 
                  return; 
              }
          }
      }
      e.preventDefault();
      setIsTransitioning(false); 
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const targetId = itemEl?.getAttribute('data-id');
      if (selectedId && targetId === selectedId && !isBatchMode) {
         const item = elementsRef.current.find(i => i.id === selectedId);
         if (item?.locked || item?.type === ElementType.SCRIPT_BOARD) return; // Don't resize boards with wheel
         setLocalElements(prev => {
           const next = prev.map(el => {
             if (el.id === selectedId) {
               const newWidth = Math.max(50, el.width * factor);
               return { ...el, width: newWidth, height: newWidth / el.aspectRatio };
             }
             return el;
           });
           elementsRef.current = next;
           onElementsChange(next); 
           return next;
         });
         return; 
      }
      const currentVp = viewportRef.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentVp.scale * factor));
      const worldX = (e.clientX - currentVp.x) / currentVp.scale;
      const worldY = (e.clientY - currentVp.y) / currentVp.scale;
      setViewport({ x: e.clientX - worldX * newScale, y: e.clientY - worldY * newScale, scale: newScale });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [selectedId, onElementsChange, viewport, isBatchMode]); 

  const gridSize = 100 * viewport.scale;
  const gridOffset = `${viewport.x}px ${viewport.y}px`;
  const isSimpleView = viewport.scale < 0.3;

  const visibleElements = useMemo(() => {
    const minWorldX = (-RENDER_BUFFER - viewport.x) / viewport.scale;
    const maxWorldX = (window.innerWidth + RENDER_BUFFER - viewport.x) / viewport.scale;
    const minWorldY = (-RENDER_BUFFER - viewport.y) / viewport.scale;
    const maxWorldY = (window.innerHeight + RENDER_BUFFER - viewport.y) / viewport.scale;
    return localElements.filter(el => {
      if (selectedId === el.id) return true;
      const hw = el.width / 2, hh = el.height / 2;
      return el.x + hw >= minWorldX && el.x - hw <= maxWorldX && el.y + hh >= minWorldY && el.y - hh <= maxWorldY;
    });
  }, [localElements, viewport, selectedId]);

  const handleCycleZoom = () => {
    if (ref && 'current' in ref && ref.current) {
      const s = viewport.scale;
      let nextScale;
      // Cycle: 50% -> 100% -> 10% -> 30% -> 50%
      if (Math.abs(s - 0.5) < 0.01) nextScale = 1.0;
      else if (Math.abs(s - 1.0) < 0.01) nextScale = 0.1;
      else if (Math.abs(s - 0.1) < 0.01) nextScale = 0.3;
      else nextScale = 0.5;
      
      ref.current.resetView(nextScale);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-50 dark:bg-[#111] transition-colors duration-300">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full touch-none grid-background"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: gridOffset,
            transform: 'translate3d(0,0,0)',
            willChange: 'background-position, background-size',
            transition: isTransitioning ? 'background-position 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), background-size 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)' : 'none'
        }}
      >
        <div
          className="absolute origin-top-left"
          style={{ 
            willChange: 'transform',
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            transition: isTransitioning ? 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)' : 'none'
          }}
        >
          {visibleElements.map(el => (
            <CanvasItem 
              key={el.id}
              item={el}
              isSelected={selectedId === el.id}
              isEditing={editingId === el.id}
              isSimpleView={isSimpleView}
              onContentChange={handleContentChange}
              onScriptsChange={handleScriptsChange} // Pass new handler
              onSizeChange={handleSizeChange}
              onEditEnd={() => setEditingId(null)}
              onDelete={handleDelete}
              isBatchMode={isBatchMode}
              isBatchSelected={selectedBatchIds?.has(el.id)}
              onBatchToggle={() => onBatchSelect && onBatchSelect(el.id)}
            />
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-6 left-6 pointer-events-auto z-50 flex items-center gap-2">
        <button 
          onClick={handleCycleZoom}
          className="px-3.5 py-2 rounded-2xl bg-white/70 dark:bg-black/70 backdrop-blur-lg border border-slate-200/50 dark:border-white/10 text-xs font-mono font-black text-slate-800 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group shadow-sm"
        >
          <i className="fa-solid fa-expand text-[10px] opacity-40 group-hover:opacity-100 transition-opacity"></i>
          {Math.round(viewport.scale * 100)}%
        </button>
      </div>

      {contextMenu && !isBatchMode && (
        <ContextMenu 
          x={contextMenu.x} y={contextMenu.y}
          itemType={localElements.find(e => e.id === contextMenu.itemId)?.type || ElementType.IMAGE}
          isLocked={localElements.find(e => e.id === contextMenu.itemId)?.locked}
          onClose={() => setContextMenu(null)}
          onAction={handleMenuAction}
        />
      )}

      {fusionMenu && !isBatchMode && (
         <ContextMenu 
            x={fusionMenu.x} y={fusionMenu.y}
            itemType={ElementType.IMAGE}
            variant="fusion"
            onClose={() => setFusionMenu(null)}
            onAction={handleMenuAction}
         />
      )}
    </div>
  );
});

export default InfiniteCanvas;
