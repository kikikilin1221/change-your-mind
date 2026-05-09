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
  
  .html-content { user-select: text !important; -webkit-user-select: text !important; outline: none !important; border: none !important; }
  
  @media print {
      .no-print { display: none !important; }
      .react-flow__background { display: none !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .react-flow__handle { display: none !important; }
      .react-flow__node { box-shadow: none !important; }
  }

  /* ★ ReactFlowデフォルトの不要な枠線を完全破壊 */
  .react-flow__node, .react-flow__node-default, .react-flow__node-custom {
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
      border-radius: 0 !important;
      padding: 0 !important;
      outline: none !important;
  }

  .react-flow__handle { background: transparent !important; border: none !important; width: 1px !important; height: 1px !important; min-width: 0 !important; min-height: 0 !important; box-shadow: none !important; }
  .custom-handle, .custom-handle-target { width: 24px !important; height: 24px !important; background: transparent !important; border: none !important; z-index: 10 !important; cursor: crosshair !important; pointer-events: auto !important; display: flex; justify-content: center; align-items: center; }
  .custom-handle::before, .custom-handle-target::before { content: ""; display: block; width: 0px; height: 0px; background: #3b82f6; border-radius: 50%; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); border: 2px solid #fff; opacity: 0; }
  .custom-handle:hover::before, .custom-handle-target:hover::before { width: 14px; height: 14px; opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  
  /* ★ 改善：枠線と線の間の空白距離を 3px に調整（論理記号の構造には影響しません） */
  .custom-handle-offset-top { top: -3px !important; }
  .custom-handle-offset-bottom { bottom: -3px !important; }
  .custom-handle-offset-left { left: -3px !important; }
  .custom-handle-offset-right { right: -3px !important; }
  
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
  const isDouble = (data as any)?.double; 
  const isEditing = Boolean((data as any)?.isEditing);
  const hideLine = Boolean((data as any)?.hideLine); 
  const strokeWidth = Number(style?.strokeWidth) || 1; 
  const edgeColor = (data as any)?.color || '#333';
  const labelStyle = (data as any)?.labelStyle || { textAlign: 'center' }; 
  const fontSize = (data as any)?.fontSize || 14;
  const mType = (data as any)?.markerType;

  const displayLabel = label === undefined || label === null || label === 'undefined' ? '' : String(label);
  
  let rMarkerEnd = markerEnd; let rMarkerStart = markerStart;
  if (mType === 'custom-double-arrow' || mType === 'custom-double-both') { rMarkerEnd = `url(#custom-arrow-${id})`; }
  if (mType === 'custom-double-both') { rMarkerStart = `url(#custom-arrow-start-${id})`; }
  
  const customArrowSize = strokeWidth * 2 + 18; 

  return (
    <>
      {isDouble && !hideLine && (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            {/* ★ デザイン維持：突き抜けを物理カットするマスク構造（背景色 #fff3dd） */}
            <marker id={`custom-arrow-${id}`} viewBox="0 0 24 24" refX="22" refY="12" markerWidth={customArrowSize} markerHeight={customArrowSize} markerUnits="userSpaceOnUse" orient="auto">
              <rect x="0" y="0" width="24" height="24" fill="#fff3dd" stroke="none" />
              <polyline points="4,3 18,12 4,21" fill="none" stroke={edgeColor} strokeWidth={strokeWidth >= 3 ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id={`custom-arrow-start-${id}`} viewBox="0 0 24 24" refX="2" refY="12" markerWidth={customArrowSize} markerHeight={customArrowSize} markerUnits="userSpaceOnUse" orient="auto">
              <rect x="0" y="0" width="24" height="24" fill="#fff3dd" stroke="none" />
              <polyline points="20,3 6,12 20,21" fill="none" stroke={edgeColor} strokeWidth={strokeWidth >= 3 ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
        </svg>
      )}
      
      {!hideLine && (
          isDouble ? (
            <>
              <BaseEdge path={edgePath} style={{ ...style, strokeWidth: strokeWidth + 8, stroke: edgeColor }} />
              <BaseEdge path={edgePath} style={{ ...style, strokeWidth: strokeWidth + 4, stroke: '#fff3dd' }} />
              <BaseEdge path={edgePath} markerEnd={rMarkerEnd} markerStart={rMarkerStart} style={{ strokeWidth: strokeWidth, stroke: 'transparent', fill: 'none' }} />
            </>
          ) : ( <BaseEdge id={id} path={edgePath} markerEnd={rMarkerEnd} markerStart={rMarkerStart} style={{ ...style, strokeWidth, stroke: edgeColor }} /> )
      )}

      {displayLabel || isEditing ? (
        <EdgeLabelRenderer>
          <div className="no-print" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, zIndex: 1000, pointerEvents: 'auto' }}>
              <div
                  id={`edit-edge-${id}`} className={isEditing ? "nodrag html-content editing-mode" : "nodrag html-content"} contentEditable={isEditing} suppressContentEditableWarning
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

type TableActionType = { id: string; type: string; startX: number; startY: number; startR: number; startC: number; minC: number; maxC: number; minR: number; maxR: number; initWidths: number[]; initHeights: number[]; };

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
  const copiedTableCellsRef = useRef<any>(null); 

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

  // ★ 論理ブロックスタック（証明展開）機能
  const addLogicalDerivationBlock = useCallback((type: 'double_arrow' | 'single_arrow' | 'and' | 'or') => {
    if (!primaryNode) return;
    takeSnapshot();

    const w0 = primaryNode.measured?.width || primaryNode.width || Number(primaryNode.style?.width) || 200;
    const h0 = primaryNode.measured?.height || primaryNode.height || Number(primaryNode.style?.height) || 100;
    const parentFontSize = primaryNode.style?.fontSize || '14px';
    const x0 = primaryNode.position.x;
    const y0 = primaryNode.position.y;

    const currentNodes = nodesRef.current;
    
    // 現在のノードを起点とするスタックの数を計算
    const isDerivationBlock = (n: any) => n.data?.isDerivationBlock && n.data?.parentNodeId === primaryNode.id;
    const derivationBlocks = currentNodes.filter(n => isDerivationBlock(n) && !n.data?.isTransparentHelper);
    
    const count = derivationBlocks.length;
    // ★ 100px に固定（前回の改善を維持）
    const gapX = 100; 
    const gapY = h0; 
    
    const newX = x0 + w0 + gapX;
    const newY = y0 + count * gapY; 

    // 新しいテキスト枠（0.5px黒枠、背景白）
    const newNodeId = `logical-n-${Date.now()}-${Math.random()}`;
    const newStyle = { ...primaryNode.style, width: w0, height: h0, fontSize: parentFontSize, borderWidth: 0.5, borderColor: '#000000', backgroundColor: '#ffffff' };
    const newNodeZ = Math.max(0, ...currentNodes.map((n: any) => Number(n.zIndex) || 0)) + 1;
    const newNode = { 
        id: newNodeId, selected: false, position: { x: newX, y: newY }, 
        data: { ...primaryNode.data, content: '', isEditing: false, isDerivationBlock: true, parentNodeId: primaryNode.id }, 
        style: newStyle, zIndex: newNodeZ 
    };

    let sourceNodeId = primaryNode.id;
    let transparentNode = null;

    if (count > 0) {
        const tNodeId = `logical-t-${Date.now()}-${Math.random()}`;
        const tStyle = { ...primaryNode.style, width: w0, height: h0, backgroundColor: 'transparent', borderColor: 'transparent', color: 'transparent', borderWidth: 0, opacity: 0, pointerEvents: 'none' };
        transparentNode = { 
            id: tNodeId, selected: false, position: { x: x0, y: newY }, 
            data: { ...primaryNode.data, content: '', isDerivationBlock: true, parentNodeId: primaryNode.id, isTransparentHelper: true }, 
            style: tStyle, zIndex: -10 
        };
        sourceNodeId = tNodeId;
    }

    setNodes((nds: any[]) => {
        let updatedNodes = nds.map((n: any) => n.id === primaryNode.id ? { ...n, selected: true } : { ...n, selected: false, data: {...n.data, isEditing: false} });
        if (transparentNode) updatedNodes.push(transparentNode);
        updatedNodes.push(newNode);
        return updatedNodes;
    });

    const edgeId = `e-${sourceNodeId}-${newNodeId}-${Date.now()}`;
    let edgeProps: any = { type: 'default', label: '', style: { strokeWidth: 2, stroke: '#333' }, data: { color: '#333' } };
    
    if (type === 'double_arrow') { edgeProps.data.markerType = 'custom-double-both'; edgeProps.data.double = true; edgeProps.data.fontSize = 18; } 
    else if (type === 'single_arrow') { edgeProps.data.markerType = 'custom-double-arrow'; edgeProps.data.double = true; edgeProps.data.fontSize = 18; } 
    else if (type === 'and') { edgeProps.data.markerType = 'none'; edgeProps.data.fontSize = 20; edgeProps.label = '∧'; edgeProps.data.hideLine = true; } 
    else if (type === 'or') { edgeProps.data.markerType = 'none'; edgeProps.data.fontSize = 20; edgeProps.label = '∨'; edgeProps.data.hideLine = true; }

    setEdges((eds: any[]) => [...eds.map((e: any) => ({...e, selected:false})), { 
        id: edgeId, source: sourceNodeId, target: newNodeId, 
        sourceHandle: 'right-src', targetHandle: 'left-tgt', 
        ...edgeProps, zIndex: 0 
    }]);
  }, [primaryNode, takeSnapshot]);


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
      
      let newHideLine = config.hideLine !== undefined ? config.hideLine : e.data?.hideLine;
      if (config.resetDesign) { newDouble = config.double || false; newMarkerType = config.markerType || 'none'; newHideLine = config.hideLine || false; if(config.label !== undefined) newLabel = config.label; }

      let mEnd = undefined; let mStart = undefined;
      if (newMarkerType === 'arrow') { mEnd = baseMarker; } if (newMarkerType === 'both') { mEnd = baseMarker; mStart = baseMarker; }

      const newLabelStyle = config.labelStyle !== undefined ? config.labelStyle : e.data?.labelStyle;
      const newFontSize = config.fontSize !== undefined ? config.fontSize : (e.data?.fontSize || 14);

      return { ...e, style: { ...e.style, strokeWidth: newStrokeWidth, stroke: newColor }, data: { ...(e.data || {}), double: newDouble, color: newColor, labelStyle: newLabelStyle, fontSize: newFontSize, markerType: newMarkerType, hideLine: newHideLine }, markerEnd: mEnd, markerStart: mStart, label: newLabel };
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
    let style: any = { backgroundColor: '#ffffff', color: '#000000', borderRadius: '12px', fontSize: '14px', fontFamily: 'sans-serif', width: 200, height: 100, hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb', padding: '4px', borderColor: '#000000', borderWidth: 0.5 };
    
    if (type === 'image') { fileInputRef.current?.click(); return; }
    if (type === 'shape') { data = { content: '', isShape: true, shapeType: 'rect', keepRatio: false, textOffsetX: 0, textOffsetY: 0, isEditing: false }; style = { ...style, backgroundColor: '#eee', borderRadius: '4px', borderColor: '#000000', borderWidth: 0.5 }; }
    if (type === 'table') {
      data = { 
          isTable: true, rows: 2, cols: 2, textOffsetX: 0, textOffsetY: 0, editingCell: null, tableTitle: '',
          cells: { "0-0": { content: "セル", style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }, "0-1": { content: "セル", style: { border: '1px solid #ccc', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }, "1-0": { content: "セル", style: { border: '1px solid #333', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } }, "1-1": { content: "セル", style: { border: '1px solid #333', hAlign: 'left', vAlign: 'top', writingMode: 'horizontal-tb' } } } 
      };
      style = { ...style, width: 300, height: 150, padding: 0, backgroundColor: '#fff', display: 'block', borderRadius: '8px', borderColor: '#000000', borderWidth: 0 };
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
                  if (action.type.includes('col') || action.type.includes('xy')) {
                      const numCols = action.maxC - action.minC + 1;
                      const deltaPerCol = dx / numCols;
                      for (let c = action.minC; c <= action.maxC; c++) newWidths[c] = Math.max(30, action.initWidths[c] + deltaPerCol);
                  }
                  if (action.type.includes('row') || action.type.includes('xy')) {
                      const numRows = action.maxR - action.minR + 1;
                      const deltaPerRow = dy / numRows;
                      for (let r = action.minR; r <= action.maxR; r++) newHeights[r] = Math.max(20, action.initHeights[r] + deltaPerRow);
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

  const flowNodes = useMemo(() => {
    const centerNode: any = { id: 'center-mark', type: 'default', position: { x: -10, y: -10 }, draggable: false, selectable: false, data: { label: '＋' }, style: { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '14px', fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', border: '2px solid #ef4444', zIndex: -1000, pointerEvents: 'none', padding: 0 } };
    return [centerNode, ...nodes.map(n => {
      const isEditingNode = Boolean(n.data?.isEditing);
      const bColor = n.style?.borderColor || '#000000'; 
      const bWidth = n.style?.borderWidth !== undefined ? Number(n.style.borderWidth) : (n.data?.isImage || n.data?.isTable ? 0 : 0.5);
      const resolvedBorder = n.data?.isTransparentHelper ? 'none' : (bWidth > 0 ? `${bWidth}px solid ${bColor}` : 'none');
      const ai = n.style?.vAlign === 'top' ? 'flex-start' : n.style?.vAlign === 'bottom' ? 'flex-end' : 'center';
      const jc = n.style?.hAlign === 'left' ? 'flex-start' : n.style?.hAlign === 'right' ? 'flex-end' : 'center';

      return {
        ...n,
        data: {
          ...n.data,
          label: (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: jc, justifyContent: ai, position: 'relative', border: resolvedBorder, borderRadius: n.style?.borderRadius || '12px', backgroundColor: n.style?.backgroundColor || '#fff', padding: '4px' }}>
              {n.id !== 'center-mark' && (
                <>
                  <Handle type="target" position={Position.Top} id="top-tgt" className="custom-handle-target custom-handle-offset-top" /><Handle type="target" position={Position.Bottom} id="bottom-tgt" className="custom-handle-target custom-handle-offset-bottom" /><Handle type="target" position={Position.Left} id="left-tgt" className="custom-handle-target custom-handle-offset-left" /><Handle type="target" position={Position.Right} id="right-tgt" className="custom-handle-target custom-handle-offset-right" />
                  <Handle type="source" position={Position.Left} id="left-src" className="custom-handle custom-handle-offset-left" /><Handle type="source" position={Position.Right} id="right-src" className="custom-handle custom-handle-offset-right" /><Handle type="source" position={Position.Top} id="top-src" className="custom-handle custom-handle-offset-top" /><Handle type="source" position={Position.Bottom} id="bottom-src" className="custom-handle custom-handle-offset-bottom" />
                </>
              )}
              {n.id !== 'center-mark' && !n.data?.isTransparentHelper && (
                <div 
                    id={`edit-${n.id}`} className={"nodrag html-content"} contentEditable={isEditingNode} suppressContentEditableWarning
                    onBlur={(e) => { setNodes(nds => nds.map(node => node.id === n.id ? { ...node, data: { ...node.data, isEditing: false, content: e.currentTarget.innerHTML } } : node)); }}
                    style={{ outline: 'none', color: n.style?.color || '#000', fontSize: n.style?.fontSize || '14px', textAlign: n.style?.hAlign || 'left' }}
                    ref={el => { if (el && !isEditingNode) el.innerHTML = renderHTMLWithMath(n.data?.content || ''); }}
                />
              )}
              <NodeResizer isVisible={n.selected} />
            </div>
          ),
          style: { ...n.style, border: 'none', backgroundColor: 'transparent', padding: 0 }
        }
      };
    })];
  }, [nodes]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ flexGrow: 1, position: 'relative', backgroundColor: '#fff3dd' }}>
        <ReactFlow nodes={flowNodes} edges={edges} edgeTypes={edgeTypes} onNodesChange={u => setNodes(nds => applyNodeChanges(u, nds))} onEdgesChange={u => setEdges(eds => applyEdgeChanges(u, eds))} onConnect={p => setEdges(eds => addEdge(p, eds))} fitView>
          <Background /><Controls />
        </ReactFlow>
        {selectedNodes.length > 0 && primaryNode && (
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'300px', background:'#fff', padding:'20px', zIndex:1000 }}>
             <h3>設定</h3>
             <label>枠線の太さ</label>
             <input type="range" min="0" max="10" step="0.5" value={Number(primaryNode.style?.borderWidth || 0.5)} onChange={(e) => updateSelectedNodes({}, { borderWidth: Number(e.target.value) })} />
             <div style={{ marginTop: '20px' }}>
                <label>論理ブロック追加</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                   <button onClick={() => addLogicalDerivationBlock('double_arrow')}>⇔</button>
                   <button onClick={() => addLogicalDerivationBlock('single_arrow')}>⇨</button>
                   <button onClick={() => addLogicalDerivationBlock('and')}>∧</button>
                   <button onClick={() => addLogicalDerivationBlock('or')}>∨</button>
                </div>
             </div>
             <button onClick={() => setNodes(nds => nds.filter(n => !n.selected))} style={{ marginTop:'20px', color:'red' }}>削除</button>
          </div>
        )}
      </div>
      <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', gap:'10px' }}>
         <button onClick={() => addNode('text')}>📝 テキスト追加</button>
         <button onClick={handleManualSave}>💾 保存</button>
         <button onClick={undo}>↩️ 戻る</button>
         <button onClick={redo}>↪️ 進む</button>
      </div>
    </div>
  );
}

export default function App() { return (<ReactFlowProvider><FlowEditor /></ReactFlowProvider>); }
