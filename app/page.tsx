'use client';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge,
  NodeResizer, ReactFlowProvider, useStore, MarkerType, getBezierPath, EdgeProps, BaseEdge, EdgeLabelRenderer, useReactFlow, Position, Handle, ConnectionMode, SelectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const GLOBAL_CSS = `
  .html-content p { margin: 0; }
  .html-content strike { text-decoration: line-through double !important; }
  .html-content * { line-height: 1.2 !important; vertical-align: baseline !important; }
  
  .html-content { user-select: text !important; -webkit-user-select: text !important; }
  
  @media print {
      .no-print { display: none !important; }
      .react-flow__background { display: none !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .react-flow__handle { display: none !important; }
      .react-flow__node { box-shadow: none !important; }
  }

  .react-flow__handle { background: transparent !important; border: none !important; width: 1px !important; height: 1px !important; min-width: 0 !important; min-height: 0 !important; box-shadow: none !important; }
  .custom-handle, .custom-handle-target { width: 24px !important; height: 24px !important; background: transparent !important; border: none !important; z-index: 10 !important; cursor: crosshair !important; pointer-events: auto !important; display: flex; justify-content: center; align-items: center; }
  .custom-handle::before, .custom-handle-target::before { content: ""; display: block; width: 0px; height: 0px; background: #3b82f6; border-radius: 50%; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); border: 2px solid #fff; opacity: 0; }
  .custom-handle:hover::before, .custom-handle-target:hover::before { width: 14px; height: 14px; opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  .custom-handle-offset-top { top: -4px !important; }
  .custom-handle-offset-bottom { bottom: -4px !important; }
  .custom-handle-offset-left { left: -4px !important; }
  .custom-handle-offset-right { right: -4px !important; }
  
  .print-page-wrapper { page-break-after: always; position: relative; overflow: hidden; margin: 0 auto; border: none !important; outline: none !important; }
  .editing-mode { outline: 2px solid #3b82f6 !important; border-radius: 4px; padding: 2px; }
`;

const getEdgePoint = (cx: number, cy: number, w: number, h: number, tx: number, ty: number) => {
  const dx = tx - cx; const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tanTheta = dy / dx; let px, py;
  if (Math.abs(tanTheta) > h / w) { py = cy + (dy > 0 ? h / 2 : -h / 2); px = cx + (py - cy) / tanTheta; } 
  else { px = cx + (dx > 0 ? w / 2 : -w / 2); py = cy + (px - cx) * tanTheta; }
  return { x: px, y: py };
};

const DoubleEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, markerStart, data, label }: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const isDouble = (data as any)?.double; const isEditing = Boolean((data as any)?.isEditing);
  const strokeWidth = Number(style?.strokeWidth) || 1; const edgeColor = (data as any)?.color || '#333';
  const labelStyle = (data as any)?.labelStyle || { textAlign: 'center' }; const fontSize = (data as any)?.fontSize || 14;
  const mType = (data as any)?.markerType;
  const displayLabel = label === undefined || label === null || label === 'undefined' ? '' : String(label);

  let rMarkerEnd = markerEnd; let rMarkerStart = markerStart;
  if (mType === 'custom-double-arrow' || mType === 'custom-double-both') { rMarkerEnd = `url(#custom-arrow-${id})`; }
  if (mType === 'custom-double-both') { rMarkerStart = `url(#custom-arrow-start-${id})`; }
  const customArrowSize = strokeWidth * 1.5 + 16; 

  return (
    <>
      {isDouble && (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker id={`custom-arrow-${id}`} viewBox="0 0 12 12" refX="2" refY="6" markerWidth={customArrowSize} markerHeight={customArrowSize} markerUnits="userSpaceOnUse" orient="auto"><polyline points="2,2 10,6 2,10" fill="none" stroke={edgeColor} strokeWidth={strokeWidth >= 3 ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" /></marker>
            <marker id={`custom-arrow-start-${id}`} viewBox="0 0 12 12" refX="10" refY="6" markerWidth={customArrowSize} markerHeight={customArrowSize} markerUnits="userSpaceOnUse" orient="auto"><polyline points="10,2 2,6 10,10" fill="none" stroke={edgeColor} strokeWidth={strokeWidth >= 3 ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" /></marker>
          </defs>
        </svg>
      )}
      {isDouble ? (
        <>
          <BaseEdge path={edgePath} style={{ ...style, strokeWidth: strokeWidth + 8, stroke: edgeColor }} />
          <BaseEdge path={edgePath} style={{ ...style, strokeWidth: strokeWidth + 4, stroke: 'var(--bg-color, #f1f1f1)' }} />
          <BaseEdge path={edgePath} markerEnd={rMarkerEnd} markerStart={rMarkerStart} style={{ strokeWidth: strokeWidth, stroke: 'transparent', fill: 'none' }} />
        </>
      ) : ( <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} markerStart={markerStart} style={{ ...style, strokeWidth, stroke: edgeColor }} /> )}

      {displayLabel || isEditing ? (
        <EdgeLabelRenderer>
          <div className="no-print" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, zIndex: 1000, pointerEvents: 'auto' }}>
              <div
                  id={`edit-edge-${id}`} className={"nodrag html-content"} contentEditable={isEditing} suppressContentEditableWarning
                  onMouseDown={(e) => { if (isEditing) e.stopPropagation(); }} onKeyDown={(e) => { if (isEditing) e.stopPropagation(); }}
                  onInput={(e) => { (data as any)._tempContent = e.currentTarget.innerHTML; }}
                  onBlur={(e) => { const finalHtml = (data as any)._tempContent ?? e.currentTarget.innerHTML; window.dispatchEvent(new CustomEvent('custom-edge-blur', { detail: { id, html: finalHtml } })); }}
                  style={{ padding: '2px 4px', fontSize: `${fontSize}px`, fontWeight: 'bold', color: '#333', textShadow: '0 0 3px var(--bg-color, #fff), 0 0 3px var(--bg-color, #fff), 0 0 3px var(--bg-color, #fff)', width: '200px', cursor: isEditing ? 'text' : 'pointer', minHeight: '1.2em', outline: 'none', writingMode: (style as any)?.writingMode || 'horizontal-tb', ...labelStyle }}
                  ref={el => {
                      if (!el) return;
                      if (!isEditing) { const newHtml = renderHTMLWithMath(displayLabel); if (el.innerHTML !== newHtml) el.innerHTML = newHtml; el.dataset.editing = 'false'; } 
                      else if (el.dataset.editing !== 'true') {
                          el.dataset.editing = 'true'; el.innerHTML = displayLabel;
                          setTimeout(() => { el.focus(); if (typeof window.getSelection !== 'undefined') { const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(el); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range); } }, 10);
                      }
                  }}
              />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};

function SmartGuides({ guides }: { guides: { lineX?: number, lineY?: number } }) {
  const transform = useStore(s => s.transform);
  if (guides.lineX === undefined && guides.lineY === undefined) return null;
  return (
    <div className="no-print" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {guides.lineX !== undefined && <div style={{ position: 'absolute', left: guides.lineX * transform[2] + transform[0], top: 0, width: '1px', height: '100%', backgroundColor: '#ef4444' }} />}
      {guides.lineY !== undefined && <div style={{ position: 'absolute', top: guides.lineY * transform[2] + transform[1], left: 0, height: '1px', width: '100%', backgroundColor: '#ef4444' }} />}
    </div>
  );
}

const renderHTMLWithMath = (html: string) => {
  if (!html) return '';
  try {
      let parsed = html.replace(/\$\$(.*?)\$\$/g, (_, math) => katex.renderToString(math, {displayMode: true, throwOnError: false}));
      parsed = parsed.replace(/\$(.*?)\$/g, (_, math) => katex.renderToString(math, {displayMode: false, throwOnError: false}));
      return parsed;
  } catch(e) { return html; }
};

const extractFirstLineText = (html: string) => {
  if (!html) return '名称未設定';
  const tempDiv = document.createElement('div'); tempDiv.innerHTML = html.replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  const text = tempDiv.textContent || tempDiv.innerText || '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const firstLine = lines[0] || '名称未設定';
  return firstLine.length > 15 ? firstLine.substring(0, 15) + '...' : firstLine;
};

const safeCloneNodes = (nds: any[]) => nds.map(n => ({ ...n, data: { ...n.data }, style: { ...n.style }, position: { ...n.position }, width: n.width, height: n.height }));
const safeCloneEdges = (eds: any[]) => eds.map(e => ({ ...e, data: { ...e.data }, style: { ...e.style }, zIndex: e.zIndex }));
const edgeTypes = { default: DoubleEdge };
const PASTEL_COLORS = ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F3E5F5', '#E1F5FE', '#FFF9C4', '#FCE4EC', '#E8F5E9'];
const QUICK_TEXT_COLORS = ['#000000', '#FF0000', '#008000', '#0000FF', '#FFF000'];

type TableActionType = {
    id: string;
    type: string;
    startX: number;
    startY: number;
    startR: number; 
    startC: number; 
    minC: number;  
    maxC: number;  
    minR: number;  
    maxR: number;  
    initWidths: number[];
    initHeights: number[];
};

function FlowEditor() {
  const { setViewport, getZoom } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTopBarOpen, setIsTopBarOpen] = useState(true);
  const [isBottomBarOpen, setIsBottomBarOpen] = useState(true);
  
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isExecutingPrint, setIsExecutingPrint] = useState(false);
  const [isLassoMode, setIsLassoMode] = useState(false);

  const [files, setFiles] = useState<Record<string, any>>({});
  const [activeFileId, setActiveFileId] = useState<string>('default');
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [levelData, setLevelData] = useState<Record<string, { nodes: any[]; edges: any[]; bgColor?: string; label?: string }>>({});
  
  const [historyLevel, setHistoryLevel] = useState<string[]>([]);
  const [currentLevel, setCurrentLevel] = useState('root');
  const [currentLabel, setCurrentLabel] = useState('TOP層');
  const [guides, setGuides] = useState<{ lineX?: number, lineY?: number }>({});
  
  const [partialFontSize, setPartialFontSize] = useState<number>(14);
  const [selectedCells, setSelectedCells] = useState<Record<string, string[]>>({});
  const [tableBorderWidth, setTableBorderWidth] = useState('1px');
  const [tableBorderStyle, setTableBorderStyle] = useState('solid');
  const [tableBorderColor, setTableBorderColor] = useState('#000000');
  
  const previewDragRef = useRef<{ id: string, startX: number, startY: number, initX: number, initY: number, moved: boolean } | null>(null);
  const imageCropDragRef = useRef<{ id: string, startX: number, startY: number, initX: number, initY: number } | null>(null);
  
  const tableActionRef = useRef<TableActionType | null>(null);
  const copiedTableCellsRef = useRef<any>(null); // ★ テーブルセル専用のコピペデータ保存箱

  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);
  const copiedNodesRef = useRef<any[]>([]);
  const currentLabelRef = useRef<string>(currentLabel);
  
  const [past, setPast] = useState<{nodes: any[], edges: any[]}[]>([]);
  const [future, setFuture] = useState<{nodes: any[], edges: any[]}[]>([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { currentLabelRef.current = currentLabel; }, [currentLabel]);

  const selectedNodes = useMemo(() => nodes.filter((n: any) => n.selected), [nodes]);
  const primaryNode = selectedNodes.length > 0 ? selectedNodes[0] : null;
  const selectedEdge = useMemo(() => edges.find((e: any) => e.selected) || null, [edges]);

  const isTableEditing = primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0;

  const clearSelection = useCallback(() => {
    setNodes((nds: any[]) => nds.map((n: any) => ({...n, selected: false, data: { ...n.data, isEditing: false, editingCell: null, _tempContent: undefined }})));
    setEdges((eds: any[]) => eds.map((e: any) => ({...e, selected: false, data: { ...e.data, isEditing: false, _tempContent: undefined }})));
    setSelectedCells({});
  }, []);

  const takeSnapshot = useCallback(() => {
      setPast(p => [...p.slice(-40), { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current) }]);
      setFuture([]);
  }, []);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      setFuture(f => [{ nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current) }, ...f]);
      setPast(p => p.slice(0, -1));
      setNodes(safeCloneNodes(previous.nodes));
      setEdges(safeCloneEdges(previous.edges));
  }, [past]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      setPast(p => [...p, { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current) }]);
      setFuture(f => f.slice(1));
      setNodes(safeCloneNodes(next.nodes));
      setEdges(safeCloneEdges(next.edges));
  }, [future]);

  const selectCellsBox = useCallback((nodeId: string, r1: number, c1: number, r2: number, c2: number, append: boolean) => {
      const minR = Math.min(r1, r2); const maxR = Math.max(r1, r2);
      const minC = Math.min(c1, c2); const maxC = Math.max(c1, c2);
      const newSel: string[] = [];
      for(let i=minR; i<=maxR; i++) { for(let j=minC; j<=maxC; j++) { newSel.push(`${i}-${j}`); } }
      setSelectedCells(prev => {
          if (append) return { ...prev, [nodeId]: Array.from(new Set([...(prev[nodeId]||[]), ...newSel])) };
          return { ...prev, [nodeId]: newSel };
      });
      setNodes((nds: any[]) => nds.map((node: any) => node.id === nodeId ? { ...node, selected: true } : { ...node, selected: false, data: { ...node.data, isEditing: false, editingCell: null } }));
  }, []);

  const addTableRowCol = (type: 'row' | 'col') => {
      takeSnapshot();
      if (!primaryNode || !primaryNode.data.isTable) return;
      setNodes(nds => nds.map(n => {
          if (n.id !== primaryNode.id) return n;
          const newRows = type === 'row' ? n.data.rows + 1 : n.data.rows;
          const newCols = type === 'col' ? n.data.cols + 1 : n.data.cols;
          const newCells = { ...n.data.cells };
          const newColWidths = [...(n.data.colWidths || Array(n.data.cols).fill(100))];
          const newRowHeights = [...(n.data.rowHeights || Array(n.data.rows).fill(40))];
          
          if (type === 'row') {
              newRowHeights.push(40);
              for(let c=0; c<newCols; c++) newCells[`${newRows-1}-${c}`] = { content: '', style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } };
          }
          if (type === 'col') {
              newColWidths.push(100);
              for(let r=0; r<newRows; r++) newCells[`${r}-${newCols-1}`] = { content: '', style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } };
          }
          return { ...n, data: { ...n.data, rows: newRows, cols: newCols, cells: newCells, colWidths: newColWidths, rowHeights: newRowHeights } };
      }));
  };

  useEffect(() => {
    if (primaryNode && !primaryNode.data?.isTable) {
        let size = primaryNode.style?.fontSize;
        if (typeof size === 'string') size = size.replace('px', '');
        setPartialFontSize(parseInt(String(size || 14)));
    }
  }, [primaryNode?.id, primaryNode?.style?.fontSize, primaryNode?.data?.isTable]);

  useEffect(() => {
    const saved = localStorage.getItem('my-logic-files');
    if (saved) {
      const parsed = JSON.parse(saved); setFiles(parsed);
      const lastId = localStorage.getItem('my-logic-active-id') || 'default';
      if (parsed[lastId]) loadFileInitial(lastId, parsed);
    } else {
      const initial = { 'default': { name: '無題のノート', levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } }, currentLevel: 'root', currentLabel: 'TOP層' } };
      setFiles(initial); localStorage.setItem('my-logic-files', JSON.stringify(initial));
    }
  }, []);

  const handleManualSave = useCallback(() => {
    setFiles(prev => {
        const currentFileData = prev[activeFileId]; if (!currentFileData) return prev;
        const updatedLevelData = { ...levelData, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: levelData[currentLevel]?.bgColor, label: currentLabelRef.current } };
        const updatedFiles = { ...prev, [activeFileId]: { ...currentFileData, levelData: updatedLevelData, currentLevel, currentLabel: currentLabelRef.current } };
        localStorage.setItem('my-logic-files', JSON.stringify(updatedFiles));
        localStorage.setItem('my-logic-active-id', activeFileId);
        return updatedFiles;
    });
    alert('💾 ノートを正常に保存しました！');
  }, [activeFileId, currentLevel, levelData]);

  const exportData = useCallback(() => {
      handleManualSave(); 
      setTimeout(() => {
          const currentData = localStorage.getItem('my-logic-files'); if (!currentData) return;
          const blob = new Blob([currentData], { type: "application/json" }); const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `logic-notes-backup-${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }, 100);
  }, [handleManualSave]);

  const importData = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const parsed = JSON.parse(ev.target?.result as string);
              if (parsed && typeof parsed === 'object') {
                  setFiles(parsed); localStorage.setItem('my-logic-files', JSON.stringify(parsed));
                  const firstId = Object.keys(parsed)[0];
                  if (firstId) { localStorage.setItem('my-logic-active-id', firstId); loadFileInitial(firstId, parsed); }
                  alert('🎉 データを正常に読み込みました！');
              }
          } catch(err) { alert('❌ ファイルの読み込みに失敗しました。'); }
      };
      reader.readAsText(file); if (jsonImportRef.current) jsonImportRef.current.value = ''; 
  }, []);

  const togglePrintMode = useCallback(() => {
      setIsPrintMode(prev => {
          const next = !prev;
          if (next) {
              setNodes(nds => {
                  if (nds.some(n => n.type === 'printZone')) return nds;
                  return [...nds, { id: `print-zone-${Date.now()}`, type: 'printZone', position: { x: 0, y: 0 }, data: { label: '印刷範囲 1' }, style: { width: 800, height: 1130 }, width: 800, height: 1130, zIndex: 99999 }];
              });
          } else { setNodes(nds => nds.filter(n => n.type !== 'printZone')); }
          return next;
      });
  }, []);

  const addPrintZone = useCallback(() => {
      setNodes(nds => {
          const count = nds.filter(n => n.type === 'printZone').length;
          return [...nds, { id: `print-zone-${Date.now()}`, type: 'printZone', position: { x: count * 50, y: count * 50 }, data: { label: `印刷範囲 ${count + 1}` }, style: { width: 800, height: 1130 }, width: 800, height: 1130, zIndex: 99999 }];
      });
  }, []);

  const executePrint = useCallback(() => { clearSelection(); setIsExecutingPrint(true); setTimeout(() => { window.print(); setTimeout(() => { setIsExecutingPrint(false); }, 500); }, 1500); }, [clearSelection]);

  const loadFileInitial = (id: string, allFiles = files) => {
    const target = allFiles[id]; if (!target) return;
    const loadedLevelData = target.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } };
    const initialLevel = target.currentLevel || 'root';
    setActiveFileId(id); setLevelData(loadedLevelData); setCurrentLevel(initialLevel); setCurrentLabel(loadedLevelData[initialLevel]?.label || target.currentLabel || 'TOP層');
    setNodes(loadedLevelData[initialLevel]?.nodes || []); setEdges(loadedLevelData[initialLevel]?.edges || []); setHistoryLevel([]); setPast([]); setFuture([]); setSelectedCells({});
  };

  const switchFile = (newId: string) => {
    setFiles(prev => {
        const currentFileData = prev[activeFileId];
        if (currentFileData) {
            const updatedLevelData = { ...levelData, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: levelData[currentLevel]?.bgColor, label: currentLabelRef.current } };
            return { ...prev, [activeFileId]: { ...currentFileData, levelData: updatedLevelData, currentLevel, currentLabel: currentLabelRef.current } };
        }
        return prev;
    });
    setTimeout(() => {
      setFiles(currentFiles => {
        const target = currentFiles[newId];
        if (target) {
          setActiveFileId(newId); const nextLevelData = target.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } }; const nextLevel = target.currentLevel || 'root';
          setLevelData(nextLevelData); setCurrentLevel(nextLevel); setCurrentLabel(nextLevelData[nextLevel]?.label || target.currentLabel || 'TOP層');
          setNodes(nextLevelData[nextLevel]?.nodes || []); setEdges(nextLevelData[nextLevel]?.edges || []); setPast([]); setFuture([]); setSelectedCells({});
        }
        return currentFiles;
      });
    }, 0);
  };

  const createNewFile = () => {
    const name = prompt("ファイル名", `ノート ${Object.keys(files).length + 1}`); if (!name) return;
    const newId = `file-${Date.now()}`; const newF = { name, levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } }, currentLevel: 'root', currentLabel: 'TOP層' };
    setFiles(prev => ({ ...prev, [newId]: newF })); switchFile(newId);
  };

  const deleteFile = (id: string) => {
    if (Object.keys(files).length <= 1) return; if (!confirm("削除しますか？")) return;
    const updated = { ...files }; delete updated[id]; setFiles(updated); if (id === activeFileId) switchFile(Object.keys(updated)[0]);
  };

  const updateSelectedNodes = useCallback((newData: any, newStyle: any = {}) => {
    setNodes((nds: any[]) => nds.map((n: any) => n.selected ? { ...n, data: { ...(n.data || {}), ...(typeof newData === 'function' ? newData(n.data) : newData) }, style: { ...(n.style || {}), ...newStyle } } : n));
  }, []);

  const updateEdgeDesign = useCallback((config: any) => {
    takeSnapshot();
    setEdges((eds: any[]) => eds.map((e: any) => {
      if (!e.selected) return e;
      const newStrokeWidth = config.strokeWidth !== undefined ? config.strokeWidth : (Number(e.style?.strokeWidth) || 1);
      const newColor = config.color !== undefined ? config.color : (e.data?.color || '#333');
      const mSize = Math.max(12, newStrokeWidth * 3); const baseMarker = { type: MarkerType.ArrowClosed, color: newColor, width: mSize, height: mSize };
      
      let newDouble = config.double !== undefined ? config.double : e.data?.double; let newMarkerType = config.markerType !== undefined ? config.markerType : e.data?.markerType; let newLabel = config.label !== undefined ? config.label : e.label;
      if (config.resetDesign) { newDouble = config.double || false; newMarkerType = config.markerType || 'none'; if(config.label !== undefined) newLabel = config.label; }

      let mEnd = undefined; let mStart = undefined;
      if (newMarkerType === 'arrow') { mEnd = baseMarker; } if (newMarkerType === 'both') { mEnd = baseMarker; mStart = baseMarker; }

      const newLabelStyle = config.labelStyle !== undefined ? config.labelStyle : e.data?.labelStyle;
      const newFontSize = config.fontSize !== undefined ? config.fontSize : (e.data?.fontSize || 14);

      return { ...e, style: { ...e.style, strokeWidth: newStrokeWidth, stroke: newColor }, data: { ...(e.data || {}), double: newDouble, color: newColor, labelStyle: newLabelStyle, fontSize: newFontSize, markerType: newMarkerType }, markerEnd: mEnd, markerStart: mStart, label: newLabel };
    }));
  }, [takeSnapshot]);

  const applyUnifiedFormat = (type: string, value: any = '') => {
      const activeEl = document.activeElement as HTMLElement;
      if (!activeEl || (!activeEl.isContentEditable && activeEl.tagName !== 'DIV')) { alert('文字を選択してから実行してください。'); return; }
      takeSnapshot();
      if (type === 'fontSize') {
          document.execCommand('fontSize', false, '7');
          const fonts = activeEl.querySelectorAll('font[size="7"], span');
          fonts.forEach((f) => {
              const element = f as HTMLElement;
              if (element.tagName === 'FONT' && element.getAttribute('size') === '7') { element.removeAttribute('size'); element.style.fontSize = value; element.style.lineHeight = '1.2'; } 
              else if (element.tagName === 'SPAN') { const size = element.style.fontSize; if (size === '48px' || size === 'xxx-large' || size === '-webkit-xxx-large') { element.style.fontSize = value; element.style.lineHeight = '1.2'; } }
          });
      } else { document.execCommand(type, false, value); }
  };

  const handleResetFormat = () => {
      const activeEl = document.activeElement as HTMLElement;
      if (!activeEl || (!activeEl.isContentEditable && activeEl.tagName !== 'DIV')) { alert('文字を選択してから実行してください。'); return; }
      takeSnapshot();
      document.execCommand('removeFormat'); document.execCommand('fontSize', false, '7');
      const fonts = activeEl.querySelectorAll('font[size="7"], span');
      fonts.forEach((f) => {
          const element = f as HTMLElement;
          if (element.tagName === 'FONT' || element.tagName === 'SPAN') { element.removeAttribute('size'); element.style.fontSize = '14px'; element.style.color = '#000000'; element.style.fontWeight = 'normal'; element.style.textDecoration = 'none'; element.style.fontFamily = 'sans-serif'; element.style.lineHeight = '1.2'; }
      });
  };

  const handleLayout = (hAlign?: string, vAlign?: string, wMode?: string) => {
      takeSnapshot();
      if (primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0) {
          const activeCells = selectedCells[primaryNode.id];
          setNodes(nds => nds.map(n => {
              if (n.id !== primaryNode.id) return n;
              const newCells = { ...n.data.cells };
              activeCells.forEach(cId => {
                  const cell = newCells[cId] || { content: '', style: {} }; let newStyle = { ...cell.style };
                  if (hAlign) newStyle.hAlign = hAlign; if (vAlign) newStyle.vAlign = vAlign; if (wMode) newStyle.writingMode = wMode;
                  if (wMode === 'vertical-rl') { if (!hAlign) newStyle.hAlign = 'right'; if (!vAlign) newStyle.vAlign = 'top'; } 
                  else if (wMode === 'horizontal-tb') { if (!hAlign) newStyle.hAlign = 'left'; if (!vAlign) newStyle.vAlign = 'top'; }
                  newCells[cId] = { ...cell, style: newStyle };
              });
              return { ...n, data: { ...n.data, cells: newCells } };
          }));
      } else {
          let styleUpdate: any = {};
          if (hAlign) styleUpdate.hAlign = hAlign; if (vAlign) styleUpdate.vAlign = vAlign; if (wMode) styleUpdate.writingMode = wMode;
          if (wMode === 'vertical-rl') { if (!hAlign) styleUpdate.hAlign = 'right'; if (!vAlign) styleUpdate.vAlign = 'top'; } 
          else if (wMode === 'horizontal-tb') { if (!hAlign) styleUpdate.hAlign = 'left'; if (!vAlign) styleUpdate.vAlign = 'top'; }
          updateSelectedNodes({}, styleUpdate);
      }
  };

  const applyTableBorder = () => {
      takeSnapshot();
      if (!primaryNode || !primaryNode.data.isTable) return;
      const activeCells = selectedCells[primaryNode.id] || []; if (activeCells.length === 0) return;
      setNodes(nds => nds.map(n => {
          if (n.id !== primaryNode.id) return n;
          const newCells = { ...n.data.cells };
          activeCells.forEach(cId => { newCells[cId] = { ...newCells[cId], style: { ...newCells[cId]?.style, border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` } }; });
          return { ...n, data: { ...n.data, cells: newCells } };
      }));
  };

  const handleCopy = useCallback(() => { const selected = nodesRef.current.filter(n => n.selected); if (selected.length > 0) copiedNodesRef.current = safeCloneNodes(selected); }, []);
  
  const handlePaste = useCallback(() => {
    if (copiedNodesRef.current && copiedNodesRef.current.length > 0) {
        takeSnapshot();
        const newNodes = copiedNodesRef.current.map(original => { const newId = `node-${Date.now()}-${Math.random()}`; return { ...original, id: newId, selected: true, position: { x: original.position.x + 30, y: original.position.y + 30 }, zIndex: Math.max(0, ...nodesRef.current.map(n => Number(n.zIndex) || 0)) + 1 }; });
        setNodes((nds: any[]) => [...nds.map((n: any) => ({...n, selected: false})), ...newNodes]);
    }
  }, [takeSnapshot]);
  
  const handleDuplicate = useCallback(() => { handleCopy(); setTimeout(handlePaste, 10); }, [handleCopy, handlePaste]);

  // ★ テーブルのセル専用コピー機能
  const handleCellCopy = useCallback(() => {
      if (!primaryNode || !primaryNode.data.isTable) return;
      const cells = selectedCells[primaryNode.id] || [];
      if (cells.length === 0) return;
      
      let minR = 9999, maxR = -1, minC = 9999, maxC = -1;
      cells.forEach(c => {
          const [r, col] = c.split('-').map(Number);
          if(r < minR) minR = r; if(r > maxR) maxR = r;
          if(col < minC) minC = col; if(col > maxC) maxC = col;
      });
      
      const copiedData: any = { single: cells.length === 1, grid: [], widths: [], heights: [] };
      for (let i = minR; i <= maxR; i++) {
          const row = [];
          copiedData.heights.push((primaryNode.data.rowHeights || [])[i] || 40);
          for (let j = minC; j <= maxC; j++) {
              if (i === minR) copiedData.widths.push((primaryNode.data.colWidths || [])[j] || 100);
              const cid = `${i}-${j}`;
              row.push({ ...primaryNode.data.cells[cid] });
          }
          copiedData.grid.push(row);
      }
      copiedTableCellsRef.current = copiedData;
  }, [primaryNode, selectedCells]);

  // ★ テーブルのセル専用ペースト機能
  const handleCellPaste = useCallback(() => {
      if (!primaryNode || !primaryNode.data.isTable || !copiedTableCellsRef.current) return;
      takeSnapshot();
      
      setNodes(nds => nds.map(n => {
          if (n.id !== primaryNode.id) return n;
          const copied = copiedTableCellsRef.current;
          const newCells = { ...n.data.cells };
          const newColWidths = [...(n.data.colWidths || Array(n.data.cols).fill(100))];
          const newRowHeights = [...(n.data.rowHeights || Array(n.data.rows).fill(40))];
          
          const targets = selectedCells[n.id] || [];
          if (targets.length === 0) return n;
          
          if (copied.single) {
              const sourceCell = copied.grid[0][0];
              const sourceW = copied.widths[0];
              const sourceH = copied.heights[0];
              targets.forEach((cid: string) => {
                  const [r, c] = cid.split('-').map(Number);
                  newCells[cid] = { ...sourceCell };
                  newColWidths[c] = sourceW;
                  newRowHeights[r] = sourceH;
              });
          } else {
              let minR = 9999, minC = 9999;
              targets.forEach((c: string) => {
                  const [r, col] = c.split('-').map(Number);
                  if(r < minR) minR = r;
                  if(col < minC) minC = col;
              });
              
              copied.grid.forEach((rowArr: any[], i: number) => {
                  const targetR = minR + i;
                  if (targetR < n.data.rows) {
                      newRowHeights[targetR] = copied.heights[i];
                      rowArr.forEach((cellData: any, j: number) => {
                          const targetC = minC + j;
                          if (targetC < n.data.cols) {
                              if (i === 0) newColWidths[targetC] = copied.widths[j];
                              newCells[`${targetR}-${targetC}`] = { ...cellData };
                          }
                      });
                  }
              });
          }
          return { ...n, data: { ...n.data, cells: newCells, colWidths: newColWidths, rowHeights: newRowHeights } };
      }));
  }, [primaryNode, selectedCells, takeSnapshot]);


  const enterLevel = useCallback((id: string, defaultLabel: string) => {
    setLevelData(prev => ({ ...prev, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: prev[currentLevel]?.bgColor, label: currentLabelRef.current } }));
    setNodes((nds: any[]) => {
      const target = nds.find((n: any) => n.id === id); if (target?.data?.isShape || target?.data?.isImage || target?.data?.isTable) return nds;
      setHistoryLevel(prev => [...prev, currentLevel]); setCurrentLevel(id); setSelectedCells({});
      const nextData = levelData[id] || { nodes: [], edges: [] }; setCurrentLabel(nextData.label && nextData.label !== '階層中' ? nextData.label : defaultLabel || '階層中');
      setEdges((nextData.edges || []).map((e:any) => ({...e, selected: false}))); setPast([]); setFuture([]);
      return (nextData.nodes || []).map((n:any) => ({...n, selected: false}));
    });
  }, [currentLevel, levelData]);

  const goBack = () => {
    if (historyLevel.length === 0) return;
    const newHist = [...historyLevel]; const prevLevel = newHist.pop()!;
    setLevelData(prev => ({ ...prev, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: prev[currentLevel]?.bgColor, label: currentLabelRef.current } }));
    setCurrentLevel(prevLevel); setHistoryLevel(newHist); setSelectedCells({});
    const prevData = levelData[prevLevel] || { nodes: [], edges: [] }; setCurrentLabel(prevData.label || (prevLevel === 'root' ? 'TOP層' : '階層中'));
    setNodes((prevData.nodes || []).map((n:any) => ({...n, selected: false}))); setEdges((prevData.edges || []).map((e:any) => ({...e, selected: false}))); setPast([]); setFuture([]);
  };

  const goTop = () => {
    if (historyLevel.length === 0) return;
    setLevelData(prev => ({ ...prev, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: prev[currentLevel]?.bgColor, label: currentLabelRef.current } }));
    setCurrentLevel('root'); setHistoryLevel([]); setSelectedCells({});
    const rootData = levelData['root'] || { nodes: [], edges: [] }; setCurrentLabel(rootData.label || 'TOP層');
    setNodes((rootData.nodes || []).map((n:any) => ({...n, selected: false}))); setEdges((rootData.edges || []).map((e:any) => ({...e, selected: false}))); setPast([]); setFuture([]);
  };

  const addNode = useCallback((type: 'text' | 'image' | 'shape' | 'table') => {
    takeSnapshot(); const id = `node-${Date.now()}`; const selNodes = nodesRef.current.filter(n => n.selected); const parent = selNodes.length === 1 ? selNodes[0] : null;

    let data: any = { content: '項目', previewVisible: false, previewStyle: { opacity: 0.7, offsetX: 0, offsetY: -150, width: 180, height: 120 }, textOffsetX: 0, textOffsetY: 0, isEditing: false, tableTitle: '' };
    let style: any = { backgroundColor: '#ffffff', color: '#000000', borderRadius: '12px', fontSize: '14px', fontFamily: 'sans-serif', width: 200, height: 100, hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb', padding: '4px', borderColor: 'transparent' };
    
    if (type === 'image') { fileInputRef.current?.click(); return; }
    if (type === 'shape') { data = { content: '', isShape: true, shapeType: 'rect', keepRatio: false, textOffsetX: 0, textOffsetY: 0, isEditing: false }; style = { ...style, backgroundColor: '#eee', borderRadius: '4px', border: '3px solid #333', borderColor: '#333' }; }
    if (type === 'table') {
      data = { 
          isTable: true, rows: 2, cols: 2, textOffsetX: 0, textOffsetY: 0, editingCell: null, tableTitle: '',
          cells: { "0-0": { content: "セル", style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }, "0-1": { content: "セル", style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }, "1-0": { content: "セル", style: { border: '1px solid #333', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }, "1-1": { content: "セル", style: { border: '1px solid #333', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } } } 
      };
      style = { ...style, width: 300, height: 150, padding: 0, backgroundColor: '#fff', display: 'block', borderRadius: '8px', border: '2px solid #ccc', borderColor: '#ccc' };
    }

    if (parent && (type === 'text' || type === 'table')) {
        const sourceHandle = 'bottom-src'; const targetHandle = 'top-tgt'; const edgeId = `e-${parent.id}-${id}`;
        setEdges((eds: any[]) => [...eds.map((e: any) => ({...e, selected:false})), { id: edgeId, source: parent.id, target: id, sourceHandle, targetHandle, type: 'default', label: '', style: { strokeWidth: 1 }, zIndex: 0 }]);
        setNodes((nds: any[]) => {
            const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0)); const parentW = Number(parent.style?.width || 200); const parentH = Number(parent.style?.height || 100);
            const newX = parent.position.x; const newY = parent.position.y + parentH + 80;
            const newNode = { id, selected: true, position: { x: newX, y: newY }, data, style, zIndex: maxZ + 1 };
            let updatedNodes = [...nds.map((n: any) => ({...n, selected: false})), newNode];
            const childIds = edgesRef.current.filter(e => e.source === parent.id).map(e => e.target).concat(id);
            const children = updatedNodes.filter(n => childIds.includes(n.id));
            if (children.length > 0) { const spacing = 240; const totalSpan = (children.length - 1) * spacing; const startPos = (parent.position.x + parentW/2) - totalSpan / 2; children.forEach((child, index) => { const childNode = updatedNodes.find(n => n.id === child.id); if (childNode) { const childW = Number(childNode.style?.width || 200); childNode.position = { x: startPos + index * spacing - (childW / 2), y: newY }; } }); }
            return updatedNodes;
        });
    } else { setNodes((nds: any[]) => { const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0)); return [...nds.map((n: any) => ({...n, selected: false})), { id, selected: true, position: { x: 100, y: 100 }, data, style, zIndex: maxZ + 1 }]; }); }
  }, [takeSnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement; const isContentEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
      if (isContentEditing && e.key !== 'Tab') { return; }

      if (e.key === 'Tab') {
          const isNodeEditing = nodesRef.current.some(n => n.data?.isEditing || n.data?.editingCell); const isEdgeEditing = edgesRef.current.some(edge => edge.data?.isEditing);
          if (!isNodeEditing && !isEdgeEditing) {
              e.preventDefault();
              if (selectedNodes.length === 1) {
                  const node = selectedNodes[0];
                  if (node.data?.isTable) { const activeCells = selectedCells[node.id] || []; if (activeCells.length > 0) { setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, editingCell: activeCells[0] } } : n)); } } 
                  else { setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isEditing: true } } : n)); }
              } else if (selectedEdge) { setEdges(eds => eds.map(edge => edge.id === selectedEdge.id ? { ...edge, data: { ...edge.data, isEditing: true } } : edge)); }
          }
          return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleManualSave(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { if (e.shiftKey) { e.preventDefault(); redo(); } else { e.preventDefault(); undo(); } return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return; }
      if (isContentEditing) return;

      if (e.key === 'Enter') { e.preventDefault(); addNode('text'); }
      // ★ コピペ処理を統合：テーブル選択時はセルのコピペ、そうでない時は図形のコピペ
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c') { 
          e.preventDefault(); 
          const isTableSelected = primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0;
          if (isTableSelected) { handleCellCopy(); } else { handleCopy(); }
      } 
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') { 
          e.preventDefault(); 
          const isTableSelected = primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0;
          if (isTableSelected && copiedTableCellsRef.current) { handleCellPaste(); } else { handlePaste(); }
      }
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); takeSnapshot(); const selIds = nodesRef.current.filter(n => n.selected).map(n => n.id); setNodes((nds: any[]) => nds.filter((n: any) => !n.selected)); setEdges((eds: any[]) => eds.filter((e: any) => !e.selected && !selIds.includes(e.source) && !selIds.includes(e.target))); setSelectedCells({}); }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addNode, handleCopy, handlePaste, handleCellCopy, handleCellPaste, undo, redo, takeSnapshot, handleManualSave, selectedNodes.length, selectedEdge, selectedCells, primaryNode]);

  useEffect(() => {
      const handleEdgeBlur = (e: any) => { const { id, html } = e.detail; setEdges(eds => eds.map(edge => edge.id === id ? { ...edge, label: html, data: { ...edge.data, isEditing: false, _tempContent: undefined } } : edge)); };
      window.addEventListener('custom-edge-blur', handleEdgeBlur); return () => window.removeEventListener('custom-edge-blur', handleEdgeBlur);
  }, []);

  // ★ 統合ドラッグ＆等間隔リサイズ処理
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const zoom = getZoom();
      
      const action = tableActionRef.current;
      if (action) {
          const dx = (e.clientX - action.startX) / zoom;
          const dy = (e.clientY - action.startY) / zoom;
          
          if (action.type.startsWith('resize')) {
              setNodes((nds: any[]) => nds.map((n: any) => {
                  if (n.id !== action.id) return n;
                  const newWidths = [...(n.data.colWidths || Array(n.data.cols).fill(100))];
                  const newHeights = [...(n.data.rowHeights || Array(n.data.rows).fill(40))];
                  
                  // ★ 選択された列幅を等分にリサイズ
                  if (action.type.includes('col') || action.type.includes('xy')) {
                      const numCols = action.maxC - action.minC + 1;
                      const deltaPerCol = dx / numCols;
                      for (let c = action.minC; c <= action.maxC; c++) {
                          newWidths[c] = Math.max(30, action.initWidths[c] + deltaPerCol);
                      }
                  }
                  // ★ 選択された行高を等分にリサイズ
                  if (action.type.includes('row') || action.type.includes('xy')) {
                      const numRows = action.maxR - action.minR + 1;
                      const deltaPerRow = dy / numRows;
                      for (let r = action.minR; r <= action.maxR; r++) {
                          newHeights[r] = Math.max(20, action.initHeights[r] + deltaPerRow);
                      }
                  }
                  return { ...n, data: { ...n.data, colWidths: newWidths, rowHeights: newHeights } };
              }));
          }
      }

      const drag = previewDragRef.current;
      if (drag) { const dx = (e.clientX - drag.startX) / zoom; const dy = (e.clientY - drag.startY) / zoom; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true; setNodes((nds: any[]) => nds.map((n: any) => n.id === drag.id ? { ...n, data: { ...(n.data || {}), previewStyle: { ...(n.data?.previewStyle || {}), offsetX: drag.initX + dx, offsetY: drag.initY + dy } } } : n)); }
      const imgDrag = imageCropDragRef.current;
      if (imgDrag) { const dx = (e.clientX - imgDrag.startX) / zoom; const dy = (e.clientY - imgDrag.startY) / zoom; setNodes((nds: any[]) => nds.map((n: any) => n.id === imgDrag.id ? { ...n, data: { ...(n.data || {}), imgPosX: imgDrag.initX + dx, imgPosY: imgDrag.initY + dy } } : n)); }
    };
    const onMouseUp = () => { setTimeout(() => { previewDragRef.current = null; }, 50); imageCropDragRef.current = null; tableActionRef.current = null; };
    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [getZoom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (ev) => {
      takeSnapshot();
      setNodes((nds: any[]) => {
        const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0));
        return [...nds.map((n: any) => ({...n, selected: false})), { id: `img-${Date.now()}`, position: { x: 50, y: 50 }, zIndex: maxZ + 1, selected: true, data: { isImage: true, imageUrl: ev.target?.result, imgPosX: 0, imgPosY: 0, imgZoom: 1, isCropping: false, cropBaseW: 300, cropBaseH: 200, cropOffsetX: 0, cropOffsetY: 0, textOffsetX: 0, textOffsetY: 0 }, style: { width: 300, height: 200, background: '#fff', padding: 0, border: '1px solid #ccc', borderColor: '#ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }];
      });
    }; reader.readAsDataURL(file);
  };

  const onNodeDrag = useCallback((_: any, node: any) => {
    let snapX: number | undefined, snapY: number | undefined; let lineX: number | undefined, lineY: number | undefined; let snapDiffX = 15, snapDiffY = 15;
    const nW = Number(node.style?.width) || 200; const nH = Number(node.style?.height) || 100;
    const nLeft = node.position.x, nCenter = node.position.x + nW / 2, nRight = node.position.x + nW; const nTop = node.position.y, nMiddle = node.position.y + nH / 2, nBottom = node.position.y + nH;
    nodes.forEach(t => {
      if (t.id === node.id || t.id === 'center-mark' || t.selected) return;
      const tW = Number(t.style?.width) || 200; const tH = Number(t.style?.height) || 100; const tLeft = t.position.x, tCenter = t.position.x + tW / 2, tRight = t.position.x + tW; const tTop = t.position.y, tMiddle = t.position.y + tH / 2, tBottom = t.position.y + tH;
      const xs = [ { target: tLeft, src: nLeft, offset: 0 }, { target: tLeft, src: nRight, offset: -nW }, { target: tRight, src: nLeft, offset: 0 }, { target: tRight, src: nRight, offset: -nW }, { target: tCenter, src: nCenter, offset: -nW / 2 } ]; xs.forEach(x => { const diff = Math.abs(x.target - x.src); if (diff < snapDiffX) { snapDiffX = diff; snapX = x.target + x.offset; lineX = x.target; } });
      const ys = [ { target: tTop, src: nTop, offset: 0 }, { target: tTop, src: nBottom, offset: -nH }, { target: tBottom, src: nTop, offset: 0 }, { target: tBottom, src: nBottom, offset: -nH }, { target: tMiddle, src: nMiddle, offset: -nH / 2 } ]; ys.forEach(y => { const diff = Math.abs(y.target - y.src); if (diff < snapDiffY) { snapDiffY = diff; snapY = y.target + y.offset; lineY = y.target; } });
    });
    if (snapX !== undefined) node.position.x = snapX; if (snapY !== undefined) node.position.y = snapY; setGuides({ lineX, lineY });
  }, [nodes]);

  const onNodeDragStop = useCallback((_: any, node: any) => { takeSnapshot(); setNodes((nds: any[]) => nds.map((n: any) => n.id === node.id ? { ...n, position: node.position } : n)); setGuides({}); }, [takeSnapshot]);

  const flowNodes = useMemo(() => {
    const centerNode: any = { id: 'center-mark', type: 'default', position: { x: -10, y: -10 }, draggable: false, selectable: false, data: { label: '＋' }, style: { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '14px', fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', border: '2px solid #ef4444', zIndex: -1000, pointerEvents: 'none', padding: 0 } };

    return [centerNode, ...nodes.map(n => {
      if (n.type === 'printZone') {
        return {
          ...n, draggable: true,
          data: { label: ( <div style={{ width: '100%', height: '100%', border: '4px dashed #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)', position: 'relative' }}> <div style={{ position: 'absolute', top: 0, left: 0, background: '#3b82f6', color: '#fff', padding: '4px 12px', fontSize: '14px', fontWeight: 'bold' }}>{n.data.label}</div> <NodeResizer isVisible={true} minWidth={200} minHeight={200} handleStyle={{ width: 12, height: 12, background: '#3b82f6' }} lineStyle={{ border: 'none' }} onResize={(_, params) => { setNodes((nds: any[]) => nds.map((node: any) => node.id === n.id ? { ...node, position: { x: params.x, y: params.y }, width: params.width, height: params.height, style: { ...node.style, width: params.width, height: params.height } } : node)); }} /> </div> ) }, style: { ...n.style, border: 'none', backgroundColor: 'transparent', padding: 0 }
        };
      }

      const isEditingNode = Boolean(n.data?.isEditing); const editingCellId = n.data?.editingCell;
      const isPreview = Boolean(n.data?.previewVisible && !n.data?.isShape && !n.data?.isImage && !n.data?.isTable);
      let previewElement: React.ReactNode = null;
      const textOffX = Number(n.data?.textOffsetX || 0); const textOffY = Number(n.data?.textOffsetY || 0);

      const rawHAlign = n.style?.hAlign || 'left'; const rawVAlign = n.style?.vAlign || 'top'; const wMode = n.style?.writingMode || 'horizontal-tb'; const isVertical = wMode === 'vertical-rl';
      const jc = rawVAlign === 'top' ? 'flex-start' : rawVAlign === 'bottom' ? 'flex-end' : 'center';
      const ai = isVertical ? (rawHAlign === 'right' ? 'flex-start' : rawHAlign === 'left' ? 'flex-end' : 'center') : (rawHAlign === 'left' ? 'flex-start' : rawHAlign === 'right' ? 'flex-end' : 'center');

      if (isPreview) {
        const w1 = Number(n.style?.width) || 200; const h1 = Number(n.style?.height) || 100; const cx1 = w1 / 2; const cy1 = h1 / 2;
        const offsetX = Number(n.data?.previewStyle?.offsetX) || 0; const offsetY = Number(n.data?.previewStyle?.offsetY) || -180;
        const w2 = Number(n.data?.previewStyle?.width) || 180; const h2 = Number(n.data?.previewStyle?.height) || 120; const cx2 = offsetX + w2 / 2; const cy2 = offsetY + h2 / 2;
        const p1 = getEdgePoint(cx1, cy1, w1, h1, cx2, cy2); const p2 = getEdgePoint(cx2, cy2, w2, h2, cx1, cy1);
        previewElement = (
          <React.Fragment>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: -2 }}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#999" strokeWidth="2" strokeDasharray="4 2" /></svg>
            <div className="nodrag" onMouseDown={(e) => { e.stopPropagation(); takeSnapshot(); previewDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: offsetX, initY: offsetY, moved: false }; }} onClick={(e) => { e.stopPropagation(); if (!previewDragRef.current?.moved) enterLevel(n.id, extractFirstLineText(n.data?.content)); }} style={{ position:'absolute', left: offsetX, top: offsetY, width: `${w2}px`, height: `${h2}px`, backgroundColor:`rgba(255,255,255,${n.data?.previewStyle?.opacity || 0.7})`, borderRadius: '12px', border: '1px solid #ccc', zIndex: -1, cursor: 'grab', overflow: 'hidden', boxShadow: '0 8px 12px rgba(0,0,0,0.1)' }}>
              {levelData[n.id]?.nodes?.length ? ( <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '1200px', height: '800px', position: 'relative', pointerEvents: 'none' }}> {levelData[n.id].nodes.map((cn: any) => cn.id !== 'center-mark' ? ( <div key={cn.id} style={{ position: 'absolute', left: cn.position.x, top: cn.position.y, width: cn.style?.width || 200, height: cn.style?.height || 100, backgroundColor: cn.style?.backgroundColor || '#fff', border: cn.style?.border || '4px solid #333', borderRadius: cn.style?.borderRadius || '12px', display: 'flex', flexDirection: 'column', alignItems: cn.style?.alignItems || 'flex-start', justifyContent: cn.style?.justifyContent || 'flex-start', fontSize: '32px', color: cn.style?.color || '#000', overflow: 'hidden' }}> {cn.data?.isImage ? <img src={cn.data.imageUrl as string} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="mini" /> : cn.data?.isShape ? null : <div className="html-content" style={{padding:'15px', width:'100%', fontWeight: cn.style?.fontWeight || 'normal', textAlign: cn.style?.textAlign || 'center', color: cn.style?.color || '#000', fontFamily: cn.style?.fontFamily || 'sans-serif', fontSize: cn.style?.fontSize || '14px', textDecoration: cn.style?.textDecoration || 'none', writingMode: cn.style?.writingMode || 'horizontal-tb'}} dangerouslySetInnerHTML={{ __html: renderHTMLWithMath(cn.data?.content) }} />} </div> ) : null)} </div> ) : <div style={{fontSize: '11px', color: '#999', textAlign: 'center', paddingTop: '40px', pointerEvents: 'none'}}>中身<br/>(クリックで入る)</div>}
            </div>
          </React.Fragment>
        );
      } else if (n.data?.isTable) {
        const colWidths = n.data.colWidths || Array(n.data.cols || 2).fill(100);
        const rowHeights = n.data.rowHeights || Array(n.data.rows || 2).fill(40);
        const headerStyle = { background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' as const, fontSize: '12px', color: '#64748b', fontWeight: 'bold', userSelect: 'none' as const, position: 'relative' as const };

        const selCells = selectedCells[n.id] || [];
        let selMinR = 9999, selMaxR = -1, selMinC = 9999, selMaxC = -1;
        selCells.forEach(cellId => {
            const [cr, cc] = cellId.split('-').map(Number);
            if (cr < selMinR) selMinR = cr; if (cr > selMaxR) selMaxR = cr;
            if (cc < selMinC) selMinC = cc; if (cc > selMaxC) selMaxC = cc;
        });

        previewElement = (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="custom-drag-handle no-print" style={{ height: '14px', background: '#e2e8f0', cursor: 'grab', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', flexShrink: 0 }}></div>
                <div className="nodrag" style={{ padding: '4px 10px 0', backgroundColor: '#fff', flexShrink: 0 }}>
                    <input type="text" placeholder="表のタイトル (任意)" value={n.data?.tableTitle || ''} onChange={(e) => setNodes(nds => nds.map(node => node.id === n.id ? { ...node, data: { ...node.data, tableTitle: e.target.value } } : node))} style={{ width: '100%', border: 'none', borderBottom: isExecutingPrint ? 'none' : '1px dashed #ccc', background: 'transparent', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', outline: 'none', color: '#333' }} />
                </div>
                <div className="nodrag" style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
                    <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: 'max-content' }}>
                        <thead className="no-print">
                            <tr>
                                <th onClick={(e) => { e.stopPropagation(); const all: string[] = []; for(let i=0; i<n.data.rows; i++) for(let j=0; j<n.data.cols; j++) all.push(`${i}-${j}`); setSelectedCells({[n.id]: all}); if (!n.selected) setNodes(nds => nds.map(node => node.id === n.id ? { ...node, selected: true } : node)); }} style={{...headerStyle, width: 30, cursor: 'pointer'}}>◢</th>
                                {Array.from({length: n.data.cols || 2}).map((_, c) => (
                                    <th key={c} 
                                        onMouseDown={e => { e.stopPropagation(); tableActionRef.current = { id: n.id, type: 'select-cols', startC: c, startR: 0, minC: c, maxC: c, minR: 0, maxR: n.data.rows-1, startX:0, startY:0, initWidths:[], initHeights:[] }; selectCellsBox(n.id, 0, c, n.data.rows-1, c, e.shiftKey || e.metaKey || e.ctrlKey); }}
                                        onMouseEnter={e => { const action = tableActionRef.current; if (action && action.id === n.id && action.type === 'select-cols') { selectCellsBox(n.id, 0, action.startC, n.data.rows-1, c, false); } }}
                                        style={{...headerStyle, width: colWidths[c], cursor: 'pointer'}}
                                    >
                                        {String.fromCharCode(65 + c)}
                                        <div className="nodrag" onMouseDown={(e) => { e.stopPropagation(); takeSnapshot(); tableActionRef.current = {id: n.id, type: 'resize-col', startC: c, startR: 0, minC: c, maxC: c, minR: 0, maxR: 0, startX: e.clientX, startY: 0, initWidths: colWidths, initHeights: []}; }} style={{position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 10}} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({length: n.data.rows || 2}).map((_, r) => (
                                <tr key={r} style={{ height: rowHeights[r] }}>
                                    <th className="no-print" 
                                        onMouseDown={e => { e.stopPropagation(); tableActionRef.current = { id: n.id, type: 'select-rows', startR: r, startC: 0, minC: 0, maxC: n.data.cols-1, minR: r, maxR: r, startX:0, startY:0, initWidths:[], initHeights:[] }; selectCellsBox(n.id, r, 0, r, n.data.cols-1, e.shiftKey || e.metaKey || e.ctrlKey); }}
                                        onMouseEnter={e => { const action = tableActionRef.current; if (action && action.id === n.id && action.type === 'select-rows') { selectCellsBox(n.id, action.startR, 0, r, n.data.cols-1, false); } }}
                                        style={{...headerStyle, cursor: 'pointer'}}
                                    >
                                        {r + 1}
                                        <div className="nodrag" onMouseDown={(e) => { e.stopPropagation(); takeSnapshot(); tableActionRef.current = {id: n.id, type: 'resize-row', startR: r, startC: 0, minC: 0, maxC: 0, minR: r, maxR: r, startY: e.clientY, startX: 0, initWidths: [], initHeights: rowHeights}; }} style={{position: 'absolute', bottom: -3, left: 0, right: 0, height: 6, cursor: 'row-resize', zIndex: 10}} />
                                    </th>
                                    {Array.from({length: n.data.cols || 2}).map((_, c) => {
                                        const cellId = `${r}-${c}`;
                                        const cellData = n.data.cells?.[cellId] || { content: '', style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } };
                                        const isSel = selectedCells[n.id]?.includes(cellId);
                                        const isCellEditing = editingCellId === cellId;

                                        const cHAlign = cellData.style?.hAlign || 'left'; const cVAlign = cellData.style?.vAlign || 'top'; const cWMode = cellData.style?.writingMode || 'horizontal-tb';
                                        const tdVerticalAlign = cVAlign === 'center' ? 'middle' : cVAlign;

                                        let cellBoxShadow = 'none';
                                        if (isSel && !isCellEditing) {
                                            const t = !selectedCells[n.id]?.includes(`${r-1}-${c}`); const b = !selectedCells[n.id]?.includes(`${r+1}-${c}`); const l = !selectedCells[n.id]?.includes(`${r}-${c-1}`); const ri = !selectedCells[n.id]?.includes(`${r}-${c+1}`);
                                            cellBoxShadow = `${t?'inset 0 2px 0 0 #3b82f6,':''}${b?'inset 0 -2px 0 0 #3b82f6,':''}${l?'inset 2px 0 0 0 #3b82f6,':''}${ri?'inset -2px 0 0 0 #3b82f6,':''}`;
                                            cellBoxShadow = cellBoxShadow ? cellBoxShadow.slice(0, -1) : 'inset 0 0 0 1px rgba(59, 130, 246, 0.3)';
                                        }

                                        const { hAlign: _h, vAlign: _v, writingMode: _w, ...safeDomStyle } = cellData.style;

                                        return (
                                            <td
                                                key={c}
                                                onMouseDown={(e) => { e.stopPropagation(); if (isCellEditing) return; tableActionRef.current = { id: n.id, type: 'select-cells', startR: r, startC: c, minC: c, maxC: c, minR: r, maxR: r, startX:0, startY:0, initWidths:[], initHeights:[] }; selectCellsBox(n.id, r, c, r, c, e.shiftKey || e.metaKey || e.ctrlKey); }}
                                                onMouseEnter={(e) => { const action = tableActionRef.current; if (action && action.id === n.id && action.type === 'select-cells') { selectCellsBox(n.id, action.startR, action.startC, r, c, false); } }}
                                                style={{ ...safeDomStyle, position: 'relative', cursor: isCellEditing ? 'text' : 'cell', padding: '8px', wordBreak: 'break-all', height: '1px', verticalAlign: tdVerticalAlign, textAlign: cHAlign, writingMode: cWMode, boxShadow: cellBoxShadow, border: isSel && !isCellEditing ? 'none' : cellData.style.border }}
                                            >
                                                {isSel && !isCellEditing && c === selMaxC && (
                                                    <div className="nodrag" style={{position:'absolute', right:-4, top:0, bottom:0, width:8, cursor:'col-resize', zIndex:20}} onMouseDown={e => { e.stopPropagation(); takeSnapshot(); tableActionRef.current = { id: n.id, type: 'resize-col', startC: c, startR: r, minC: selMinC, maxC: selMaxC, minR: selMinR, maxR: selMaxR, startX: e.clientX, startY: 0, initWidths: colWidths, initHeights: [] }; }} />
                                                )}
                                                {isSel && !isCellEditing && r === selMaxR && (
                                                    <div className="nodrag" style={{position:'absolute', bottom:-4, left:0, right:0, height:8, cursor:'row-resize', zIndex:20}} onMouseDown={e => { e.stopPropagation(); takeSnapshot(); tableActionRef.current = { id: n.id, type: 'resize-row', startR: r, startC: c, minC: selMinC, maxC: selMaxC, minR: selMinR, maxR: selMaxR, startY: e.clientY, startX: 0, initWidths: [], initHeights: rowHeights }; }} />
                                                )}
                                                {isSel && !isCellEditing && r === selMaxR && c === selMaxC && (
                                                    <div className="nodrag" style={{position:'absolute', bottom:-5, right:-5, width:10, height:10, background:'#3b82f6', border:'1px solid #fff', cursor:'nwse-resize', zIndex:21, borderRadius:'50%'}} onMouseDown={e => { e.stopPropagation(); takeSnapshot(); tableActionRef.current = { id: n.id, type: 'resize-xy', startC: c, startR: r, minC: selMinC, maxC: selMaxC, minR: selMinR, maxR: selMaxR, startX: e.clientX, startY: e.clientY, initWidths: colWidths, initHeights: rowHeights }; }} />
                                                )}

                                                <div 
                                                    className={"nodrag html-content"} contentEditable={isCellEditing} suppressContentEditableWarning
                                                    onMouseDown={(e) => { if (isCellEditing) e.stopPropagation(); }} onKeyDown={(e) => { if (isCellEditing) e.stopPropagation(); }} onInput={(e) => { cellData._tempContent = e.currentTarget.innerHTML; }}
                                                    onBlur={(e) => { const finalHtml = cellData._tempContent ?? e.currentTarget.innerHTML; setNodes(nds => nds.map(node => node.id === n.id ? { ...node, data: { ...node.data, editingCell: null, cells: { ...node.data.cells, [cellId]: { ...node.data.cells[cellId], content: finalHtml, _tempContent: undefined } } } } : node)); }}
                                                    style={{ outline: 'none', width: '100%', height: 'auto', textAlign: cHAlign }}
                                                    ref={el => {
                                                        if (!el) return;
                                                        if (!isCellEditing) { const newHtml = renderHTMLWithMath(cellData.content || ''); if (el.innerHTML !== newHtml) el.innerHTML = newHtml; el.dataset.editing = 'false'; } 
                                                        else if (el.dataset.editing !== 'true') { el.dataset.editing = 'true'; el.innerHTML = cellData.content || ''; setTimeout(() => { el.focus(); if (typeof window.getSelection !== 'undefined') { const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(el); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range); } }, 10); }
                                                    }}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
      }

      const baseW = n.data?.cropBaseW ?? (Number(n.style?.width) || 300); const baseH = n.data?.cropBaseH ?? (Number(n.style?.height) || 200);
      const offX = n.data?.cropOffsetX || 0; const offY = n.data?.cropOffsetY || 0;
      const isTextNode = !n.data?.isShape && !n.data?.isImage && !n.data?.isTable;
      const bColor = n.style?.borderColor; const hideGrayBorder = isTextNode && (!bColor || bColor === '#ccc' || bColor === 'transparent');
      const resolvedBorder = n.data?.isShape ? `3px solid ${bColor || '#333'}` : (hideGrayBorder ? 'none' : `1px solid ${bColor}`);
      const { hAlign: _nh, vAlign: _nv, writingMode: _nw, ...safeNodeStyle } = n.style || {};

      return {
        ...n, draggable: n.data?.isImage && n.data?.isCropping ? false : true,
        data: {
          ...n.data,
          label: (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: ai, justifyContent: jc, position: 'relative', border: resolvedBorder, borderRadius: n.style?.borderRadius || '12px', backgroundColor: n.style?.backgroundColor || '#fff', opacity: n.style?.opacity || 1, padding: n.style?.padding || '4px' }}>
              
              {n.id !== 'center-mark' && (
                <>
                  <Handle type="target" position={Position.Top} id="top-tgt" className="custom-handle-target custom-handle-offset-top" /><Handle type="target" position={Position.Bottom} id="bottom-tgt" className="custom-handle-target custom-handle-offset-bottom" /><Handle type="target" position={Position.Left} id="left-tgt" className="custom-handle-target custom-handle-offset-left" /><Handle type="target" position={Position.Right} id="right-tgt" className="custom-handle-target custom-handle-offset-right" />
                  <Handle type="source" position={Position.Left} id="left-src" className="custom-handle custom-handle-offset-left" /><Handle type="source" position={Position.Right} id="right-src" className="custom-handle custom-handle-offset-right" /><Handle type="source" position={Position.Top} id="top-src" className="custom-handle custom-handle-offset-top" /><Handle type="source" position={Position.Bottom} id="bottom-src" className="custom-handle custom-handle-offset-bottom" />
                </>
              )}

              {previewElement}
              
              {n.data?.isImage ? (
                <div className={n.data?.isCropping ? "nodrag" : ""} onMouseDown={(e) => { if (n.data?.isCropping) { e.stopPropagation(); takeSnapshot(); imageCropDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: Number(n.data?.imgPosX || 0), initY: Number(n.data?.imgPosY || 0) }; } }} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', borderRadius: n.style?.borderRadius || 0, cursor: n.data?.isCropping ? 'move' : 'default' }}>
                  <img src={n.data.imageUrl as string} style={{ position: 'absolute', width: n.data?.isCropping ? `${baseW}px` : '100%', height: n.data?.isCropping ? `${baseH}px` : '100%', maxWidth: 'none', maxHeight: 'none', left: n.data?.isCropping ? `${offX}px` : 0, top: n.data?.isCropping ? `${offY}px` : 0, transform: `translate(${n.data.imgPosX || 0}px, ${n.data.imgPosY || 0}px) scale(${n.data.imgZoom || 1})`, transformOrigin: 'center center', pointerEvents: 'none' }} alt="img" />
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: ai, justifyContent: jc, padding: '4px' }}>
                      <div 
                          id={`edit-${n.id}`} className={"html-content"} contentEditable={isEditingNode} suppressContentEditableWarning
                          onMouseDown={(e) => { if (isEditingNode) e.stopPropagation(); }} onKeyDown={(e) => { if (isEditingNode) e.stopPropagation(); }}
                          onInput={(e) => { n.data._tempContent = e.currentTarget.innerHTML; }} onBlur={(e) => { const finalHtml = n.data._tempContent ?? e.currentTarget.innerHTML; setNodes(nds => nds.map(node => node.id === n.id ? { ...node, data: { ...node.data, isEditing: false, content: finalHtml, _tempContent: undefined } } : node)); }}
                          style={{ pointerEvents: 'auto', width: '100%', height: 'auto', outline: 'none', cursor: isEditingNode ? 'text' : 'pointer', color: n.style?.color || '#000', fontFamily: n.style?.fontFamily || 'sans-serif', fontSize: n.style?.fontSize || '14px', fontWeight: n.style?.fontWeight || 'normal', textDecoration: n.style?.textDecoration || 'none', whiteSpace: 'pre-wrap', lineHeight: '1.2', textAlign: rawHAlign, transform: `translate(${textOffX}px, ${textOffY}px)`, writingMode: wMode }}
                          ref={el => {
                              if (!el) return;
                              if (!isEditingNode) { const newHtml = renderHTMLWithMath(n.data?.content || ''); if (el.innerHTML !== newHtml) el.innerHTML = newHtml; el.dataset.editing = 'false'; } 
                              else if (el.dataset.editing !== 'true') { el.dataset.editing = 'true'; el.innerHTML = n.data?.content || ''; setTimeout(() => { el.focus(); if (typeof window.getSelection !== 'undefined') { const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(el); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range); } }, 10); }
                          }}
                      />
                  </div>
                </div>
              ) : n.id !== 'center-mark' && !n.data?.isTable ? (
                <div 
                    id={`edit-${n.id}`} className={"nodrag html-content"} contentEditable={isEditingNode} suppressContentEditableWarning
                    onMouseDown={(e) => { if (isEditingNode) e.stopPropagation(); }} onKeyDown={(e) => { if (isEditingNode) e.stopPropagation(); }}
                    onInput={(e) => { n.data._tempContent = e.currentTarget.innerHTML; }} onBlur={(e) => { const finalHtml = n.data._tempContent ?? e.currentTarget.innerHTML; setNodes(nds => nds.map(node => node.id === n.id ? { ...node, data: { ...node.data, isEditing: false, content: finalHtml, _tempContent: undefined } } : node)); }}
                    style={{ pointerEvents: 'auto', width: '100%', height: 'auto', outline: 'none', cursor: isEditingNode ? 'text' : 'pointer', color: n.style?.color || '#000', fontFamily: n.style?.fontFamily || 'sans-serif', fontSize: n.style?.fontSize || '14px', fontWeight: n.style?.fontWeight || 'normal', textDecoration: n.style?.textDecoration || 'none', whiteSpace: 'pre-wrap', lineHeight: '1.2', textAlign: rawHAlign, transform: `translate(${textOffX}px, ${textOffY}px)`, writingMode: wMode }}
                    ref={el => {
                        if (!el) return;
                        if (!isEditingNode) { const newHtml = renderHTMLWithMath(n.data?.content || ''); if (el.innerHTML !== newHtml) el.innerHTML = newHtml; el.dataset.editing = 'false'; } 
                        else if (el.dataset.editing !== 'true') { el.dataset.editing = 'true'; el.innerHTML = n.data?.content || ''; setTimeout(() => { el.focus(); if (typeof window.getSelection !== 'undefined') { const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(el); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range); } }, 10); }
                    }}
                />
              ) : null}

              {n.id !== 'center-mark' && !n.data?.isTable ? (
                 <NodeResizer minWidth={30} minHeight={30} keepAspectRatio={!!n.data?.keepRatio} isVisible={n.selected} lineStyle={{ border: n.data?.isCropping ? '2px dashed #ef4444' : '1px solid #3b82f6', zIndex: 100 }} handleStyle={{ background: n.data?.isCropping ? '#ef4444' : '#3b82f6', zIndex: 100, borderRadius: '50%' }} onResizeStart={(_, params) => { takeSnapshot(); if (n.data?.isImage && n.data?.isCropping) { n.data._rsX = params.x; n.data._rsY = params.y; n.data._rsCropOffX = n.data.cropOffsetX || 0; n.data._rsCropOffY = n.data.cropOffsetY || 0; } }} onResize={(_, params) => { if (n.data?.isImage && n.data?.isCropping) { const dx = params.x - n.data._rsX; const dy = params.y - n.data._rsY; setNodes((nds: any[]) => nds.map((node: any) => node.id === n.id ? { ...node, data: { ...node.data, cropOffsetX: n.data._rsCropOffX - dx, cropOffsetY: n.data._rsCropOffY - dy } } : node)); } }} />
              ) : null}
            </div>
          ),
          style: { ...safeNodeStyle, border: 'none', backgroundColor: 'transparent', padding: 0 }
        }
      };
    })];
  }, [nodes, enterLevel, levelData, takeSnapshot, selectedCells, selectCellsBox]);

  const isRoot = historyLevel.length === 0;
  const actionBtnStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px', transition: 'all 0.2s', whiteSpace: 'nowrap' };
  const primaryBtnStyle = { ...actionBtnStyle, backgroundColor: '#3b82f6', color: '#fff', border: 'none', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' };

  if (isExecutingPrint) {
      const printBoxes = nodes.filter(n => n.type === 'printZone'); const printableNodes = flowNodes.filter(n => n.type !== 'printZone' && n.id !== 'center-mark');
      return (
          <div style={{ backgroundColor: '#fff', width: '100%', minHeight: '100vh' }}>
              <style>{GLOBAL_CSS}</style>
              <div className="no-print" style={{position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.95)', zIndex: 99999}}>
                  <h2 style={{color: '#10b981', fontSize: '24px', marginBottom: '10px'}}>🖨️ 印刷データを精密生成中...</h2>
                  <p style={{color: '#666', fontWeight: 'bold'}}>ダイアログが開くまで、このままお待ちください（約1秒）</p>
              </div>
              {printBoxes.map((box) => {
                  const boxW = (box.width ?? box.measured?.width ?? Number(box.style?.width)) || 800; const boxH = (box.height ?? box.measured?.height ?? Number(box.style?.height)) || 1130; const boxX = box.position.x; const boxY = box.position.y;
                  return (
                      <div key={box.id} className="print-page-wrapper" style={{ width: `${boxW}px`, height: `${boxH}px`, backgroundColor: levelData[currentLevel]?.bgColor || '#ffffff' }}>
                          <ReactFlowProvider>
                              <ReactFlow nodes={printableNodes} edges={edges} edgeTypes={edgeTypes} defaultViewport={{ x: -boxX, y: -boxY, zoom: 1 }} panOnDrag={false} zoomOnScroll={false} nodesDraggable={false} elementsSelectable={false} preventScrolling={false} />
                          </ReactFlowProvider>
                      </div>
                  );
              })}
          </div>
      );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <style>{GLOBAL_CSS}</style>
      <input type="file" ref={jsonImportRef} style={{ display: 'none' }} onChange={importData} accept=".json" />
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
      
      {/* サイドバー */}
      <div className="no-print" style={{ width: isSidebarOpen ? '220px' : '0px', transition: 'width 0.3s ease', backgroundColor: '#f8f9fa', borderRight: isSidebarOpen ? '1px solid #ddd' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>
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

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: levelData[currentLevel]?.bgColor || '#ffffff', transition: 'background-color 0.3s', position: 'relative', '--bg-color': levelData[currentLevel]?.bgColor || '#f1f1f1' } as React.CSSProperties}>
        {/* 上部バー */}
        {isTopBarOpen ? (
          <div className="no-print" style={{ padding: '8px 15px', backgroundColor: 'rgba(255,255,255,0.9)', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', marginRight: '15px', padding: '0 5px' }}>☰</button>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '14px' }}>
              階層: <input type="text" value={currentLabel} onChange={(e) => setCurrentLabel(e.target.value)} style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333', textAlign: 'center', border: 'none', borderBottom: '1px dashed #999', background: 'transparent', outline: 'none', minWidth: '150px' }} />
            </div>
            <button onClick={() => setIsTopBarOpen(false)} style={{ padding: '4px 8px', fontSize: '10px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>▲ 隠す</button>
          </div>
        ) : ( <button className="no-print" onClick={() => setIsTopBarOpen(true)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 100, padding: '4px 8px', fontSize: '10px', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>▼ 階層メニューを表示</button> )}

        <div style={{ flexGrow: 1, position: 'relative' }}>
          <ReactFlow 
             connectionMode={ConnectionMode.Loose} nodes={flowNodes} edges={edges} edgeTypes={edgeTypes} elevateNodesOnSelect={false} multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
             panOnDrag={!isLassoMode} selectionOnDrag={isLassoMode} selectionMode={SelectionMode.Partial}
             onNodesChange={u => {
                 const hasSelect = u.some((c: any) => c.type === 'select' && c.selected);
                 if (hasSelect) { setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isEditing: false, editingCell: null } }))); setEdges(eds => eds.map(e => ({ ...e, data: { ...e.data, isEditing: false } }))); }
                 setNodes((nds: any[]) => applyNodeChanges(u, nds));
             }} 
             onEdgesChange={u => setEdges((eds: any[]) => applyEdgeChanges(u, eds))} 
             onConnect={p => { takeSnapshot(); setEdges((eds: any[]) => addEdge({...p, type:'default', label: '', style: {strokeWidth: 1}}, eds)); }} 
             onNodeDragStart={() => takeSnapshot()} onNodeDoubleClick={(_, n) => { enterLevel(n.id, extractFirstLineText(n.data?.content)); }} 
             onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop} fitView
          >
            <Background color="#f1f1f1" className="no-print" /><Controls className="no-print" /><SmartGuides guides={guides} />
          </ReactFlow>
          
          {selectedNodes.length > 0 && primaryNode && primaryNode.type !== 'printZone' && (
            <div className="no-print" style={{ position:'absolute', right:0, top:0, bottom:0, width:'320px', borderLeft:'1px solid #ddd', padding:'15px', backgroundColor:'#fff', zIndex:1000, overflowY: 'auto', boxShadow: '-4px 0 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{fontSize:'14px', margin: 0}}>{selectedNodes.length > 1 ? `${selectedNodes.length}個の要素を一括編集` : primaryNode.data?.isTable ? '表の設定' : primaryNode.data?.isImage ? '画像編集' : primaryNode.data?.isShape ? '図形設定' : 'テキスト設定'}</h3>
                <button onClick={clearSelection} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', padding: '0 5px' }}>×</button>
              </div>
              
              <div style={{ display:'flex', gap:'5px', marginBottom:'15px' }}>
                <button onClick={() => { takeSnapshot(); setNodes((nds: any[]) => { const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0)); return nds.map((n: any) => n.selected ? {...n, zIndex: maxZ + 1} : n); })}} style={{flex:1, padding:'6px', fontSize:'11px', fontWeight: 'bold', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '4px'}}>↑ 最前面へ</button>
                <button onClick={() => { takeSnapshot(); setNodes((nds: any[]) => { const minZ = Math.min(0, ...nds.map((n: any) => Number(n.zIndex) || 0)); return nds.map((n: any) => n.selected ? {...n, zIndex: minZ - 1} : n); })}} style={{flex:1, padding:'6px', fontSize:'11px', fontWeight: 'bold', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '4px'}}>↓ 最背面へ</button>
              </div>

              {primaryNode.data?.isTable && (
                  <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ddd' }}>
                      <label style={{fontSize: '11px', fontWeight: 'bold'}}>表の構成</label>
                      <div style={{ display: 'flex', gap: '5px', marginTop: '5px', marginBottom: '15px' }}>
                          <button onClick={() => addTableRowCol('row')} style={{ flex:1, padding: '4px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>行を追加</button>
                          <button onClick={() => addTableRowCol('col')} style={{ flex:1, padding: '4px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>列を追加</button>
                      </div>

                      <label style={{fontSize: '11px', fontWeight: 'bold', color: '#b91c1c'}}>選択セル枠線のデザイン</label>
                      {isTableEditing ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '5px' }}>
                              <select value={tableBorderWidth} onChange={(e) => setTableBorderWidth(e.target.value)} style={{ padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>
                                  <option value="1px">細線</option><option value="2px">中線</option><option value="4px">太線</option><option value="0px">線なし</option>
                              </select>
                              <select value={tableBorderStyle} onChange={(e) => setTableBorderStyle(e.target.value)} style={{ padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>
                                  <option value="solid">単線</option><option value="dashed">破線</option><option value="dotted">点線</option><option value="double">二重線</option>
                              </select>
                              <input type="color" value={tableBorderColor} onChange={(e) => setTableBorderColor(e.target.value)} style={{ width: '100%', height: '24px', border: 'none', cursor: 'pointer', background: 'transparent' }} />
                              <button onClick={applyTableBorder} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>適用</button>
                          </div>
                      ) : ( <p style={{fontSize: '10px', color: '#666', marginTop: '5px'}}>※表の中のセルをクリックして選択してください<br/>(Shiftキーで複数選択)</p> )}
                  </div>
              )}

              {primaryNode.data?.isImage && selectedNodes.length === 1 && (
                <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <button onClick={() => { takeSnapshot(); const w = Number(primaryNode.style?.width) || 300; const h = Number(primaryNode.style?.height) || 200; if (!primaryNode.data?.isCropping) updateSelectedNodes({ isCropping: true, cropBaseW: w, cropBaseH: h, cropOffsetX: 0, cropOffsetY: 0 }); else updateSelectedNodes({ isCropping: false }); }} style={{ width: '100%', padding: '8px', fontSize: '12px', background: primaryNode.data?.isCropping ? '#ef4444' : '#fff', color: primaryNode.data?.isCropping ? '#fff' : '#333', border: primaryNode.data?.isCropping ? 'none' : '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '15px' }}>
                     {primaryNode.data?.isCropping ? '✅ トリミング完了' : '✂️ トリミング'}
                  </button>
                  {primaryNode.data?.isCropping ? ( <div style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '10px', border: '1px dashed #fca5a5' }}><p style={{fontSize: '10px', color: '#b91c1c', margin: 0}}><strong>トリミングモード中</strong><br/>・画像の周囲の<span style={{color:'red'}}>赤い枠</span>を動かして切り取れます。<br/>・画像を直接ドラッグして位置を調整できます。</p></div> ) : (
                     <>
                        <label style={{fontSize: '10px', fontWeight: 'bold'}}>微調整 (X / Y位置)</label>
                        <input type="range" min="-600" max="600" value={Number(primaryNode.data?.imgPosX || 0)} onChange={(e) => updateSelectedNodes({ imgPosX: parseInt(e.target.value) })} style={{width:'100%', marginBottom: '5px'}} />
                        <input type="range" min="-600" max="600" value={Number(primaryNode.data?.imgPosY || 0)} onChange={(e) => updateSelectedNodes({ imgPosY: parseInt(e.target.value) })} style={{width:'100%', marginBottom: '10px'}} />
                     </>
                  )}
                  <label style={{fontSize: '10px', fontWeight: 'bold'}}>ズーム倍率</label>
                  <input type="range" min="0.5" max="3" step="0.1" value={Number(primaryNode.data?.imgZoom || 1)} onChange={(e) => updateSelectedNodes({ imgZoom: parseFloat(e.target.value) })} style={{width:'100%'}} />
                </div>
              )}
              
              {primaryNode.data?.isShape && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '15px' }}>
                  <button onClick={() => { takeSnapshot(); const size = Math.max(Number(primaryNode.style?.width) || 150, Number(primaryNode.style?.height) || 150); updateSelectedNodes({ shapeType: 'rect', keepRatio: true }, { borderRadius: '0px', width: size, height: size }); }} style={{ padding: '6px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', background: primaryNode.data?.shapeType === 'rect' && primaryNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>■ 正方形</button>
                  <button onClick={() => { takeSnapshot(); updateSelectedNodes({ shapeType: 'rect', keepRatio: false }, { borderRadius: '0px' }); }} style={{ padding: '6px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', background: primaryNode.data?.shapeType === 'rect' && !primaryNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>▬ 長方形</button>
                  <button onClick={() => { takeSnapshot(); const size = Math.max(Number(primaryNode.style?.width) || 150, Number(primaryNode.style?.height) || 150); updateSelectedNodes({ shapeType: 'circ', keepRatio: true }, { borderRadius: '50%', width: size, height: size }); }} style={{ padding: '6px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', background: primaryNode.data?.shapeType === 'circ' && primaryNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>● 正円</button>
                  <button onClick={() => { takeSnapshot(); updateSelectedNodes({ shapeType: 'circ', keepRatio: false }, { borderRadius: '50%' }); }} style={{ padding: '6px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', background: primaryNode.data?.shapeType === 'circ' && !primaryNode.data?.keepRatio ? '#ddd' : '#fff', border: '1px solid #ccc' }}>⬭ 楕円</button>
                </div>
              )}

              <div style={{ padding: '15px', borderRadius: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', marginBottom: '15px' }}>
                  <label style={{fontSize: '11px', fontWeight: 'bold', color: '#1d4ed8'}}>文字の部分装飾 (編集中のみ)</label>
                  <p style={{fontSize: '10px', color: '#666', marginTop: '4px', marginBottom: '10px', lineHeight: '1.4'}}>
                      ※図形を選択して<b>Tabキー</b>で編集モードに入り、<br/>
                      <u>マウスで文字をなぞって選択してから</u>押してください。
                  </p>
                  
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'5px' }}>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('fontName', 'serif')} style={{cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px', background: '#fff'}}>明朝</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('fontName', 'sans-serif')} style={{cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px', background: '#fff'}}>ゴシック</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('bold')} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px', background: '#fff' }}>太字</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('strikeThrough')} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px', background: '#fff' }}>二重線</button>
                  </div>

                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', marginBottom: '15px' }}>
                    {QUICK_TEXT_COLORS.map(c => <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('foreColor', c)} style={{ width:'24px', height:'24px', backgroundColor:c, border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }} />)}
                    <input type="color" onMouseDown={(e) => e.preventDefault()} onChange={(e) => applyUnifiedFormat('foreColor', e.target.value)} style={{width:'24px', height:'24px', cursor: 'pointer', border: 'none', padding: 0}} />
                  </div>

                  <label style={{fontSize:'10px', fontWeight: 'bold'}}>文字サイズ (px)</label>
                  <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom: '15px'}}>
                    <input type="range" min="10" max="100" value={partialFontSize} onMouseDown={(e) => e.preventDefault()} onChange={(e) => { const val = Number(e.target.value); setPartialFontSize(val); applyUnifiedFormat('fontSize', `${val}px`); }} style={{flex:1}} />
                    <input type="number" min="10" max="100" value={partialFontSize} onMouseDown={(e) => e.preventDefault()} onChange={(e) => { const val = Number(e.target.value); setPartialFontSize(val); applyUnifiedFormat('fontSize', `${val}px`); }} style={{width:'40px', padding:'2px', fontSize:'11px', border:'1px solid #ccc', borderRadius:'4px'}} />
                    <button onMouseDown={(e) => e.preventDefault()} onClick={handleResetFormat} style={{fontSize:'10px', padding:'4px 6px', border:'1px solid #ccc', borderRadius:'4px', cursor:'pointer', background:'#fff', fontWeight:'bold'}}>標準へ</button>
                  </div>
              </div>

              <hr style={{margin: '10px 0', border: 'none', borderTop: '1px solid #eee'}} />
              <label style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>{primaryNode.data?.isTable ? 'レイアウト (選択セルのみ)' : 'レイアウト (図形全体にのみ適用)'}</label>

              <div style={{ display:'flex', gap:'5px', marginBottom:'5px', marginTop: '5px' }}>
                <button onClick={() => handleLayout('left', undefined)} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>左</button>
                <button onClick={() => handleLayout('center', undefined)} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>中央</button>
                <button onClick={() => handleLayout('right', undefined)} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>右</button>
              </div>
              <div style={{ display:'flex', gap:'5px', marginBottom:'5px' }}>
                <button onClick={() => handleLayout(undefined, 'top')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>上</button>
                <button onClick={() => handleLayout(undefined, 'center')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>中</button>
                <button onClick={() => handleLayout(undefined, 'bottom')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>下</button>
              </div>
              <div style={{ display:'flex', gap:'5px', marginBottom:'15px' }}>
                <button onClick={() => handleLayout(undefined, undefined, 'horizontal-tb')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px', fontWeight: 'bold'}}>📝 横書き</button>
                <button onClick={() => handleLayout(undefined, undefined, 'vertical-rl')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px', fontWeight: 'bold'}}>📜 縦書き</button>
              </div>

              {!primaryNode.data?.isTable && (
                  <div style={{ marginBottom: '15px' }}>
                      <label style={{fontSize: '10px', fontWeight: 'bold'}}>文字位置の微調整 (X / Y)</label>
                      <input type="range" min="-100" max="100" value={Number(primaryNode.data?.textOffsetX || 0)} onChange={(e) => updateSelectedNodes({ textOffsetX: parseInt(e.target.value) })} style={{width:'100%', marginBottom: '5px'}} />
                      <input type="range" min="-100" max="100" value={Number(primaryNode.data?.textOffsetY || 0)} onChange={(e) => updateSelectedNodes({ textOffsetY: parseInt(e.target.value) })} style={{width:'100%'}} />
                  </div>
              )}

              <label style={{fontSize:'10px', fontWeight: 'bold'}}>全体の透明度</label>
              <input type="range" min="0.1" max="1" step="0.1" value={Number(primaryNode.style?.opacity ?? 1)} onChange={(e) => { takeSnapshot(); updateSelectedNodes({}, { opacity: parseFloat(e.target.value) })}} style={{width:'100%', marginBottom:'10px'}} />

              <label style={{fontSize:'10px', fontWeight: 'bold'}}>枠線の色</label>
              <input type="color" value={String(primaryNode.style?.borderColor || (primaryNode.data?.isShape ? '#333333' : 'transparent'))} onChange={(e) => { takeSnapshot(); updateSelectedNodes({}, { borderColor: e.target.value })}} style={{width:'100%', height:'24px', cursor: 'pointer', border: 'none', padding: 0, marginBottom:'10px'}} />

              <label style={{fontSize:'10px', fontWeight: 'bold'}}>背景色</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginTop: '5px', marginBottom: '10px' }}>
                {PASTEL_COLORS.map(c => <button key={c} onClick={() => { takeSnapshot(); updateSelectedNodes({}, { backgroundColor: c })}} style={{ width:'100%', aspectRatio:'1', backgroundColor:c, border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer' }} />)}
                <input type="color" value={String(primaryNode.style?.backgroundColor || '#ffffff')} onChange={(e) => { takeSnapshot(); updateSelectedNodes({}, { backgroundColor: e.target.value })}} style={{width:'100%', aspectRatio:'1', cursor: 'pointer', border: 'none', padding: 0}} />
              </div>

              {!primaryNode.data?.isShape && !primaryNode.data?.isImage && !primaryNode.data?.isTable && (
                <>
                  <button onClick={() => { takeSnapshot(); updateSelectedNodes((n: any) => ({ previewVisible: !n.previewVisible }))}} style={{ width:'100%', marginTop:'5px', padding:'8px', fontSize:'12px', background: primaryNode.data?.previewVisible ? '#3b82f6' : '#fff', color: primaryNode.data?.previewVisible ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {primaryNode.data?.previewVisible ? '💬 吹き出しを消す' : '💬 吹き出しを追加'}
                  </button>
                  {primaryNode.data?.previewVisible && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <p style={{fontSize: '10px', color: '#666', marginBottom: '5px'}}>※位置は画面上で吹き出しを直接ドラッグして動かせます</p>
                      <div style={{display:'flex', alignItems: 'center', gap:'5px', marginBottom:'5px'}}>
                        <div style={{fontSize:'10px', width:'30px'}}>幅</div>
                        <input type="range" min="50" max="500" value={Number(primaryNode.data?.previewStyle?.width || 180)} onChange={(e) => { takeSnapshot(); updateSelectedNodes({ previewStyle: { ...(primaryNode.data?.previewStyle || {}), width: parseInt(e.target.value) } })}} style={{flex:1}} />
                      </div>
                      <div style={{display:'flex', alignItems: 'center', gap:'5px', marginBottom:'5px'}}>
                        <div style={{fontSize:'10px', width:'30px'}}>高さ</div>
                        <input type="range" min="50" max="500" value={Number(primaryNode.data?.previewStyle?.height || 120)} onChange={(e) => { takeSnapshot(); updateSelectedNodes({ previewStyle: { ...(primaryNode.data?.previewStyle || {}), height: parseInt(e.target.value) } })}} style={{flex:1}} />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: '5px', marginTop: '15px' }}>
                <button onClick={handleDuplicate} style={{ flex:1, color: '#333', fontSize:'12px', border: '1px solid #ccc', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', background: '#f8f9fa' }}>📄 複製</button>
                <button onClick={() => { 
                    takeSnapshot(); 
                    const selIds = nodesRef.current.filter((n: any) => n.selected).map((n: any) => n.id);
                    setNodes((nds: any[]) => nds.filter((n: any) => !n.selected)); 
                    setEdges((eds: any[]) => eds.filter((e: any) => !e.selected && !selIds.includes(e.source) && !selIds.includes(e.target)));
                    setSelectedCells({});
                }} style={{ flex:1, color: 'red', fontSize:'12px', border: '1px solid red', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', background: '#fffcfc' }}>🗑️ 削除</button>
              </div>
            </div>
          )}

          {selectedEdge && (
            <div className="no-print" style={{ position:'absolute', right:0, top:0, bottom:0, width:'300px', borderLeft:'1px solid #ddd', padding:'20px', backgroundColor:'#fff', zIndex:1000, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{fontSize:'14px', margin: 0}}>線のデザイン</h3>
                <button onClick={clearSelection} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', padding: '0 5px' }}>×</button>
              </div>

              <div style={{ display:'flex', gap:'5px', marginBottom:'15px' }}>
                <button onClick={() => { takeSnapshot(); setEdges((eds: any[]) => { const maxZ = Math.max(0, ...eds.map((n: any) => Number(n.zIndex) || 0)); return eds.map((n: any) => n.selected ? {...n, zIndex: maxZ + 1} : n); })}} style={{flex:1, padding:'6px', fontSize:'11px', fontWeight: 'bold', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '4px'}}>↑ 最前面へ</button>
                <button onClick={() => { takeSnapshot(); setEdges((eds: any[]) => { const minZ = Math.min(0, ...eds.map((n: any) => Number(n.zIndex) || 0)); return eds.map((n: any) => n.selected ? {...n, zIndex: minZ - 1} : n); })}} style={{flex:1, padding:'6px', fontSize:'11px', fontWeight: 'bold', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '4px'}}>↓ 最背面へ</button>
              </div>

              <div style={{ padding: '15px', borderRadius: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', marginBottom: '15px' }}>
                  <label style={{fontSize: '11px', fontWeight: 'bold', color: '#1d4ed8'}}>文字の部分装飾 (編集中のみ)</label>
                  <p style={{fontSize: '10px', color: '#666', marginTop: '4px', marginBottom: '10px', lineHeight: '1.4'}}>
                      ※線を選択して<b>Tabキー</b>で編集モードに入り、<br/>
                      <u>マウスで文字をなぞって選択してから</u>押してください。
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                     <div style={{ display:'flex', gap:'5px' }}>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('bold')} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '4px 8px', fontSize:'11px', borderRadius: '4px', background: '#fff' }}>太字</button>
                        <input type="color" onMouseDown={(e) => e.preventDefault()} onChange={(e) => applyUnifiedFormat('foreColor', e.target.value)} style={{width:'24px', height:'24px', cursor: 'pointer', border: 'none', padding: 0}} />
                     </div>
                     <div style={{ display:'flex', gap:'5px' }}>
                        <button onClick={() => updateEdgeDesign({ labelStyle: { ...selectedEdge.data?.labelStyle, textAlign: 'left' } })} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '4px 8px', fontSize:'11px', borderRadius: '4px', background: '#fff' }}>左詰</button>
                        <button onClick={() => updateEdgeDesign({ labelStyle: { ...selectedEdge.data?.labelStyle, textAlign: 'center' } })} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '4px 8px', fontSize:'11px', borderRadius: '4px', background: '#fff' }}>中央</button>
                     </div>
                  </div>

                  <label style={{fontSize:'10px', fontWeight: 'bold'}}>線の文字サイズ (px)</label>
                  <div style={{display:'flex', alignItems:'center', gap:'8px', marginTop: '5px'}}>
                    <input type="range" min="10" max="50" value={Number(selectedEdge.data?.fontSize || 14)} onChange={(e) => updateEdgeDesign({ fontSize: Number(e.target.value) })} style={{flex:1}} />
                    <input type="number" min="10" max="50" value={Number(selectedEdge.data?.fontSize || 14)} onChange={(e) => updateEdgeDesign({ fontSize: Number(e.target.value) })} style={{width:'40px', padding:'2px', fontSize:'11px', border:'1px solid #ccc', borderRadius:'4px'}} />
                  </div>
              </div>

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>文字入り線 (クイック)</label>
              <div style={{ display:'flex', gap:'5px', marginTop: '5px', marginBottom: '20px' }}>
                <button onClick={() => updateEdgeDesign({ label: '<span style="color: red;">YES</span>', labelStyle: { ...selectedEdge.data?.labelStyle, textAlign: 'center' } })} style={{flex:1, padding:'6px', border: '1px solid #fca5a5', color: 'red', background: '#fef2f2', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'}}>YES 線</button>
                <button onClick={() => updateEdgeDesign({ label: '<span style="color: blue;">NO</span>', labelStyle: { ...selectedEdge.data?.labelStyle, textAlign: 'center' } })} style={{flex:1, padding:'6px', border: '1px solid #93c5fd', color: 'blue', background: '#eff6ff', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'}}>NO 線</button>
              </div>

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>線の太さ</label>
              <div style={{ display:'flex', gap:'10px', alignItems: 'center', marginBottom:'15px', marginTop: '5px' }}>
                <input type="range" min="0.5" max="10" step="0.5" value={Number(selectedEdge.style?.strokeWidth) || 1} onChange={(e) => updateEdgeDesign({ strokeWidth: Number(e.target.value) })} style={{flex: 1}} />
                <span style={{fontSize: '12px', fontWeight: 'bold', width: '24px', textAlign: 'right'}}>{Number(selectedEdge.style?.strokeWidth) || 1}</span>
              </div>

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>線の色</label>
              <input type="color" value={selectedEdge.data?.color || '#333333'} onChange={(e) => updateEdgeDesign({ color: e.target.value })} style={{width:'100%', height:'24px', border:'none', cursor:'pointer', padding:0, marginBottom:'20px', marginTop: '5px'}} />

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>種類 (7種)</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginTop: '5px' }}>
                {[{l:'普通',c:{ resetDesign: true, markerType: 'none', label: '' }},{l:'片矢印 (→)',c:{ resetDesign: true, markerType: 'arrow', label: '' }},{l:'二重片矢印 (⇒)',c:{ resetDesign: true, double: true, markerType: 'custom-double-arrow', label: '' }},{l:'両矢印 (↔)',c:{ resetDesign: true, markerType: 'both', label: '' }},{l:'二重両矢印 (⇔)',c:{ resetDesign: true, double: true, markerType: 'custom-double-both', label: '' }},{l:'論理和 (∧)',c:{ resetDesign: true, markerType: 'none', label: '∧' }},{l:'論理積 (∨)',c:{ resetDesign: true, markerType: 'none', label: '∨' }}].map(item => (
                  <button key={item.l} onClick={() => updateEdgeDesign(item.c)} style={{padding:'8px', fontSize:'12px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', fontWeight: 'bold'}}>{item.l}</button>
                ))}
              </div>
              <button onClick={() => { takeSnapshot(); setEdges((eds: any[]) => eds.filter((e: any) => !e.selected)); }} style={{ width:'100%', marginTop:'30px', color: 'red', fontSize:'12px', border: '1px solid red', background: '#fffcfc', padding: '8px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '8px' }}>線を削除</button>
            </div>
          )}
        </div>

        {/* 下部バー */}
        {isBottomBarOpen ? (
          <div className="no-print" style={{ padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.95)', borderTop: '1px solid #eee', display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', justifyContent: 'center', alignItems: 'center', gap: '6px', zIndex: 1001, boxShadow: '0 -4px 10px rgba(0,0,0,0.03)', backdropFilter: 'blur(4px)' }}>
            
            {isPrintMode ? (
               <>
                 <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#b91c1c', padding: '0 10px' }}>🖨️ 印刷モード</div>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <button onClick={addPrintZone} style={{ ...actionBtnStyle, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>📄 印刷範囲を追加</button>
                 <button onClick={executePrint} style={{ ...actionBtnStyle, backgroundColor: '#10b981', color: '#fff', border: 'none', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>✅ 印刷を実行</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <button onClick={togglePrintMode} style={{ ...actionBtnStyle, color: '#4b5563' }}>❌ キャンセル</button>
               </>
            ) : (
               <>
                 <button onClick={undo} disabled={past.length === 0} style={{ ...actionBtnStyle, opacity: past.length === 0 ? 0.4 : 1, cursor: past.length === 0 ? 'default' : 'pointer' }}>↩️ 戻る</button>
                 <button onClick={redo} disabled={future.length === 0} style={{ ...actionBtnStyle, opacity: future.length === 0 ? 0.4 : 1, cursor: future.length === 0 ? 'default' : 'pointer' }}>↪️ 進む</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <button onClick={handleManualSave} style={{ ...primaryBtnStyle, backgroundColor: '#059669', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.3)' }}>💾 保存</button>
                 <button onClick={() => jsonImportRef.current?.click()} style={actionBtnStyle}>📥 読込</button>
                 <button onClick={exportData} style={actionBtnStyle}>📤 書出</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <button onClick={goBack} disabled={isRoot} style={{ ...actionBtnStyle, opacity: isRoot ? 0.4 : 1, cursor: isRoot ? 'default' : 'pointer' }}>🔙 前へ</button>
                 <button onClick={goTop} disabled={isRoot} style={{ ...actionBtnStyle, opacity: isRoot ? 0.4 : 1, cursor: isRoot ? 'default' : 'pointer' }}>🏠 TOP</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 
                 <button onClick={() => setIsLassoMode(!isLassoMode)} style={{ ...actionBtnStyle, backgroundColor: isLassoMode ? '#ef4444' : '#fff', color: isLassoMode ? '#fff' : '#333', border: isLassoMode ? 'none' : '1px solid #ccc' }}>
                     {isLassoMode ? '🔓 画面ロック解除' : '🔒 一括選択(ロック)'}
                 </button>

                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 })} style={actionBtnStyle}>🎯 中央</button>
                 <button onClick={togglePrintMode} style={{ ...actionBtnStyle, backgroundColor: '#f1f5f9' }}>🖨️ 印刷設定</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <button onClick={() => addNode('text')} style={primaryBtnStyle}>📝 テキスト</button>
                 <button onClick={() => addNode('image')} style={{ ...primaryBtnStyle, backgroundColor: '#10b981', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>📸 画像</button>
                 <button onClick={() => addNode('shape')} style={{ ...primaryBtnStyle, backgroundColor: '#f59e0b', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)' }}>🟦 図形</button>
                 <button onClick={() => addNode('table')} style={{ ...primaryBtnStyle, backgroundColor: '#6366f1', boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)' }}>🧮 表</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', color: '#555', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                   <span>🎨 背景</span>
                   <input type="color" value={levelData[currentLevel]?.bgColor || '#ffffff'} onChange={(e) => {
                     const newColor = e.target.value; setLevelData(prev => ({ ...prev, [currentLevel]: { ...(prev[currentLevel] || {}), bgColor: newColor } }));
                   }} style={{width:'16px', height:'16px', cursor:'pointer', border: 'none', padding: 0, borderRadius: '4px'}} />
                 </div>
                 <button onClick={() => setIsBottomBarOpen(false)} style={{ padding: '4px 8px', marginLeft: 'auto', fontSize: '10px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>▼ 隠す</button>
               </>
            )}
          </div>
        ) : (
          <button className="no-print" onClick={() => setIsBottomBarOpen(true)} style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 100, padding: '4px 8px', fontSize: '10px', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569', boxShadow: '0 -2px 4px rgba(0,0,0,0.1)' }}>▲ ツールバーを表示</button>
        )}
      </div>
    </div>
  );
}

export default function App() { return (<ReactFlowProvider><FlowEditor /></ReactFlowProvider>); }
