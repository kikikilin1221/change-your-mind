'use client';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge,
  NodeResizer, ReactFlowProvider, useReactFlow, MarkerType,
  getBezierPath, EdgeProps, BaseEdge, EdgeLabelRenderer, useStore
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// --- 計算関数 ---
const getEdgePoint = (cx: number, cy: number, w: number, h: number, tx: number, ty: number) => {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tanTheta = dy / dx;
  let px, py;
  if (Math.abs(tanTheta) > h / w) {
    py = cy + (dy > 0 ? h / 2 : -h / 2);
    px = cx + (py - cy) / tanTheta;
  } else {
    px = cx + (dx > 0 ? w / 2 : -w / 2);
    py = cy + (px - cx) * tanTheta;
  }
  return { x: px, y: py };
};

// --- 二重線エッジ ---
const DoubleEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, markerStart, data, label }: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const isDouble = (data as any)?.double;
  const strokeWidth = Number(style?.strokeWidth) || 2;
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} markerStart={markerStart} style={{ ...style, strokeWidth: isDouble ? strokeWidth + 4 : strokeWidth, stroke: '#333' }} />
      {isDouble && <BaseEdge path={edgePath} style={{ ...style, strokeWidth: strokeWidth, stroke: '#fff' }} />}
      {label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 5px', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', pointerEvents: 'none', border: '1px solid #ccc', zIndex: 1000 }}>{String(label)}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// --- スマートガイド ---
function SmartGuides({ guides }: { guides: { lineX?: number, lineY?: number } }) {
  const transform = useStore(s => s.transform);
  if (guides.lineX === undefined && guides.lineY === undefined) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {guides.lineX !== undefined && <div style={{ position: 'absolute', left: guides.lineX * transform[2] + transform[0], top: 0, width: '1px', height: '100%', backgroundColor: '#ef4444' }} />}
      {guides.lineY !== undefined && <div style={{ position: 'absolute', top: guides.lineY * transform[2] + transform[1], left: 0, height: '1px', width: '100%', backgroundColor: '#ef4444' }} />}
    </div>
  );
}

// --- カスタムMarkdownレンダラー（部分編集用） ---
const MarkdownComponents: any = {
  a: ({node, href, children, ...props}: any) => {
    if (href?.startsWith('#style:')) {
      const styles = href.replace('#style:', '').split(';');
      let styleObj: any = {};
      styles.forEach((s: string) => {
        const [k, v] = s.split('=');
        if (k==='color') styleObj.color = v;
        if (k==='size') styleObj.fontSize = v;
        if (k==='bold') styleObj.fontWeight = v === 'true' ? 'bold' : 'normal';
        if (k==='font') styleObj.fontFamily = v;
        if (k==='double') styleObj.textDecoration = v === 'true' ? 'line-through double' : 'none';
      });
      return <span style={styleObj}>{children}</span>;
    }
    return <a href={href} {...props}>{children}</a>;
  }
};

const applyStyleToText = (text: string, newStyleKey: string, newStyleValue: string) => {
  const regex = /\[(.*?)\]\(#style:([^)]+)\)/g;
  let lastIndex = 0;
  let result = '';
  let match;
  if (!text.includes('](#style:')) {
      if (newStyleValue === 'false') return text;
      return `[${text}](#style:${newStyleKey}=${newStyleValue})`;
  }
  while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
          let unstyled = text.substring(lastIndex, match.index);
          result += newStyleValue === 'false' ? unstyled : `[${unstyled}](#style:${newStyleKey}=${newStyleValue})`;
      }
      let innerText = match[1];
      let existingStyles = match[2];
      let styleMap = new Map();
      existingStyles.split(';').forEach((s: string) => {
          let [k,v] = s.split('=');
          if (k && v) styleMap.set(k,v);
      });
      if (newStyleValue === 'false') {
          styleMap.delete(newStyleKey);
      } else {
          styleMap.set(newStyleKey, newStyleValue);
      }
      if (styleMap.size === 0) {
          result += innerText;
      } else {
          let merged = Array.from(styleMap.entries()).map(([k,v]) => `${k}=${v}`).join(';');
          result += `[${innerText}](#style:${merged})`;
      }
      lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
      let unstyled = text.substring(lastIndex);
      result += newStyleValue === 'false' ? unstyled : `[${unstyled}](#style:${newStyleKey}=${newStyleValue})`;
  }
  return result;
};

const edgeTypes = { default: DoubleEdge };
const PASTEL_COLORS = ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F3E5F5', '#E1F5FE', '#FFF9C4', '#FCE4EC', '#E8F5E9'];
const QUICK_TEXT_COLORS = ['#000000', '#FF0000', '#008000', '#0000FF', '#FFF000'];

function FlowEditor() {
  const { setViewport, getZoom } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [files, setFiles] = useState<Record<string, any>>({});
  const [activeFileId, setActiveFileId] = useState<string>('default');
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [levelData, setLevelData] = useState<Record<string, { nodes: any[]; edges: any[]; bgColor?: string }>>({});
  
  const [history, setHistory] = useState<string[]>([]);
  const [currentLevel, setCurrentLevel] = useState('root');
  const [currentLabel, setCurrentLabel] = useState('TOP層');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [guides, setGuides] = useState<{ lineX?: number, lineY?: number }>({});
  
  const previewDragRef = useRef<{ id: string, startX: number, startY: number, initX: number, initY: number, moved: boolean } | null>(null);
  // ★ 画像トリミング（パン）用のRef ★
  const imageCropDragRef = useRef<{ id: string, startX: number, startY: number, initX: number, initY: number } | null>(null);
  
  const [selection, setSelection] = useState({start: 0, end: 0});

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  useEffect(() => {
    const saved = localStorage.getItem('my-logic-files');
    if (saved) {
      const parsed = JSON.parse(saved);
      setFiles(parsed);
      const lastId = localStorage.getItem('my-logic-active-id') || 'default';
      if (parsed[lastId]) loadFileInitial(lastId, parsed);
    } else {
      const initial = { 'default': { name: '無題のノート', levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff' } }, currentLevel: 'root', currentLabel: 'TOP層' } };
      setFiles(initial); localStorage.setItem('my-logic-files', JSON.stringify(initial));
    }
  }, []);

  useEffect(() => {
    setLevelData(prev => ({ ...prev, [currentLevel]: { ...(prev[currentLevel] || {}), nodes, edges } }));
  }, [nodes, edges, currentLevel]);

  useEffect(() => {
    if (!activeFileId) return;
    setFiles(prev => {
      const currentFileData = prev[activeFileId];
      if (!currentFileData) return prev;
      const updatedLevelData = { ...levelData, [currentLevel]: { ...(levelData[currentLevel] || {}), nodes, edges } };
      return { ...prev, [activeFileId]: { ...currentFileData, levelData: updatedLevelData, currentLevel, currentLabel } };
    });
  }, [nodes, edges, currentLevel, currentLabel, levelData, activeFileId]);

  useEffect(() => {
    if (Object.keys(files).length > 0) {
      localStorage.setItem('my-logic-files', JSON.stringify(files));
      localStorage.setItem('my-logic-active-id', activeFileId);
    }
  }, [files, activeFileId]);

  const loadFileInitial = (id: string, allFiles = files) => {
    const target = allFiles[id]; if (!target) return;
    const loadedLevelData = target.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff' } };
    const initialLevel = target.currentLevel || 'root';
    setActiveFileId(id); setLevelData(loadedLevelData); setCurrentLevel(initialLevel); setCurrentLabel(target.currentLabel || 'TOP層');
    setNodes(loadedLevelData[initialLevel]?.nodes || []); setEdges(loadedLevelData[initialLevel]?.edges || []);
    setHistory([]); setSelectedNodeId(null);
  };

  const switchFile = (newId: string) => {
    setFiles(prev => {
      const updated = { ...prev };
      if (activeFileId && updated[activeFileId]) {
        updated[activeFileId] = { ...updated[activeFileId], levelData: { ...levelData, [currentLevel]: { ...(levelData[currentLevel] || {}), nodes, edges } }, currentLevel, currentLabel };
      }
      return updated;
    });
    setTimeout(() => {
      setFiles(currentFiles => {
        const target = currentFiles[newId];
        if (target) {
          setActiveFileId(newId);
          const nextLevelData = target.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff' } };
          const nextLevel = target.currentLevel || 'root';
          setLevelData(nextLevelData); setCurrentLevel(nextLevel); setCurrentLabel(target.currentLabel || 'TOP層');
          setNodes(nextLevelData[nextLevel]?.nodes || []); setEdges(nextLevelData[nextLevel]?.edges || []);
          setSelectedNodeId(null); setSelectedEdge(null);
        }
        return currentFiles;
      });
    }, 0);
  };

  const createNewFile = () => {
    const name = prompt("ファイル名", `ノート ${Object.keys(files).length + 1}`);
    if (!name) return;
    const newId = `file-${Date.now()}`;
    const newF = { name, levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff' } }, currentLevel: 'root', currentLabel: 'TOP層' };
    setFiles(prev => ({ ...prev, [newId]: newF })); switchFile(newId);
  };

  const deleteFile = (id: string) => {
    if (Object.keys(files).length <= 1) return;
    if (!confirm("削除しますか？")) return;
    const updated = { ...files }; delete updated[id];
    setFiles(updated); if (id === activeFileId) switchFile(Object.keys(updated)[0]);
  };

  const updateNode = useCallback((newData: any, newStyle: any = {}) => {
    setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, data: { ...(n.data || {}), ...newData }, style: { ...(n.style || {}), ...newStyle } } : n));
  }, [selectedNodeId]);

  const applyPartialFormat = (styleKey: string, styleValue: string, isToggle: boolean = false) => {
    if (!selectedNode) return;
    const text = String(selectedNode.data?.content || '');
    const start = selection.start;
    const end = selection.end;
    if (start === end) return;

    const selectedText = text.substring(start, end);
    let finalValue = styleValue;
    if (isToggle) {
        if (selectedText.includes(`${styleKey}=true`)) finalValue = 'false';
        else finalValue = 'true';
    }

    const newSelectedText = applyStyleToText(selectedText, styleKey, finalValue);
    const newContent = text.substring(0, start) + newSelectedText + text.substring(end);

    updateNode({ content: newContent });
    
    setTimeout(() => {
        const ta = document.getElementById('node-textarea') as HTMLTextAreaElement;
        if (ta) {
            ta.focus();
            ta.setSelectionRange(start, start + newSelectedText.length);
            setSelection({start, end: start + newSelectedText.length});
        }
    }, 10);
  };

  const updateGlobalStyle = (globalKey: string, globalValue: any, partialKey: string) => {
    if (!selectedNode) return;
    let newStyle = { [globalKey]: globalValue };
    let currentContent = String(selectedNode.data?.content || '');
    
    if (partialKey) {
        let newContent = currentContent.replace(/\[(.*?)\]\(#style:([^)]+)\)/g, (match, innerText, stylesStr) => {
            let styleMap = new Map();
            stylesStr.split(';').forEach((s: string) => {
                let [k,v] = s.split('=');
                if (k && v && k !== partialKey) styleMap.set(k,v);
            });
            if (styleMap.size === 0) return innerText;
            let merged = Array.from(styleMap.entries()).map(([k,v]) => `${k}=${v}`).join(';');
            return `[${innerText}](#style:${merged})`;
        });
        updateNode({ content: newContent }, newStyle);
    } else {
        updateNode({}, newStyle);
    }
  };

  const handleFormat = (globalKey: string, partialKey: string, val1: any, isToggle: boolean = false) => {
    const hasSelection = selection.start !== selection.end;
    if (hasSelection) {
        applyPartialFormat(partialKey, val1, isToggle);
    } else {
        let finalVal = val1;
        if (isToggle) {
            if (globalKey === 'fontWeight') finalVal = selectedNode?.style?.fontWeight === 'bold' ? 'normal' : 'bold';
            if (globalKey === 'textDecoration') finalVal = selectedNode?.style?.textDecoration?.includes('double') ? 'none' : 'line-through double';
        }
        updateGlobalStyle(globalKey, finalVal, partialKey);
    }
  };

  const enterLevel = useCallback((id: string, label: string) => {
    setNodes(nds => {
      const target = nds.find(n => n.id === id);
      if (target?.data?.isShape || target?.data?.isImage) return nds;
      setHistory(prev => [...prev, currentLevel]);
      setCurrentLevel(id); setCurrentLabel(label || '階層中'); setSelectedNodeId(null);
      const nextData = levelData[id] || { nodes: [], edges: [] };
      setEdges(nextData.edges || []); return nextData.nodes || [];
    });
  }, [currentLevel, levelData]);

  const goBack = () => {
    if (history.length === 0) return;
    const newHist = [...history]; const prevLevel = newHist.pop()!;
    setCurrentLevel(prevLevel); setHistory(newHist); setCurrentLabel(prevLevel === 'root' ? 'TOP層' : '階層中'); setSelectedNodeId(null);
    const prevData = levelData[prevLevel] || { nodes: [], edges: [] };
    setNodes(prevData.nodes || []); setEdges(prevData.edges || []);
  };

  const goTop = () => {
    if (history.length === 0) return;
    setCurrentLevel('root'); setHistory([]); setCurrentLabel('TOP層'); setSelectedNodeId(null);
    const rootData = levelData['root'] || { nodes: [], edges: [] };
    setNodes(rootData.nodes || []); setEdges(rootData.edges || []);
  };

  const addNode = useCallback((type: 'text' | 'image' | 'shape') => {
    const id = `node-${Date.now()}`;
    let data: any = { content: '項目', previewVisible: false, previewStyle: { opacity: 0.7, offsetX: 0, offsetY: -150, width: 180, height: 120 } };
    let style: any = { backgroundColor: '#ffffff', color: '#000', borderRadius: '12px', fontSize: '18px', width: 200, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
    if (type === 'image') { fileInputRef.current?.click(); return; }
    if (type === 'shape') {
      data = { content: '', isShape: true, shapeType: 'rect', keepRatio: false };
      style = { ...style, backgroundColor: '#eee', borderRadius: '4px', border: '3px solid #333' };
    }
    setNodes(nds => {
      const maxZ = Math.max(0, ...nds.map(n => Number(n.zIndex) || 0));
      return [...nds, { id, position: { x: 100, y: 100 }, data, style, zIndex: maxZ + 1 }];
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') { e.preventDefault(); addNode('text'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addNode]);

  // ★ ドラッグイベントの監視（吹き出し ＆ 画像トリミング） ★
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const zoom = getZoom();
      
      // 吹き出しドラッグ
      const drag = previewDragRef.current;
      if (drag) {
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        setNodes(nds => nds.map(n => n.id === drag.id ? {
          ...n, data: { ...(n.data || {}), previewStyle: { ...(n.data?.previewStyle || {}), offsetX: drag.initX + dx, offsetY: drag.initY + dy } }
        } : n));
      }

      // 画像トリミングドラッグ
      const imgDrag = imageCropDragRef.current;
      if (imgDrag) {
        const dx = (e.clientX - imgDrag.startX) / zoom;
        const dy = (e.clientY - imgDrag.startY) / zoom;
        setNodes(nds => nds.map(n => n.id === imgDrag.id ? {
          ...n, data: { ...(n.data || {}), imgPosX: imgDrag.initX + dx, imgPosY: imgDrag.initY + dy }
        } : n));
      }
    };
    
    const onMouseUp = () => { 
      setTimeout(() => { previewDragRef.current = null; }, 50); 
      imageCropDragRef.current = null;
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [getZoom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNodes(nds => {
          const maxZ = Math.max(0, ...nds.map(n => Number(n.zIndex) || 0));
          return [...nds, { 
            id: `img-${Date.now()}`, position: { x: 50, y: 50 }, zIndex: maxZ + 1,
            data: { isImage: true, imageUrl: ev.target?.result, imgPosX: 0, imgPosY: 0, imgZoom: 1, isCropping: false }, 
            style: { width: 300, height: 200, background: '#fff', padding: 0, border: '1px solid #ccc' } 
          }];
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const onNodeDrag = useCallback((_: any, node: any) => {
    let snapX: number | undefined, snapY: number | undefined;
    let lineX: number | undefined, lineY: number | undefined;
    let snapDiffX = 15, snapDiffY = 15;
    const nW = Number(node.style?.width) || 200; const nH = Number(node.style?.height) || 100;
    const nLeft = node.position.x, nCenter = node.position.x + nW / 2, nRight = node.position.x + nW;
    const nTop = node.position.y, nMiddle = node.position.y + nH / 2, nBottom = node.position.y + nH;
    nodes.forEach(t => {
      if (t.id === node.id || t.id === 'center-mark') return;
      const tW = Number(t.style?.width) || 200; const tH = Number(t.style?.height) || 100;
      const tLeft = t.position.x, tCenter = t.position.x + tW / 2, tRight = t.position.x + tW;
      const tTop = t.position.y, tMiddle = t.position.y + tH / 2, tBottom = t.position.y + tH;
      const xs = [ { target: tLeft, src: nLeft, offset: 0 }, { target: tLeft, src: nRight, offset: -nW }, { target: tRight, src: nLeft, offset: 0 }, { target: tRight, src: nRight, offset: -nW }, { target: tCenter, src: nCenter, offset: -nW / 2 } ];
      xs.forEach(x => { const diff = Math.abs(x.target - x.src); if (diff < snapDiffX) { snapDiffX = diff; snapX = x.target + x.offset; lineX = x.target; } });
      const ys = [ { target: tTop, src: nTop, offset: 0 }, { target: tTop, src: nBottom, offset: -nH }, { target: tBottom, src: nTop, offset: 0 }, { target: tBottom, src: nBottom, offset: -nH }, { target: tMiddle, src: nMiddle, offset: -nH / 2 } ];
      ys.forEach(y => { const diff = Math.abs(y.target - y.src); if (diff < snapDiffY) { snapDiffY = diff; snapY = y.target + y.offset; lineY = y.target; } });
    });
    if (snapX !== undefined) node.position.x = snapX;
    if (snapY !== undefined) node.position.y = snapY;
    setGuides({ lineX, lineY });
  }, [nodes]);

  const onNodeDragStop = useCallback((_: any, node: any) => {
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, position: node.position } : n));
    setGuides({});
  }, []);

  const flowNodes = useMemo(() => {
    const centerNode: any = { 
      id: 'center-mark', type: 'default', position: { x: -10, y: -10 }, draggable: false, selectable: false, 
      data: { label: '＋' }, 
      style: { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '14px', fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', border: '2px solid #ef4444', zIndex: -1000, pointerEvents: 'none', padding: 0 } 
    };

    return [centerNode, ...nodes.map(n => {
      const isPreview = Boolean(n.data?.previewVisible && !n.data?.isShape && !n.data?.isImage);
      let previewElement: React.ReactNode = null;

      if (isPreview) {
        const w1 = Number(n.style?.width) || 200; 
        const h1 = Number(n.style?.height) || 100;
        const cx1 = w1 / 2; const cy1 = h1 / 2;
        const offsetX = Number(n.data?.previewStyle?.offsetX) || 0; 
        const offsetY = Number(n.data?.previewStyle?.offsetY) || -180;
        const w2 = Number(n.data?.previewStyle?.width) || 180; 
        const h2 = Number(n.data?.previewStyle?.height) || 120;
        const cx2 = offsetX + w2 / 2; const cy2 = offsetY + h2 / 2;
        const p1 = getEdgePoint(cx1, cy1, w1, h1, cx2, cy2); 
        const p2 = getEdgePoint(cx2, cy2, w2, h2, cx1, cy1);

        previewElement = (
          <React.Fragment>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: -2 }}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#999" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            <div className="nodrag"
              onMouseDown={(e) => { e.stopPropagation(); previewDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: offsetX, initY: offsetY, moved: false }; }}
              onClick={(e) => { e.stopPropagation(); if (!previewDragRef.current?.moved) enterLevel(n.id, String(n.data?.content || '')); }}
              style={{ position:'absolute', left: offsetX, top: offsetY, width: `${w2}px`, height: `${h2}px`, backgroundColor:`rgba(255,255,255,${n.data?.previewStyle?.opacity || 0.7})`, borderRadius: '12px', border: '1px solid #ccc', zIndex: -1, cursor: 'grab', overflow: 'hidden', boxShadow: '0 8px 12px rgba(0,0,0,0.1)' }}
            >
              {levelData[n.id]?.nodes?.length ? (
                <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '1200px', height: '800px', position: 'relative', pointerEvents: 'none' }}>
                  {levelData[n.id].nodes.map((cn: any) => cn.id !== 'center-mark' ? (
                    <div key={cn.id} style={{ position: 'absolute', left: cn.position.x, top: cn.position.y, width: cn.style?.width || 200, height: cn.style?.height || 100, backgroundColor: cn.style?.backgroundColor || '#fff', border: cn.style?.border || '4px solid #333', borderRadius: cn.style?.borderRadius || '12px', display: 'flex', alignItems: cn.style?.alignItems || 'center', justifyContent: cn.style?.justifyContent || 'center', fontSize: '32px', color: cn.style?.color || '#000', overflow: 'hidden' }}>
                      {cn.data?.isImage ? <img src={cn.data.imageUrl as string} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="mini" /> : cn.data?.isShape ? null : <div style={{padding:'15px', fontWeight: cn.style?.fontWeight || 'normal', textAlign: cn.style?.textAlign || 'center'}}>{String(cn.data?.content || '')}</div>}
                    </div>
                  ) : null)}
                </div>
              ) : <div style={{fontSize: '11px', color: '#999', textAlign: 'center', paddingTop: '40px', pointerEvents: 'none'}}>中身<br/>(クリックで入る)</div>}
            </div>
          </React.Fragment>
        );
      }

      return {
        ...n,
        data: {
          ...n.data,
          label: (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: n.style?.alignItems || 'center', justifyContent: n.style?.justifyContent || 'center', position: 'relative' }}>
              {previewElement}
              
              {n.data?.isImage ? (
                // ★ 画像描画部分（トリミングロジック） ★
                <div 
                  className={n.data?.isCropping ? "nodrag" : ""}
                  onMouseDown={(e) => {
                     if (n.data?.isCropping) {
                        e.stopPropagation();
                        imageCropDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: Number(n.data?.imgPosX || 0), initY: Number(n.data?.imgPosY || 0) };
                     }
                  }}
                  style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', borderRadius: n.style?.borderRadius || 0, cursor: n.data?.isCropping ? 'move' : 'default' }}
                >
                  <img src={n.data.imageUrl as string} style={{ position: 'absolute', width: 'auto', height: 'auto', minWidth: '100%', minHeight: '100%', transform: `translate(${n.data.imgPosX || 0}px, ${n.data.imgPosY || 0}px) scale(${n.data.imgZoom || 1})`, transformOrigin: 'center center', pointerEvents: 'none' }} alt="img" />
                  
                  {/* トリミング中の赤いガイド枠 */}
                  {n.data?.isCropping && (
                    <div style={{ position: 'absolute', inset: 0, border: '3px dashed #ef4444', pointerEvents: 'none', zIndex: 10 }}></div>
                  )}

                  <div className="markdown-content" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: n.style?.alignItems || 'center', justifyContent: n.style?.justifyContent || 'center', pointerEvents: 'none', color: n.style?.color || '#000', fontWeight: n.style?.fontWeight || 'normal', textDecoration: n.style?.textDecoration || 'none', fontFamily: n.style?.fontFamily || 'sans-serif', whiteSpace: 'pre-wrap', lineHeight: '1.2' }}>
                    <ReactMarkdown components={MarkdownComponents} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{String(n.data?.content || '').replace(/\n/g, '  \n')}</ReactMarkdown>
                  </div>
                </div>
              ) : n.id !== 'center-mark' ? (
                <div className="markdown-content" style={{ pointerEvents: 'none', width: '100%', color: n.style?.color || '#000', fontWeight: n.style?.fontWeight || 'normal', textDecoration: n.style?.textDecoration || 'none', fontFamily: n.style?.fontFamily || 'sans-serif', whiteSpace: 'pre-wrap', lineHeight: '1.2', textAlign: n.style?.textAlign || 'center' }}>
                  <ReactMarkdown components={MarkdownComponents} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{String(n.data?.content || '').replace(/\n/g, '  \n')}</ReactMarkdown>
                </div>
              ) : null}

              {n.id !== 'center-mark' ? (
                 <NodeResizer minWidth={30} minHeight={30} keepAspectRatio={!!n.data?.keepRatio} isVisible={selectedNodeId === n.id} lineStyle={{ border: '3px solid #3b82f6', zIndex: 100 }} handleStyle={{ background: '#3b82f6', border: '1px solid #fff', width: 12, height: 12, zIndex: 100 }} />
              ) : null}
            </div>
          )
        }
      };
    })];
  }, [nodes, selectedNodeId, enterLevel, levelData]);

  const updateEdgeDesign = (config: any) => {
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdge?.id) return e;
      const mSize = Math.max(8, (Number(e.style?.strokeWidth) || 2) * 1.5);
      const m = { type: MarkerType.ArrowClosed, color: '#333', width: mSize, height: mSize };
      return { ...e, data: { ...(e.data || {}), double: config.double }, markerEnd: config.arrow || config.both ? m : undefined, markerStart: config.both ? m : undefined, label: config.label || '' };
    }));
  };

  const isRoot = history.length === 0;

  const actionBtnStyle = { padding: '10px 16px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' };
  const primaryBtnStyle = { ...actionBtnStyle, backgroundColor: '#3b82f6', color: '#fff', border: 'none', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <style>{`
        .markdown-content p { margin: 0; }
        /* 黒い点を大きくして吸着しやすくする魔法のCSS */
        .react-flow__handle {
            width: 24px !important;
            height: 24px !important;
            background: #333 !important;
            border: 4px solid #fff !important;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
            cursor: crosshair !important;
        }
        .react-flow__handle:hover {
            transform: scale(1.6) !important;
            background: #3b82f6 !important;
            border-color: #fff !important;
        }
      `}</style>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
      
      <div style={{ width: isSidebarOpen ? '220px' : '0px', transition: 'width 0.3s ease', backgroundColor: '#f8f9fa', borderRight: isSidebarOpen ? '1px solid #ddd' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', height: '100%', padding: '15px' }}>
          <h2>ファイル一覧</h2>
          <button onClick={createNewFile} style={{ padding: '8px', marginBottom: '20px', backgroundColor: '#fff', border: '1px solid #ddd', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold' }}>＋ 新規ノート</button>
          <div style={{ flexGrow: 1, overflowY: 'auto' }}>
            {Object.entries(files).map(([id, f]: [string, any]) => (
              <div key={id} onClick={() => switchFile(id)} style={{ padding: '10px', marginBottom: '5px', borderRadius: '6px', cursor: 'pointer', backgroundColor: activeFileId === id ? '#e7f1ff' : 'transparent', border: activeFileId === id ? '1px solid #3b82f6' : '1px solid transparent', fontSize: '14px', fontWeight: activeFileId === id ? 'bold' : 'normal' }}>
                {f.name} <span onClick={(e) => { e.stopPropagation(); deleteFile(id); }} style={{ float: 'right', color: '#999' }}>×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: levelData[currentLevel]?.bgColor || '#ffffff', transition: 'background-color 0.3s' }}>
        <div style={{ padding: '10px 15px', backgroundColor: 'rgba(255,255,255,0.8)', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', zIndex: 100 }}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '15px', padding: '0 5px' }}>☰</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>階層: {currentLabel}</div>
          <div style={{ width: '40px' }}></div>
        </div>

        <div style={{ flexGrow: 1, position: 'relative' }}>
          <ReactFlow nodes={flowNodes} edges={edges} edgeTypes={edgeTypes} elevateNodesOnSelect={false} onNodesChange={u => setNodes(nds => applyNodeChanges(u, nds))} onEdgesChange={u => setEdges(eds => applyEdgeChanges(u, eds))} onConnect={p => setEdges(eds => addEdge({...p, type:'default', style: {strokeWidth: 2}}, eds))} onNodeClick={(_, n) => { setSelectedNodeId(n.id !== 'center-mark' ? n.id : null); setSelectedEdge(null); }} onEdgeClick={(_, e) => { setSelectedEdge(e); setSelectedNodeId(null); }} onPaneClick={() => { setSelectedNodeId(null); setSelectedEdge(null); }} onNodeDoubleClick={(_, n) => enterLevel(n.id, String(n.data?.content || ''))} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop} fitView>
            <Background color="#f1f1f1" /><Controls /><SmartGuides guides={guides} />
          </ReactFlow>
          
          {selectedNode && (
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'340px', borderLeft:'1px solid #ddd', padding:'20px', backgroundColor:'#fff', zIndex:1000, overflowY: 'auto', boxShadow: '-4px 0 10px rgba(0,0,0,0.05)' }}>
              <button onClick={() => setSelectedNodeId(null)} style={{ float: 'right', border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
              <h3 style={{fontSize:'16px'}}>{selectedNode.data?.isImage ? '画像編集' : selectedNode.data?.isShape ? '図形設定' : 'テキスト設定'}</h3>
              
              <div style={{ display:'flex', gap:'5px', marginBottom:'15px', marginTop:'10px' }}>
                <button onClick={() => setNodes(nds => { const maxZ = Math.max(0, ...nds.map(n => Number(n.zIndex) || 0)); return nds.map(n => n.id === selectedNodeId ? {...n, zIndex: maxZ + 1} : n); })} style={{flex:1, padding:'8px', fontSize:'12px', fontWeight: 'bold', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '4px'}}>↑ 最前面へ</button>
                <button onClick={() => setNodes(nds => { const minZ = Math.min(0, ...nds.map(n => Number(n.zIndex) || 0)); return nds.map(n => n.id === selectedNodeId ? {...n, zIndex: minZ - 1} : n); })} style={{flex:1, padding:'8px', fontSize:'12px', fontWeight: 'bold', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '4px'}}>↓ 最背面へ</button>
              </div>

              {selectedNode.data?.isImage && (
                <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <button 
                     onClick={() => updateNode({ isCropping: !selectedNode.data?.isCropping })} 
                     style={{ width: '100%', padding: '10px', background: selectedNode.data?.isCropping ? '#ef4444' : '#fff', color: selectedNode.data?.isCropping ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '15px' }}
                  >
                     {selectedNode.data?.isCropping ? '✅ トリミングを完了' : '✂️ トリミング (直接ドラッグ)'}
                  </button>

                  {selectedNode.data?.isCropping ? (
                     <div style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '10px' }}>
                        <p style={{fontSize: '11px', color: '#b91c1c', margin: 0}}><strong>トリミングモード中</strong><br/>・青い枠を動かして切り取るサイズを変更<br/>・画像を直接ドラッグして位置を調整</p>
                     </div>
                  ) : (
                     <>
                        <label style={{fontSize: '11px', fontWeight: 'bold'}}>微調整 (X / Y位置)</label>
                        <input type="range" min="-600" max="600" value={Number(selectedNode.data?.imgPosX || 0)} onChange={(e) => updateNode({ imgPosX: parseInt(e.target.value) })} style={{width:'100%', marginBottom: '5px'}} />
                        <input type="range" min="-600" max="600" value={Number(selectedNode.data?.imgPosY || 0)} onChange={(e) => updateNode({ imgPosY: parseInt(e.target.value) })} style={{width:'100%', marginBottom: '10px'}} />
                     </>
                  )}

                  <label style={{fontSize: '11px', fontWeight: 'bold'}}>ズーム倍率</label>
                  <input type="range" min="0.5" max="3" step="0.1" value={Number(selectedNode.data?.imgZoom || 1)} onChange={(e) => updateNode({ imgZoom: parseFloat(e.target.value) })} style={{width:'100%'}} />
                </div>
              )}
              
              {selectedNode.data?.isShape && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '15px' }}>
                  <button onClick={() => { const size = Math.max(Number(selectedNode.style?.width) || 150, Number(selectedNode.style?.height) || 150); updateNode({ shapeType: 'rect', keepRatio: true }, { borderRadius: '0px', width: size, height: size }); }} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', background: selectedNode.data?.shapeType === 'rect' && selectedNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>■ 正方形</button>
                  <button onClick={() => updateNode({ shapeType: 'rect', keepRatio: false }, { borderRadius: '0px' })} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', background: selectedNode.data?.shapeType === 'rect' && !selectedNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>▬ 長方形</button>
                  <button onClick={() => { const size = Math.max(Number(selectedNode.style?.width) || 150, Number(selectedNode.style?.height) || 150); updateNode({ shapeType: 'circ', keepRatio: true }, { borderRadius: '50%', width: size, height: size }); }} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', background: selectedNode.data?.shapeType === 'circ' && selectedNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>● 正円</button>
                  <button onClick={() => updateNode({ shapeType: 'circ', keepRatio: false }, { borderRadius: '50%' })} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', background: selectedNode.data?.shapeType === 'circ' && !selectedNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>⬭ 楕円</button>
                </div>
              )}

              <label style={{fontSize: '11px', fontWeight: 'bold'}}>文字内容</label>
              <textarea 
                id="node-textarea" 
                value={String(selectedNode.data?.content || '')} 
                onChange={(e) => updateNode({ content: e.target.value })} 
                onSelect={(e) => setSelection({start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd})}
                onClick={(e) => setSelection({start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd})}
                onKeyUp={(e) => setSelection({start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd})}
                style={{ width:'100%', height:'80px', marginBottom: '5px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
              />
              
              <label style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>テキスト編集 (※文字選択で部分編集になります)</label>
              
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'5px', marginTop: '5px' }}>
                <button onClick={() => handleFormat('fontFamily', 'font', 'serif')} style={{cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>明朝</button>
                <button onClick={() => handleFormat('fontFamily', 'font', 'sans-serif')} style={{cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>ゴシック</button>
                <button onClick={() => handleFormat('fontWeight', 'bold', 'true', true)} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px', background: selectedNode.style?.fontWeight === 'bold' ? '#ddd' : '#f0f0f0' }}>太字</button>
                <button onClick={() => handleFormat('textDecoration', 'double', 'true', true)} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px', background: selectedNode.style?.textDecoration?.includes('double') ? '#ddd' : '#f0f0f0' }}>二重線</button>
              </div>

              <div style={{ display: 'flex', gap: '5px', marginTop: '5px', marginBottom: '15px' }}>
                {QUICK_TEXT_COLORS.map(c => <button key={c} onClick={() => handleFormat('color', 'color', c)} style={{ width:'30px', height:'30px', backgroundColor:c, border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }} />)}
                <input type="color" value={String(selectedNode.style?.color || '#000000')} onChange={(e) => handleFormat('color', 'color', e.target.value)} style={{width:'30px', height:'30px', cursor: 'pointer', border: 'none', padding: 0}} />
              </div>

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>文字サイズ (px)</label>
              <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom: '10px'}}>
                <input type="range" min="10" max="250" value={parseInt(String(selectedNode.style?.fontSize || 18))} onChange={(e) => handleFormat('fontSize', 'size', `${e.target.value}px`)} style={{flex:1}} />
                <input type="number" min="10" max="250" value={parseInt(String(selectedNode.style?.fontSize || 18))} onChange={(e) => handleFormat('fontSize', 'size', `${e.target.value}px`)} style={{width:'60px', padding:'4px', border:'1px solid #ccc', borderRadius:'4px'}} />
              </div>

              <hr style={{margin: '15px 0', border: 'none', borderTop: '1px solid #eee'}} />
              <label style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>レイアウト (全体のみ)</label>

              <div style={{ display:'flex', gap:'5px', marginBottom:'5px', marginTop: '5px' }}>
                <button onClick={() => updateNode({}, { justifyContent: 'flex-start', textAlign: 'left' })} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>左</button>
                <button onClick={() => updateNode({}, { justifyContent: 'center', textAlign: 'center' })} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>中央</button>
                <button onClick={() => updateNode({}, { justifyContent: 'flex-end', textAlign: 'right' })} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>右</button>
              </div>
              <div style={{ display:'flex', gap:'5px', marginBottom:'15px' }}>
                <button onClick={() => updateNode({}, { alignItems: 'flex-start' })} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>上</button>
                <button onClick={() => updateNode({}, { alignItems: 'center' })} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>中</button>
                <button onClick={() => updateNode({}, { alignItems: 'flex-end' })} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '5px', borderRadius: '4px'}}>下</button>
              </div>

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>全体の透明度</label>
              <input type="range" min="0.1" max="1" step="0.1" value={Number(selectedNode.style?.opacity ?? 1)} onChange={(e) => updateNode({}, { opacity: parseFloat(e.target.value) })} style={{width:'100%', marginBottom:'15px'}} />

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>背景色</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px', marginTop: '5px', marginBottom: '15px' }}>
                {PASTEL_COLORS.map(c => <button key={c} onClick={() => updateNode({}, { backgroundColor: c })} style={{ width:'100%', aspectRatio:'1', backgroundColor:c, border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer' }} />)}
                <input type="color" value={String(selectedNode.style?.backgroundColor || '#ffffff')} onChange={(e) => updateNode({}, { backgroundColor: e.target.value })} style={{width:'100%', aspectRatio:'1', cursor: 'pointer', border: 'none', padding: 0}} />
              </div>

              {!selectedNode.data?.isShape && !selectedNode.data?.isImage && (
                <>
                  <button onClick={() => updateNode({ previewVisible: !selectedNode.data?.previewVisible })} style={{ width:'100%', marginTop:'10px', padding:'10px', background: selectedNode.data?.previewVisible ? '#3b82f6' : '#fff', color: selectedNode.data?.previewVisible ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {selectedNode.data?.previewVisible ? '💬 吹き出しを消す' : '💬 吹き出しを追加'}
                  </button>
                  {selectedNode.data?.previewVisible && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <p style={{fontSize: '10px', color: '#666', marginBottom: '5px'}}>※位置は画面上で吹き出しを直接ドラッグして動かせます</p>
                      <div style={{display:'flex', alignItems: 'center', gap:'5px', marginBottom:'5px'}}>
                        <div style={{fontSize:'10px', width:'30px'}}>幅</div>
                        <input type="range" min="50" max="500" value={Number(selectedNode.data?.previewStyle?.width || 180)} onChange={(e) => updateNode({ previewStyle: { ...(selectedNode.data?.previewStyle || {}), width: parseInt(e.target.value) } })} style={{flex:1}} />
                      </div>
                      <div style={{display:'flex', alignItems: 'center', gap:'5px', marginBottom:'5px'}}>
                        <div style={{fontSize:'10px', width:'30px'}}>高さ</div>
                        <input type="range" min="50" max="500" value={Number(selectedNode.data?.previewStyle?.height || 120)} onChange={(e) => updateNode({ previewStyle: { ...(selectedNode.data?.previewStyle || {}), height: parseInt(e.target.value) } })} style={{flex:1}} />
                      </div>
                    </div>
                  )}
                </>
              )}
              <button onClick={() => { setNodes(nds => nds.filter(n => n.id !== selectedNodeId)); setSelectedNodeId(null); }} style={{ width:'100%', marginTop:'20px', color: 'red', border: '1px solid red', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', background: '#fffcfc' }}>ゴミ箱へ削除</button>
            </div>
          )}

          {selectedEdge && (
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'320px', borderLeft:'1px solid #ddd', padding:'20px', backgroundColor:'#fff', zIndex:1000 }}>
              <button onClick={() => setSelectedEdge(null)} style={{ float: 'right', border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
              <h3>線のデザイン</h3>
              <label style={{fontSize:'11px', fontWeight: 'bold'}}>太さ</label>
              <div style={{ display:'flex', gap:'5px', marginBottom:'20px', marginTop: '5px' }}>
                {[2, 6, 12].map(w => <button key={w} onClick={() => setEdges(eds => eds.map(e => e.id === selectedEdge.id ? { ...e, style: { ...e.style, strokeWidth: w } } : e))} style={{flex:1, padding:'10px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: selectedEdge.style?.strokeWidth === w ? '#ddd' : '#fff'}}>{w === 2 ? '細' : w === 6 ? '中' : '太'}</button>)}
              </div>
              <label style={{fontSize:'11px', fontWeight: 'bold'}}>種類 (7種)</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginTop: '5px' }}>
                {[{l:'普通',c:{}},{l:'片矢印 (→)',c:{arrow:true}},{l:'二重片矢印 (⇒)',c:{double:true,arrow:true}},{l:'両矢印 (↔)',c:{both:true}},{l:'二重両矢印 (⇔)',c:{double:true,both:true}},{l:'論理和 (∧)',c:{label:'∧'}},{l:'論理積 (∨)',c:{label:'∨'}}].map(item => (
                  <button key={item.l} onClick={() => updateEdgeDesign(item.c)} style={{padding:'10px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', fontWeight: 'bold'}}>{item.l}</button>
                ))}
              </div>
              <button onClick={() => { setEdges(eds => eds.filter(e => e.id !== selectedEdge.id)); setSelectedEdge(null); }} style={{ width:'100%', marginTop:'30px', color: 'red', border: '1px solid red', background: '#fffcfc', padding: '10px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '8px' }}>線を削除</button>
            </div>
          )}
        </div>

        <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.95)', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', zIndex: 1001, boxShadow: '0 -4px 10px rgba(0,0,0,0.03)' }}>
          <button onClick={goBack} disabled={isRoot} style={{ ...actionBtnStyle, opacity: isRoot ? 0.4 : 1, cursor: isRoot ? 'default' : 'pointer' }}>🔙 1つ前へ</button>
          <button onClick={goTop} disabled={isRoot} style={{ ...actionBtnStyle, opacity: isRoot ? 0.4 : 1, cursor: isRoot ? 'default' : 'pointer' }}>🏠 TOP層へ</button>
          <div style={{ width: '1px', height: '30px', backgroundColor: '#ddd', margin: '0 5px' }} />
          <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 })} style={actionBtnStyle}>🎯 中央リセット</button>
          <button onClick={() => addNode('text')} style={primaryBtnStyle}>📝 テキスト</button>
          <button onClick={() => addNode('image')} style={{ ...primaryBtnStyle, backgroundColor: '#10b981', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)' }}>📸 画像</button>
          <button onClick={() => addNode('shape')} style={{ ...primaryBtnStyle, backgroundColor: '#f59e0b', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.3)' }}>🟦 図形</button>
          <div style={{ width: '1px', height: '30px', backgroundColor: '#ddd', margin: '0 5px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#555', backgroundColor: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #ccc' }}>
            <span>🎨 階層の背景色</span>
            <input type="color" value={levelData[currentLevel]?.bgColor || '#ffffff'} onChange={(e) => {
              const newColor = e.target.value;
              setLevelData(prev => ({ ...prev, [currentLevel]: { ...(prev[currentLevel] || {}), bgColor: newColor } }));
            }} style={{width:'24px', height:'24px', cursor:'pointer', border: 'none', padding: 0, borderRadius: '4px'}} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() { return (<ReactFlowProvider><FlowEditor /></ReactFlowProvider>); }
