'use client';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge,
  NodeResizer, ReactFlowProvider, useStore, MarkerType, getBezierPath, EdgeProps, BaseEdge, EdgeLabelRenderer, useReactFlow, Position, Handle, ConnectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import katex from 'katex';
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
          {/* ★ 線の文字の背景(background)や枠線を消し、シンプルなテキストのみにしました */}
          <div className="no-print" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, padding: '2px 4px', fontSize: '14px', fontWeight: 'bold', color: '#333', pointerEvents: 'none', zIndex: 1000 }}>{String(label)}</div>
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
  } catch(e) {
      return html;
  }
};

const extractFirstLineText = (html: string) => {
  if (!html) return '名称未設定';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html.replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  const text = tempDiv.textContent || tempDiv.innerText || '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const firstLine = lines[0] || '名称未設定';
  return firstLine.length > 15 ? firstLine.substring(0, 15) + '...' : firstLine;
};

const safeCloneNodes = (nds: any[]) => nds.map(n => ({ ...n, data: { ...n.data }, style: { ...n.style }, position: { ...n.position } }));
const safeCloneEdges = (eds: any[]) => eds.map(e => ({ ...e, data: { ...e.data }, style: { ...e.style } }));

const edgeTypes = { default: DoubleEdge };
const PASTEL_COLORS = ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F3E5F5', '#E1F5FE', '#FFF9C4', '#FCE4EC', '#E8F5E9'];
const QUICK_TEXT_COLORS = ['#000000', '#FF0000', '#008000', '#0000FF', '#FFF000'];

function FlowEditor() {
  const { setViewport, getZoom } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExpandedEditor, setIsExpandedEditor] = useState(false);
  const [isTopBarOpen, setIsTopBarOpen] = useState(true);
  const [isBottomBarOpen, setIsBottomBarOpen] = useState(true);
  
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
  
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

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

  const clearSelection = useCallback(() => {
    setNodes((nds: any[]) => nds.map((n: any) => ({...n, selected: false})));
    setEdges((eds: any[]) => eds.map((e: any) => ({...e, selected: false})));
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

  useEffect(() => {
    if (primaryNode && !primaryNode.data?.isTable) {
        setPartialFontSize(parseInt(String(primaryNode.style?.fontSize || 14)));
    }
  }, [primaryNode?.id, primaryNode?.style?.fontSize, primaryNode?.data?.isTable]);

  useEffect(() => {
    const saved = localStorage.getItem('my-logic-files');
    if (saved) {
      const parsed = JSON.parse(saved);
      setFiles(parsed);
      const lastId = localStorage.getItem('my-logic-active-id') || 'default';
      if (parsed[lastId]) loadFileInitial(lastId, parsed);
    } else {
      const initial = { 'default': { name: '無題のノート', levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } }, currentLevel: 'root', currentLabel: 'TOP層' } };
      setFiles(initial); 
      localStorage.setItem('my-logic-files', JSON.stringify(initial));
    }
  }, []);

  const handleManualSave = useCallback(() => {
    setFiles(prev => {
        const currentFileData = prev[activeFileId];
        if (!currentFileData) return prev;
        const updatedLevelData = { ...levelData, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: levelData[currentLevel]?.bgColor, label: currentLabelRef.current } };
        const updatedFiles = { ...prev, [activeFileId]: { ...currentFileData, levelData: updatedLevelData, currentLevel, currentLabel: currentLabelRef.current } };
        localStorage.setItem('my-logic-files', JSON.stringify(updatedFiles));
        localStorage.setItem('my-logic-active-id', activeFileId);
        return updatedFiles;
    });
    alert('💾 データを保存しました！');
  }, [activeFileId, currentLevel, levelData]);

  const loadFileInitial = (id: string, allFiles = files) => {
    const target = allFiles[id]; if (!target) return;
    const loadedLevelData = target.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } };
    const initialLevel = target.currentLevel || 'root';
    setActiveFileId(id); setLevelData(loadedLevelData); setCurrentLevel(initialLevel); 
    setCurrentLabel(loadedLevelData[initialLevel]?.label || target.currentLabel || 'TOP層');
    setNodes(loadedLevelData[initialLevel]?.nodes || []); setEdges(loadedLevelData[initialLevel]?.edges || []);
    setHistoryLevel([]); setPast([]); setFuture([]); setSelectedCells({});
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
          setActiveFileId(newId);
          const nextLevelData = target.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } };
          const nextLevel = target.currentLevel || 'root';
          setLevelData(nextLevelData); setCurrentLevel(nextLevel); 
          setCurrentLabel(nextLevelData[nextLevel]?.label || target.currentLabel || 'TOP層');
          setNodes(nextLevelData[nextLevel]?.nodes || []); setEdges(nextLevelData[nextLevel]?.edges || []);
          setPast([]); setFuture([]); savedRangeRef.current = null; setSelectedCells({});
        }
        return currentFiles;
      });
    }, 0);
  };

  const createNewFile = () => {
    const name = prompt("ファイル名", `ノート ${Object.keys(files).length + 1}`);
    if (!name) return;
    const newId = `file-${Date.now()}`;
    const newF = { name, levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff', label: 'TOP層' } }, currentLevel: 'root', currentLabel: 'TOP層' };
    setFiles(prev => ({ ...prev, [newId]: newF })); switchFile(newId);
  };

  const deleteFile = (id: string) => {
    if (Object.keys(files).length <= 1) return;
    if (!confirm("削除しますか？")) return;
    const updated = { ...files }; delete updated[id];
    setFiles(updated); if (id === activeFileId) switchFile(Object.keys(updated)[0]);
  };

  const updateSelectedNodes = useCallback((newData: any, newStyle: any = {}) => {
    setNodes((nds: any[]) => nds.map((n: any) => n.selected ? {
        ...n,
        data: { ...(n.data || {}), ...(typeof newData === 'function' ? newData(n.data) : newData) },
        style: { ...(n.style || {}), ...newStyle }
    } : n));
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const applyUnifiedFormat = (type: 'fontName' | 'bold' | 'strikeThrough' | 'foreColor' | 'fontSize', value: any = '') => {
      takeSnapshot();
      const isActive = document.activeElement === editorRef.current;
      const isTableEditing = primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0;

      if (isActive && editorRef.current) {
          const selection = window.getSelection();
          if (!selection) return;
          if (savedRangeRef.current) { selection.removeAllRanges(); selection.addRange(savedRangeRef.current); }

          if (type === 'fontSize') {
              if (selection.rangeCount === 0) return;
              const range = selection.getRangeAt(0);
              if (range.collapsed) {
                  let currentNode = range.startContainer as Node | null;
                  if (currentNode && currentNode.nodeType === Node.TEXT_NODE) currentNode = currentNode.parentNode;
                  if (currentNode && currentNode.nodeName === 'SPAN' && (currentNode.textContent === '\u200B' || currentNode.textContent === '')) {
                      (currentNode as HTMLElement).style.fontSize = value;
                  } else {
                      const span = document.createElement('span');
                      span.style.fontSize = value; span.style.lineHeight = '1.2'; span.innerHTML = '\u200B'; 
                      range.insertNode(span); range.setStart(span.firstChild!, 1); range.collapse(true);
                      selection.removeAllRanges(); selection.addRange(range);
                  }
              } else {
                  document.execCommand('fontSize', false, '7');
                  const fonts = editorRef.current.querySelectorAll('font[size="7"]');
                  fonts.forEach((f) => {
                      const el = f as HTMLElement; el.removeAttribute('size'); el.style.fontSize = value; el.style.lineHeight = '1.2';
                  });
              }
          } else {
              document.execCommand(type, false, value);
          }
          if (selection.rangeCount > 0) savedRangeRef.current = selection.getRangeAt(0).cloneRange();
          
          if (isTableEditing) {
              const activeCells = selectedCells[primaryNode.id];
              setNodes(nds => nds.map(n => n.id === primaryNode.id ? {
                  ...n, data: { ...n.data, cells: { ...n.data.cells, [activeCells[0]]: { ...n.data.cells[activeCells[0]], content: editorRef.current!.innerHTML } } }
              } : n));
          } else {
              updateSelectedNodes({ content: editorRef.current.innerHTML });
          }
      } else {
          if (isTableEditing) {
              const activeCells = selectedCells[primaryNode.id];
              setNodes(nds => nds.map(n => {
                  if (n.id !== primaryNode.id) return n;
                  const newCells = { ...n.data.cells };
                  activeCells.forEach(cId => {
                      const cell = newCells[cId] || { content: '', style: {} };
                      let newStyle = { ...cell.style };
                      if (type === 'fontSize') newStyle.fontSize = value;
                      if (type === 'foreColor') newStyle.color = value;
                      if (type === 'fontName') newStyle.fontFamily = value;
                      if (type === 'bold') newStyle.fontWeight = newStyle.fontWeight === 'bold' ? 'normal' : 'bold';
                      if (type === 'strikeThrough') newStyle.textDecoration = newStyle.textDecoration === 'line-through' ? 'none' : 'line-through';
                      newCells[cId] = { ...cell, style: newStyle };
                  });
                  return { ...n, data: { ...n.data, cells: newCells } };
              }));
          } else {
              const styleKeyMap: any = { fontName: 'fontFamily', bold: 'fontWeight', strikeThrough: 'textDecoration', foreColor: 'color', fontSize: 'fontSize' };
              const styleKey = styleKeyMap[type];
              let styleVal = value;
              if (type === 'bold') styleVal = primaryNode?.style?.fontWeight === 'bold' ? 'normal' : 'bold';
              if (type === 'strikeThrough') styleVal = primaryNode?.style?.textDecoration === 'line-through double' ? 'none' : 'line-through double';

              setNodes((nds: any[]) => nds.map((n: any) => {
                  if (!n.selected) return n;
                  const tempDiv = document.createElement('div'); tempDiv.innerHTML = n.data?.content || '';
                  tempDiv.querySelectorAll('*').forEach(el => {
                      const e = el as HTMLElement;
                      if (type === 'fontSize') { if(e.style.fontSize) e.style.fontSize = ''; if(e.tagName==='FONT') e.removeAttribute('size'); }
                      if (type === 'foreColor') { if(e.style.color) e.style.color = ''; if(e.tagName==='FONT') e.removeAttribute('color'); }
                      if (type === 'fontName') { if(e.style.fontFamily) e.style.fontFamily = ''; if(e.tagName==='FONT') e.removeAttribute('face'); }
                      if (type === 'bold') { if(e.style.fontWeight) e.style.fontWeight = ''; if(e.tagName==='B'||e.tagName==='STRONG') e.style.fontWeight = 'normal'; }
                      if (type === 'strikeThrough') { if(e.style.textDecoration) e.style.textDecoration = ''; if(e.tagName==='STRIKE') e.style.textDecoration = 'none'; }
                  });
                  return { ...n, data: { ...n.data, content: tempDiv.innerHTML }, style: { ...n.style, [styleKey]: styleVal } };
              }));
          }
      }
  };

  const handleResetFormat = () => {
      takeSnapshot();
      setPartialFontSize(14);
      const isActive = document.activeElement === editorRef.current;
      const isTableEditing = primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0;
      
      if (isActive && editorRef.current) {
          editorRef.current.focus();
          const selection = window.getSelection();
          if (!selection) return;
          if (savedRangeRef.current) { selection.removeAllRanges(); selection.addRange(savedRangeRef.current); }

          if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              if (range.collapsed) {
                  if (document.queryCommandState('bold')) document.execCommand('bold');
                  if (document.queryCommandState('strikeThrough')) document.execCommand('strikeThrough');
                  document.execCommand('foreColor', false, '#000000');
                  document.execCommand('fontName', false, 'sans-serif');
                  const span = document.createElement('span');
                  span.style.fontSize = '14px'; span.style.color = '#000000'; span.style.fontWeight = 'normal'; span.style.textDecoration = 'none'; span.style.fontFamily = 'sans-serif'; span.innerHTML = '&#8203;'; 
                  range.insertNode(span); range.setStart(span.firstChild!, 1); range.collapse(true);
                  selection.removeAllRanges(); selection.addRange(range);
              } else {
                  document.execCommand('removeFormat');
                  document.execCommand('fontSize', false, '7');
                  const fonts = editorRef.current.querySelectorAll('font[size="7"]');
                  fonts.forEach((f) => {
                      const el = f as HTMLElement; el.removeAttribute('size'); el.style.fontSize = '14px'; el.style.color = '#000000'; el.style.fontWeight = 'normal'; el.style.textDecoration = 'none'; el.style.fontFamily = 'sans-serif'; el.style.lineHeight = '1.2';
                  });
              }
              savedRangeRef.current = selection.getRangeAt(0).cloneRange();
          }
          if (isTableEditing) {
              const activeCells = selectedCells[primaryNode.id];
              setNodes(nds => nds.map(n => n.id === primaryNode.id ? {
                  ...n, data: { ...n.data, cells: { ...n.data.cells, [activeCells[0]]: { ...n.data.cells[activeCells[0]], content: editorRef.current!.innerHTML } } }
              } : n));
          } else {
              updateSelectedNodes({ content: editorRef.current.innerHTML });
          }
      } else {
          if (isTableEditing) {
              const activeCells = selectedCells[primaryNode.id];
              setNodes(nds => nds.map(n => {
                  if (n.id !== primaryNode.id) return n;
                  const newCells = { ...n.data.cells };
                  activeCells.forEach(cId => {
                      newCells[cId] = { ...newCells[cId], style: { border: newCells[cId]?.style?.border || '1px solid #ccc' } };
                  });
                  return { ...n, data: { ...n.data, cells: newCells } };
              }));
          } else {
              setNodes((nds: any[]) => nds.map((n: any) => {
                  if (!n.selected) return n;
                  const tempDiv = document.createElement('div'); tempDiv.innerHTML = n.data?.content || '';
                  tempDiv.querySelectorAll('*').forEach(el => {
                      const e = el as HTMLElement;
                      e.style.fontSize = ''; e.style.color = ''; e.style.fontFamily = ''; e.style.fontWeight = ''; e.style.textDecoration = '';
                      if (e.tagName==='FONT' || e.tagName==='B' || e.tagName==='STRONG' || e.tagName==='STRIKE') e.outerHTML = e.innerHTML;
                  });
                  return { ...n, data: { ...n.data, content: tempDiv.innerHTML }, style: { ...n.style, fontSize: '14px', color: '#000000', fontFamily: 'sans-serif', fontWeight: 'normal', textDecoration: 'none' } };
              }));
          }
      }
  };

  const handleLayout = (hAlign?: string, vAlign?: string) => {
      takeSnapshot();
      if (primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0) {
          const activeCells = selectedCells[primaryNode.id];
          setNodes(nds => nds.map(n => {
              if (n.id !== primaryNode.id) return n;
              const newCells = { ...n.data.cells };
              activeCells.forEach(cId => {
                  const cell = newCells[cId] || { content: '', style: {} };
                  let newStyle = { ...cell.style };
                  if (hAlign) newStyle.textAlign = hAlign;
                  if (vAlign) newStyle.verticalAlign = vAlign;
                  newCells[cId] = { ...cell, style: newStyle };
              });
              return { ...n, data: { ...n.data, cells: newCells } };
          }));
      } else {
          let styleUpdate: any = {};
          if (hAlign) {
              styleUpdate.textAlign = hAlign;
              styleUpdate.justifyContent = hAlign === 'left' ? 'flex-start' : hAlign === 'right' ? 'flex-end' : 'center';
          }
          if (vAlign) {
              styleUpdate.alignItems = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center';
          }
          updateSelectedNodes({}, styleUpdate);
      }
  };

  const applyTableBorder = () => {
      takeSnapshot();
      if (!primaryNode || !primaryNode.data.isTable) return;
      const activeCells = selectedCells[primaryNode.id] || [];
      if (activeCells.length === 0) return;
      setNodes(nds => nds.map(n => {
          if (n.id !== primaryNode.id) return n;
          const newCells = { ...n.data.cells };
          activeCells.forEach(cId => {
              newCells[cId] = {
                  ...newCells[cId],
                  style: { ...newCells[cId]?.style, border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` }
              };
          });
          return { ...n, data: { ...n.data, cells: newCells } };
      }));
  };

  const handleCopy = useCallback(() => {
    const selected = nodesRef.current.filter(n => n.selected);
    if (selected.length > 0) copiedNodesRef.current = safeCloneNodes(selected);
  }, []);

  const handlePaste = useCallback(() => {
    if (copiedNodesRef.current && copiedNodesRef.current.length > 0) {
        takeSnapshot();
        const newNodes = copiedNodesRef.current.map(original => {
            const newId = `node-${Date.now()}-${Math.random()}`;
            return {
                ...original, id: newId, selected: true,
                position: { x: original.position.x + 30, y: original.position.y + 30 },
                zIndex: Math.max(0, ...nodesRef.current.map(n => Number(n.zIndex) || 0)) + 1
            };
        });
        setNodes((nds: any[]) => [...nds.map((n: any) => ({...n, selected: false})), ...newNodes]);
    }
  }, [takeSnapshot]);

  const handleDuplicate = useCallback(() => {
      handleCopy(); setTimeout(handlePaste, 10);
  }, [handleCopy, handlePaste]);

  const enterLevel = useCallback((id: string, defaultLabel: string) => {
    setLevelData(prev => ({ 
        ...prev, 
        [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: prev[currentLevel]?.bgColor, label: currentLabelRef.current } 
    }));

    setNodes((nds: any[]) => {
      const target = nds.find((n: any) => n.id === id);
      if (target?.data?.isShape || target?.data?.isImage || target?.data?.isTable) return nds;
      
      setHistoryLevel(prev => [...prev, currentLevel]);
      setCurrentLevel(id); savedRangeRef.current = null; setSelectedCells({});
      
      const nextData = levelData[id] || { nodes: [], edges: [] };
      setCurrentLabel(nextData.label && nextData.label !== '階層中' ? nextData.label : defaultLabel || '階層中');
      
      setEdges((nextData.edges || []).map((e:any) => ({...e, selected: false})));
      setPast([]); setFuture([]);
      return (nextData.nodes || []).map((n:any) => ({...n, selected: false}));
    });
  }, [currentLevel, levelData]);

  const goBack = () => {
    if (historyLevel.length === 0) return;
    const newHist = [...historyLevel]; const prevLevel = newHist.pop()!;
    setLevelData(prev => ({ ...prev, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: prev[currentLevel]?.bgColor, label: currentLabelRef.current } }));
    setCurrentLevel(prevLevel); setHistoryLevel(newHist); savedRangeRef.current = null; setSelectedCells({});
    const prevData = levelData[prevLevel] || { nodes: [], edges: [] };
    setCurrentLabel(prevData.label || (prevLevel === 'root' ? 'TOP層' : '階層中'));
    setNodes((prevData.nodes || []).map((n:any) => ({...n, selected: false})));
    setEdges((prevData.edges || []).map((e:any) => ({...e, selected: false})));
    setPast([]); setFuture([]);
  };

  const goTop = () => {
    if (historyLevel.length === 0) return;
    setLevelData(prev => ({ ...prev, [currentLevel]: { nodes: safeCloneNodes(nodesRef.current), edges: safeCloneEdges(edgesRef.current), bgColor: prev[currentLevel]?.bgColor, label: currentLabelRef.current } }));
    setCurrentLevel('root'); setHistoryLevel([]); savedRangeRef.current = null; setSelectedCells({});
    const rootData = levelData['root'] || { nodes: [], edges: [] };
    setCurrentLabel(rootData.label || 'TOP層');
    setNodes((rootData.nodes || []).map((n:any) => ({...n, selected: false})));
    setEdges((rootData.edges || []).map((e:any) => ({...e, selected: false})));
    setPast([]); setFuture([]);
  };

  const addNode = useCallback((type: 'text' | 'image' | 'shape' | 'table') => {
    takeSnapshot();
    const id = `node-${Date.now()}`;
    
    // ★ 追加する図形の設定（デフォルトを左上に。パディングを2pxにして余白を削る）
    let data: any = { content: '項目', previewVisible: false, previewStyle: { opacity: 0.7, offsetX: 0, offsetY: -150, width: 180, height: 120 }, textOffsetX: 0, textOffsetY: 0 };
    let style: any = { backgroundColor: '#ffffff', color: '#000', borderRadius: '12px', fontSize: '14px', width: 200, height: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left', padding: '2px' };
    
    if (type === 'image') { fileInputRef.current?.click(); return; }
    
    if (type === 'shape') {
      data = { content: '', isShape: true, shapeType: 'rect', keepRatio: false, textOffsetX: 0, textOffsetY: 0 };
      style = { ...style, backgroundColor: '#eee', borderRadius: '4px', border: '3px solid #333' };
    }
    if (type === 'table') {
      data = { 
          isTable: true, rows: 2, cols: 2, textOffsetX: 0, textOffsetY: 0,
          cells: {
              "0-0": { content: "セル", style: { border: '1px solid #ccc' } }, "0-1": { content: "セル", style: { border: '1px solid #ccc' } },
              "1-0": { content: "セル", style: { border: '1px solid #333' } }, "1-1": { content: "セル", style: { border: '1px solid #333' } }
          } 
      };
      style = { ...style, width: 300, height: 150, padding: 0, backgroundColor: '#fff', display: 'block', borderRadius: '8px', border: '2px solid #ccc' };
    }

    const selNodes = nodesRef.current.filter(n => n.selected);
    const parent = selNodes.length === 1 ? selNodes[0] : null;

    if (parent && (type === 'text' || type === 'table')) {
        // 「接続の向き」設定を廃止したので、Enterキーでの追加は常に「下（縦）」に統一。
        const sourceHandle = 'bottom-src';
        const targetHandle = 'top-tgt';

        const edgeId = `e-${parent.id}-${id}`;
        setEdges((eds: any[]) => [...eds.map((e: any) => ({...e, selected:false})), { 
            id: edgeId, source: parent.id, target: id, sourceHandle, targetHandle, type: 'default', style: { strokeWidth: 2 } 
        }]);
        
        setNodes((nds: any[]) => {
            const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0));
            const parentW = Number(parent.style?.width || 200);
            const parentH = Number(parent.style?.height || 100);
            
            // 下方向に追加
            const newX = parent.position.x;
            const newY = parent.position.y + parentH + 80;

            const newNode = { id, selected: true, position: { x: newX, y: newY }, data, style, zIndex: maxZ + 1 };
            let updatedNodes = [...nds.map((n: any) => ({...n, selected: false})), newNode];

            const childIds = edgesRef.current.filter(e => e.source === parent.id).map(e => e.target).concat(id);
            const children = updatedNodes.filter(n => childIds.includes(n.id));
            
            if (children.length > 0) {
                const spacing = 240; 
                const totalSpan = (children.length - 1) * spacing;
                const startPos = (parent.position.x + parentW/2) - totalSpan / 2;
                
                children.forEach((child, index) => {
                    const childNode = updatedNodes.find(n => n.id === child.id);
                    if (childNode) {
                        const childW = Number(childNode.style?.width || 200);
                        childNode.position = { x: startPos + index * spacing - (childW / 2), y: newY };
                    }
                });
            }
            return updatedNodes;
        });
    } else {
        setNodes((nds: any[]) => {
            const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0));
            return [...nds.map((n: any) => ({...n, selected: false})), { id, selected: true, position: { x: 100, y: 100 }, data, style, zIndex: maxZ + 1 }];
        });
    }
  }, [takeSnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
      
      // ★ Tabキーで一発文字入力モードへ
      if (e.key === 'Tab' && !isEditing && selectedNodes.length === 1) {
          e.preventDefault();
          if (editorRef.current) {
              editorRef.current.focus();
              const sel = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(editorRef.current);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
          }
          return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleManualSave(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          if (e.shiftKey) { e.preventDefault(); redo(); } else { e.preventDefault(); undo(); } return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return; }

      if (isEditing) return;

      if (e.key === 'Enter') {
        e.preventDefault(); addNode('text');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault(); handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault(); handlePaste();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); takeSnapshot();
        const selIds = nodesRef.current.filter(n => n.selected).map(n => n.id);
        setNodes((nds: any[]) => nds.filter((n: any) => !n.selected));
        setEdges((eds: any[]) => eds.filter((e: any) => !e.selected && !selIds.includes(e.source) && !selIds.includes(e.target)));
        setSelectedCells({});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addNode, handleCopy, handlePaste, undo, redo, takeSnapshot, handleManualSave, selectedNodes.length]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const zoom = getZoom();
      const drag = previewDragRef.current;
      if (drag) {
        const dx = (e.clientX - drag.startX) / zoom; const dy = (e.clientY - drag.startY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        setNodes((nds: any[]) => nds.map((n: any) => n.id === drag.id ? { ...n, data: { ...(n.data || {}), previewStyle: { ...(n.data?.previewStyle || {}), offsetX: drag.initX + dx, offsetY: drag.initY + dy } } } : n));
      }
      const imgDrag = imageCropDragRef.current;
      if (imgDrag) {
        const dx = (e.clientX - imgDrag.startX) / zoom; const dy = (e.clientY - imgDrag.startY) / zoom;
        setNodes((nds: any[]) => nds.map((n: any) => n.id === imgDrag.id ? { ...n, data: { ...(n.data || {}), imgPosX: imgDrag.initX + dx, imgPosY: imgDrag.initY + dy } } : n));
      }
    };
    const onMouseUp = () => { setTimeout(() => { previewDragRef.current = null; }, 50); imageCropDragRef.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [getZoom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        takeSnapshot();
        setNodes((nds: any[]) => {
          const maxZ = Math.max(0, ...nds.map((n: any) => Number(n.zIndex) || 0));
          return [...nds.map((n: any) => ({...n, selected: false})), { 
            id: `img-${Date.now()}`, position: { x: 50, y: 50 }, zIndex: maxZ + 1, selected: true,
            data: { isImage: true, imageUrl: ev.target?.result, imgPosX: 0, imgPosY: 0, imgZoom: 1, isCropping: false, cropBaseW: 300, cropBaseH: 200, cropOffsetX: 0, cropOffsetY: 0, textOffsetX: 0, textOffsetY: 0 }, 
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
      if (t.id === node.id || t.id === 'center-mark' || t.selected) return;
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
    takeSnapshot();
    setNodes((nds: any[]) => nds.map((n: any) => n.id === node.id ? { ...n, position: node.position } : n));
    setGuides({});
  }, [takeSnapshot]);

  const flowNodes = useMemo(() => {
    const centerNode: any = { 
      id: 'center-mark', type: 'default', position: { x: -10, y: -10 }, draggable: false, selectable: false, 
      data: { label: '＋' }, 
      style: { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '14px', fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', border: '2px solid #ef4444', zIndex: -1000, pointerEvents: 'none', padding: 0 } 
    };

    return [centerNode, ...nodes.map(n => {
      const isPreview = Boolean(n.data?.previewVisible && !n.data?.isShape && !n.data?.isImage && !n.data?.isTable);
      let previewElement: React.ReactNode = null;
      
      const textOffX = Number(n.data?.textOffsetX || 0);
      const textOffY = Number(n.data?.textOffsetY || 0);

      if (isPreview) {
        const w1 = Number(n.style?.width) || 200; const h1 = Number(n.style?.height) || 100;
        const cx1 = w1 / 2; const cy1 = h1 / 2;
        const offsetX = Number(n.data?.previewStyle?.offsetX) || 0; const offsetY = Number(n.data?.previewStyle?.offsetY) || -180;
        const w2 = Number(n.data?.previewStyle?.width) || 180; const h2 = Number(n.data?.previewStyle?.height) || 120;
        const cx2 = offsetX + w2 / 2; const cy2 = offsetY + h2 / 2;
        const p1 = getEdgePoint(cx1, cy1, w1, h1, cx2, cy2); const p2 = getEdgePoint(cx2, cy2, w2, h2, cx1, cy1);

        previewElement = (
          <React.Fragment>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: -2 }}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#999" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            <div className="nodrag"
              onMouseDown={(e) => { e.stopPropagation(); takeSnapshot(); previewDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: offsetX, initY: offsetY, moved: false }; }}
              onClick={(e) => { e.stopPropagation(); if (!previewDragRef.current?.moved) enterLevel(n.id, extractFirstLineText(n.data?.content)); }}
              style={{ position:'absolute', left: offsetX, top: offsetY, width: `${w2}px`, height: `${h2}px`, backgroundColor:`rgba(255,255,255,${n.data?.previewStyle?.opacity || 0.7})`, borderRadius: '12px', border: '1px solid #ccc', zIndex: -1, cursor: 'grab', overflow: 'hidden', boxShadow: '0 8px 12px rgba(0,0,0,0.1)' }}
            >
              {levelData[n.id]?.nodes?.length ? (
                <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '1200px', height: '800px', position: 'relative', pointerEvents: 'none' }}>
                  {levelData[n.id].nodes.map((cn: any) => cn.id !== 'center-mark' ? (
                    <div key={cn.id} style={{ position: 'absolute', left: cn.position.x, top: cn.position.y, width: cn.style?.width || 200, height: cn.style?.height || 100, backgroundColor: cn.style?.backgroundColor || '#fff', border: cn.style?.border || '4px solid #333', borderRadius: cn.style?.borderRadius || '12px', display: 'flex', alignItems: cn.style?.alignItems || 'center', justifyContent: cn.style?.justifyContent || 'center', fontSize: '32px', color: cn.style?.color || '#000', overflow: 'hidden' }}>
                      {cn.data?.isImage ? <img src={cn.data.imageUrl as string} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="mini" /> : cn.data?.isShape ? null : <div className="html-content" style={{padding:'15px', width:'100%', fontWeight: cn.style?.fontWeight || 'normal', textAlign: cn.style?.textAlign || 'center', color: cn.style?.color || '#000', fontFamily: cn.style?.fontFamily || 'sans-serif', fontSize: cn.style?.fontSize || '14px', textDecoration: cn.style?.textDecoration || 'none'}} dangerouslySetInnerHTML={{ __html: renderHTMLWithMath(cn.data?.content) }} />}
                    </div>
                  ) : null)}
                </div>
              ) : <div style={{fontSize: '11px', color: '#999', textAlign: 'center', paddingTop: '40px', pointerEvents: 'none'}}>中身<br/>(クリックで入る)</div>}
            </div>
          </React.Fragment>
        );
      } else if (n.data?.isTable) {
        previewElement = (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="custom-drag-handle" style={{ height: '14px', background: '#e2e8f0', cursor: 'grab', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}></div>
                <div className="nodrag" style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
                    <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <tbody>
                            {Array.from({length: n.data.rows || 2}).map((_, r) => (
                                <tr key={r}>
                                    {Array.from({length: n.data.cols || 2}).map((_, c) => {
                                        const cellId = `${r}-${c}`;
                                        const cellData = n.data.cells?.[cellId] || { content: '', style: { border: '1px solid #ccc' } };
                                        const isSel = selectedCells[n.id]?.includes(cellId);
                                        return (
                                            <td
                                                key={c}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedCells(prev => {
                                                        const current = prev[n.id] || [];
                                                        if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                                            return { ...prev, [n.id]: current.includes(cellId) ? current.filter(id => id !== cellId) : [...current, cellId] };
                                                        } else {
                                                            return { ...prev, [n.id]: [cellId] };
                                                        }
                                                    });
                                                    if (!n.selected) setNodes((nds: any[]) => nds.map((node: any) => node.id === n.id ? { ...node, selected: true } : { ...node, selected: false }));
                                                }}
                                                style={{
                                                    ...cellData.style,
                                                    position: 'relative', cursor: 'cell', padding: '8px', wordBreak: 'break-all',
                                                    outline: isSel ? '2px solid #3b82f6' : 'none', outlineOffset: '-2px'
                                                }}
                                            >
                                                <div className="html-content" dangerouslySetInnerHTML={{ __html: renderHTMLWithMath(cellData.content) }} />
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

      const baseW = n.data?.cropBaseW ?? (Number(n.style?.width) || 300);
      const baseH = n.data?.cropBaseH ?? (Number(n.style?.height) || 200);
      const offX = n.data?.cropOffsetX || 0;
      const offY = n.data?.cropOffsetY || 0;

      return {
        ...n,
        draggable: n.data?.isImage && n.data?.isCropping ? false : true,
        data: {
          ...n.data,
          label: (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: n.style?.alignItems || 'flex-start', justifyContent: n.style?.justifyContent || 'flex-start', position: 'relative' }}>
              
              {/* ★ 全方位に「透明な受信用の的(Target)」と「小さな黒い点(Source)」を配置！これでどこからでも自由に繋げます */}
              {n.id !== 'center-mark' && (
                <>
                  <Handle type="target" position={Position.Top} id="top-tgt" className="custom-handle-target" />
                  <Handle type="target" position={Position.Bottom} id="bottom-tgt" className="custom-handle-target" />
                  <Handle type="target" position={Position.Left} id="left-tgt" className="custom-handle-target" />
                  <Handle type="target" position={Position.Right} id="right-tgt" className="custom-handle-target" />

                  <Handle type="source" position={Position.Left} id="left-src" className="custom-handle" />
                  <Handle type="source" position={Position.Right} id="right-src" className="custom-handle" />
                  <Handle type="source" position={Position.Top} id="top-src" className="custom-handle" />
                  <Handle type="source" position={Position.Bottom} id="bottom-src" className="custom-handle" />
                </>
              )}

              {previewElement}
              
              {n.data?.isImage ? (
                <div 
                  className={n.data?.isCropping ? "nodrag" : ""}
                  onMouseDown={(e) => {
                     if (n.data?.isCropping) {
                        e.stopPropagation(); takeSnapshot();
                        imageCropDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: Number(n.data?.imgPosX || 0), initY: Number(n.data?.imgPosY || 0) };
                     }
                  }}
                  style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', borderRadius: n.style?.borderRadius || 0, cursor: n.data?.isCropping ? 'move' : 'default' }}
                >
                  <img src={n.data.imageUrl as string} style={{ 
                      position: 'absolute', width: n.data?.isCropping ? `${baseW}px` : '100%', height: n.data?.isCropping ? `${baseH}px` : '100%', 
                      maxWidth: 'none', maxHeight: 'none', left: n.data?.isCropping ? `${offX}px` : 0, top: n.data?.isCropping ? `${offY}px` : 0,
                      transform: `translate(${n.data.imgPosX || 0}px, ${n.data.imgPosY || 0}px) scale(${n.data.imgZoom || 1})`, transformOrigin: 'center center', pointerEvents: 'none' 
                  }} alt="img" />
                  {/* 画像のテキスト */}
                  <div className="html-content" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: n.style?.alignItems || 'flex-start', justifyContent: n.style?.justifyContent || 'flex-start', pointerEvents: 'none', color: n.style?.color || '#000', fontFamily: n.style?.fontFamily || 'sans-serif', fontSize: n.style?.fontSize || '14px', fontWeight: n.style?.fontWeight || 'normal', textDecoration: n.style?.textDecoration || 'none', whiteSpace: 'pre-wrap', lineHeight: '1.2', textAlign: n.style?.textAlign || 'left', padding: n.style?.padding || '2px', transform: `translate(${textOffX}px, ${textOffY}px)` }} dangerouslySetInnerHTML={{ __html: renderHTMLWithMath(n.data?.content) }} />
                </div>
              ) : n.id !== 'center-mark' && !n.data?.isTable ? (
                // ★ 通常テキスト・図形のテキスト (パディングを削り、textOffsetで位置を微調整できるようにしました)
                <div className="html-content" style={{ pointerEvents: 'none', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: n.style?.justifyContent || 'flex-start', color: n.style?.color || '#000', fontFamily: n.style?.fontFamily || 'sans-serif', fontSize: n.style?.fontSize || '14px', fontWeight: n.style?.fontWeight || 'normal', textDecoration: n.style?.textDecoration || 'none', whiteSpace: 'pre-wrap', lineHeight: '1.2', textAlign: n.style?.textAlign || 'left', padding: n.style?.padding || '2px', transform: `translate(${textOffX}px, ${textOffY}px)` }} dangerouslySetInnerHTML={{ __html: renderHTMLWithMath(n.data?.content) }} />
              ) : null}

              {n.id !== 'center-mark' ? (
                 <NodeResizer 
                    minWidth={30} minHeight={30} keepAspectRatio={!!n.data?.keepRatio} 
                    isVisible={n.selected} 
                    lineStyle={{ border: n.data?.isCropping ? '2px dashed #ef4444' : '1px solid #3b82f6', zIndex: 100 }} 
                    handleStyle={{ background: n.data?.isCropping ? '#ef4444' : '#3b82f6', zIndex: 100, borderRadius: '50%' }} 
                    onResizeStart={(_, params) => {
                        takeSnapshot();
                        if (n.data?.isImage && n.data?.isCropping) { n.data._rsX = params.x; n.data._rsY = params.y; n.data._rsCropOffX = n.data.cropOffsetX || 0; n.data._rsCropOffY = n.data.cropOffsetY || 0; }
                    }}
                    onResize={(_, params) => {
                        if (n.data?.isImage && n.data?.isCropping) {
                            const dx = params.x - n.data._rsX; const dy = params.y - n.data._rsY;
                            setNodes((nds: any[]) => nds.map((node: any) => node.id === n.id ? {
                                ...node, data: { ...node.data, cropOffsetX: n.data._rsCropOffX - dx, cropOffsetY: n.data._rsCropOffY - dy }
                            } : node));
                        }
                    }}
                 />
              ) : null}
            </div>
          )
        }
      };
    })];
  }, [nodes, enterLevel, levelData, takeSnapshot, selectedCells]);

  const updateEdgeDesign = (config: any) => {
    takeSnapshot();
    setEdges((eds: any[]) => eds.map((e: any) => {
      if (!e.selected) return e;
      const mSize = Math.max(8, (Number(e.style?.strokeWidth) || 2) * 1.5);
      const m = { type: MarkerType.ArrowClosed, color: '#333', width: mSize, height: mSize };
      return { ...e, data: { ...(e.data || {}), double: config.double }, markerEnd: config.arrow || config.both ? m : undefined, markerStart: config.both ? m : undefined, label: config.label !== undefined ? config.label : e.label };
    }));
  };

  const isRoot = historyLevel.length === 0;
  const actionBtnStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px', transition: 'all 0.2s', whiteSpace: 'nowrap' };
  const primaryBtnStyle = { ...actionBtnStyle, backgroundColor: '#3b82f6', color: '#fff', border: 'none', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' };

  const editorPanelStyle = isExpandedEditor ? {
      position: 'fixed' as const, top: '20px', right: '20px', width: '450px', maxHeight: '90vh', backgroundColor: '#fff', zIndex: 10000,
      padding: '20px', borderRadius: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', overflowY: 'auto' as const, border: '2px solid #3b82f6'
  } : { marginTop: '10px' };

  const addTableRowCol = (type: 'row' | 'col') => {
      takeSnapshot();
      if (!primaryNode || !primaryNode.data.isTable) return;
      setNodes(nds => nds.map(n => {
          if (n.id !== primaryNode.id) return n;
          const newRows = type === 'row' ? n.data.rows + 1 : n.data.rows;
          const newCols = type === 'col' ? n.data.cols + 1 : n.data.cols;
          const newCells = { ...n.data.cells };
          if (type === 'row') for(let c=0; c<newCols; c++) newCells[`${newRows-1}-${c}`] = { content: '', style: { border: '1px solid #ccc'} };
          if (type === 'col') for(let r=0; r<newRows; r++) newCells[`${r}-${newCols-1}`] = { content: '', style: { border: '1px solid #ccc'} };
          return { ...n, data: { ...n.data, rows: newRows, cols: newCols, cells: newCells } };
      }));
  };

  const isTableEditing = primaryNode?.data?.isTable && (selectedCells[primaryNode.id]?.length || 0) > 0;
  
  useEffect(() => {
    if (editorRef.current) {
        if (primaryNode && !primaryNode.data?.isTable) {
            if (editorRef.current.innerHTML !== (primaryNode.data.content || '')) {
                editorRef.current.innerHTML = primaryNode.data.content || '';
            }
        } else if (!primaryNode) {
            editorRef.current.innerHTML = '';
        }
    }
  }, [primaryNode?.id, primaryNode?.data?.content, primaryNode?.data?.isTable]);

  useEffect(() => {
      if (editorRef.current && primaryNode?.data?.isTable) {
          const activeCells = selectedCells[primaryNode.id] || [];
          if (activeCells.length === 1) {
              const cellContent = primaryNode.data.cells[activeCells[0]]?.content || '';
              if (editorRef.current.innerHTML !== cellContent) editorRef.current.innerHTML = cellContent;
          } else if (activeCells.length > 1) {
              editorRef.current.innerHTML = '<span style="color:#999">複数セル選択中 (※入力すると全セル上書きされます)</span>';
          } else {
              editorRef.current.innerHTML = '';
          }
      }
  }, [primaryNode?.id, primaryNode?.data?.isTable, selectedCells, primaryNode?.data?.cells]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <style>{`
        .html-content p { margin: 0; }
        .html-content strike, #node-editor strike { text-decoration: line-through double !important; }
        .html-content *, #node-editor * { line-height: 1.2 !important; vertical-align: baseline !important; }
        #node-editor:empty:before { content: "テキストを入力..."; color: #aaa; pointer-events: none; }
        
        /* 印刷時に消す要素 */
        @media print {
            .no-print { display: none !important; }
            .react-flow__background { background-color: #fff !important; }
        }

        /* ★ ハンドル（黒い点）を6pxの極小にし、近づいた時(hover)に大きくするように修正 */
        .custom-handle { width: 6px !important; height: 6px !important; background: #333 !important; border: 1px solid #fff !important; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important; box-shadow: 0 1px 2px rgba(0,0,0,0.2) !important; cursor: crosshair !important; z-index: 10 !important; }
        .custom-handle::after { content: ""; position: absolute; top: -12px; left: -12px; right: -12px; bottom: -12px; background: transparent; }
        .custom-handle:hover { transform: scale(2.5) !important; background: #3b82f6 !important; border-color: #fff !important; }

        /* 透明なターゲット(受信用)ハンドル。線をピタッと吸い付ける磁石の役割 */
        .custom-handle-target { width: 30px !important; height: 30px !important; background: transparent !important; border: none !important; z-index: 1 !important; cursor: crosshair !important; pointer-events: auto !important; }
      `}</style>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
      
      {isExpandedEditor && (
          <div className="no-print" onClick={() => setIsExpandedEditor(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 990, cursor: 'pointer' }} />
      )}

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

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: levelData[currentLevel]?.bgColor || '#ffffff', transition: 'background-color 0.3s', position: 'relative' }}>
        
        {/* 上部バー（折りたたみ可能） */}
        {isTopBarOpen ? (
          <div className="no-print" style={{ padding: '8px 15px', backgroundColor: 'rgba(255,255,255,0.9)', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', marginRight: '15px', padding: '0 5px' }}>☰</button>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '14px' }}>
              階層: 
              <input 
                type="text" 
                value={currentLabel} 
                onChange={(e) => setCurrentLabel(e.target.value)} 
                style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333', textAlign: 'center', border: 'none', borderBottom: '1px dashed #999', background: 'transparent', outline: 'none', minWidth: '150px' }} 
              />
            </div>
            {/* 上部バーを隠すボタン */}
            <button onClick={() => setIsTopBarOpen(false)} style={{ padding: '4px 8px', fontSize: '10px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>▲ 隠す</button>
          </div>
        ) : (
          <button className="no-print" onClick={() => setIsTopBarOpen(true)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 100, padding: '4px 8px', fontSize: '10px', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>▼ 階層メニューを表示</button>
        )}

        <div style={{ flexGrow: 1, position: 'relative' }}>
          <ReactFlow 
             connectionMode={ConnectionMode.Loose}
             nodes={flowNodes} edges={edges} edgeTypes={edgeTypes} elevateNodesOnSelect={false} multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
             onNodesChange={u => setNodes((nds: any[]) => applyNodeChanges(u, nds))} 
             onEdgesChange={u => setEdges((eds: any[]) => applyEdgeChanges(u, eds))} 
             onConnect={p => { takeSnapshot(); setEdges((eds: any[]) => addEdge({...p, type:'default', style: {strokeWidth: 2}}, eds)); }} 
             onNodeDragStart={() => takeSnapshot()}
             onNodeDoubleClick={(_, n) => {
                enterLevel(n.id, extractFirstLineText(n.data?.content));
             }} 
             onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop} fitView
          >
            <Background color="#f1f1f1" className="no-print" /><Controls className="no-print" /><SmartGuides guides={guides} />
          </ReactFlow>
          
          {selectedNodes.length > 0 && primaryNode && (
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
                                  <option value="1px">細線</option>
                                  <option value="2px">中線</option>
                                  <option value="4px">太線</option>
                                  <option value="0px">線なし</option>
                              </select>
                              <select value={tableBorderStyle} onChange={(e) => setTableBorderStyle(e.target.value)} style={{ padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>
                                  <option value="solid">単線</option>
                                  <option value="dashed">破線</option>
                                  <option value="dotted">点線</option>
                                  <option value="double">二重線</option>
                              </select>
                              <input type="color" value={tableBorderColor} onChange={(e) => setTableBorderColor(e.target.value)} style={{ width: '100%', height: '24px', border: 'none', cursor: 'pointer', background: 'transparent' }} />
                              <button onClick={applyTableBorder} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>適用</button>
                          </div>
                      ) : (
                          <p style={{fontSize: '10px', color: '#666', marginTop: '5px'}}>※表の中のセルをクリックして選択してください<br/>(Shiftキーで複数選択)</p>
                      )}
                  </div>
              )}

              {primaryNode.data?.isImage && selectedNodes.length === 1 && (
                <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <button onClick={() => { takeSnapshot(); const w = Number(primaryNode.style?.width) || 300; const h = Number(primaryNode.style?.height) || 200;
                        if (!primaryNode.data?.isCropping) updateSelectedNodes({ isCropping: true, cropBaseW: w, cropBaseH: h, cropOffsetX: 0, cropOffsetY: 0 });
                        else updateSelectedNodes({ isCropping: false });
                     }} 
                     style={{ width: '100%', padding: '8px', fontSize: '12px', background: primaryNode.data?.isCropping ? '#ef4444' : '#fff', color: primaryNode.data?.isCropping ? '#fff' : '#333', border: primaryNode.data?.isCropping ? 'none' : '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '15px' }}
                  >
                     {primaryNode.data?.isCropping ? '✅ トリミング完了' : '✂️ トリミング'}
                  </button>

                  {primaryNode.data?.isCropping ? (
                     <div style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '10px', border: '1px dashed #fca5a5' }}><p style={{fontSize: '10px', color: '#b91c1c', margin: 0}}><strong>トリミングモード中</strong><br/>・画像の周囲の<span style={{color:'red'}}>赤い枠</span>を動かして切り取れます。<br/>・画像を直接ドラッグして位置を調整できます。</p></div>
                  ) : (
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

              <div style={editorPanelStyle}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                      <label style={{fontSize: '11px', fontWeight: 'bold'}}>{primaryNode.data?.isTable ? (isTableEditing ? '選択セルの文字内容' : '文字内容 (※セルを選択してください)') : '文字内容 (Tabキーで即入力)'}</label>
                      <button onClick={() => setIsExpandedEditor(!isExpandedEditor)} style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #3b82f6', background: isExpandedEditor ? '#3b82f6' : '#eff6ff', color: isExpandedEditor ? '#fff' : '#3b82f6', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                          {isExpandedEditor ? '↙️ パネルを戻す' : '↗️ 大きく開く'}
                      </button>
                  </div>

                  <div 
                    id="node-editor" 
                    ref={editorRef}
                    contentEditable={!primaryNode.data?.isTable || isTableEditing}
                    onInput={(e) => { 
                        if (isTableEditing) {
                            const activeCells = selectedCells[primaryNode.id];
                            setNodes(nds => nds.map(n => n.id === primaryNode.id ? { ...n, data: { ...n.data, cells: { ...n.data.cells, [activeCells[0]]: { ...n.data.cells[activeCells[0]], content: e.currentTarget.innerHTML } } } } : n));
                        } else {
                            updateSelectedNodes({ content: e.currentTarget.innerHTML }); 
                        }
                        saveSelection(); 
                    }}
                    onBlur={(e) => { 
                        if (!isTableEditing) updateSelectedNodes({ content: e.currentTarget.innerHTML }); 
                        saveSelection(); 
                    }}
                    onKeyUp={saveSelection}
                    onMouseUp={saveSelection}
                    style={{ width:'100%', minHeight: isExpandedEditor ? '200px' : '60px', marginBottom: '10px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none', backgroundColor: (!primaryNode.data?.isTable || isTableEditing) ? '#fff' : '#f1f5f9', cursor: 'text', overflowY: 'auto', fontSize: isExpandedEditor ? '16px' : '13px' }}
                  />
                  
                  <label style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>文字装飾</label>
                  
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'5px', marginTop: '5px' }}>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('fontName', 'serif')} style={{cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px'}}>明朝</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('fontName', 'sans-serif')} style={{cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px'}}>ゴシック</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('bold')} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px', background: '#fff' }}>太字</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('strikeThrough')} style={{ cursor:'pointer', border:'1px solid #ccc', padding: '6px', fontSize:'12px', borderRadius: '4px', background: '#fff' }}>二重線</button>
                  </div>

                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', marginBottom: '15px' }}>
                    {QUICK_TEXT_COLORS.map(c => <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => applyUnifiedFormat('foreColor', c)} style={{ width:'24px', height:'24px', backgroundColor:c, border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }} />)}
                    <input type="color" onChange={(e) => applyUnifiedFormat('foreColor', e.target.value)} style={{width:'24px', height:'24px', cursor: 'pointer', border: 'none', padding: 0}} />
                  </div>

                  <label style={{fontSize:'10px', fontWeight: 'bold'}}>文字サイズ (px)</label>
                  <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom: '15px'}}>
                    <input type="range" min="1" max="100" value={partialFontSize} onChange={(e) => { const val = Number(e.target.value); setPartialFontSize(val); applyUnifiedFormat('fontSize', `${val}px`); }} style={{flex:1}} />
                    <input type="number" min="1" max="100" value={partialFontSize} onChange={(e) => { const val = Number(e.target.value); setPartialFontSize(val); applyUnifiedFormat('fontSize', `${val}px`); }} style={{width:'40px', padding:'2px', fontSize:'11px', border:'1px solid #ccc', borderRadius:'4px'}} />
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
              <div style={{ display:'flex', gap:'5px', marginBottom:'15px' }}>
                <button onClick={() => handleLayout(undefined, 'flex-start')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>上</button>
                <button onClick={() => handleLayout(undefined, 'center')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>中</button>
                <button onClick={() => handleLayout(undefined, 'flex-end')} style={{flex:1, cursor:'pointer', border:'1px solid #ccc', padding: '4px', fontSize:'11px', borderRadius: '4px'}}>下</button>
              </div>

              {/* ★ 新機能：文字の微調整スライダー（X / Y） */}
              {!primaryNode.data?.isTable && (
                  <div style={{ marginBottom: '15px' }}>
                      <label style={{fontSize: '10px', fontWeight: 'bold'}}>文字位置の微調整 (X / Y)</label>
                      <input type="range" min="-100" max="100" value={Number(primaryNode.data?.textOffsetX || 0)} onChange={(e) => updateSelectedNodes({ textOffsetX: parseInt(e.target.value) })} style={{width:'100%', marginBottom: '5px'}} />
                      <input type="range" min="-100" max="100" value={Number(primaryNode.data?.textOffsetY || 0)} onChange={(e) => updateSelectedNodes({ textOffsetY: parseInt(e.target.value) })} style={{width:'100%'}} />
                  </div>
              )}

              <label style={{fontSize:'10px', fontWeight: 'bold'}}>全体の透明度</label>
              <input type="range" min="0.1" max="1" step="0.1" value={Number(primaryNode.style?.opacity ?? 1)} onChange={(e) => { takeSnapshot(); updateSelectedNodes({}, { opacity: parseFloat(e.target.value) })}} style={{width:'100%', marginBottom:'10px'}} />

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

              {/* ★ 新機能：線の中に文字を入力 */}
              <label style={{fontSize:'11px', fontWeight: 'bold'}}>線の文字</label>
              <input type="text" value={selectedEdge.label || ''} onChange={(e) => updateEdgeDesign({ label: e.target.value })} style={{width:'100%', padding:'6px', border:'1px solid #ccc', borderRadius:'4px', marginBottom:'15px', fontSize:'12px'}} placeholder="線に文字を入れる..." />

              {/* ★ 新機能：YES / NO 線のワンタッチ追加 */}
              <label style={{fontSize:'11px', fontWeight: 'bold'}}>文字入り線 (クイック)</label>
              <div style={{ display:'flex', gap:'5px', marginTop: '5px', marginBottom: '20px' }}>
                <button onClick={() => updateEdgeDesign({ label: 'YES' })} style={{flex:1, padding:'6px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'}}>YES 線</button>
                <button onClick={() => updateEdgeDesign({ label: 'NO' })} style={{flex:1, padding:'6px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'}}>NO 線</button>
              </div>

              <label style={{fontSize:'11px', fontWeight: 'bold'}}>太さ</label>
              <div style={{ display:'flex', gap:'5px', marginBottom:'20px', marginTop: '5px' }}>
                {[2, 6, 12].map(w => <button key={w} onClick={() => { takeSnapshot(); setEdges((eds: any[]) => eds.map((e: any) => e.selected ? { ...e, style: { ...e.style, strokeWidth: w } } : e)); }} style={{flex:1, padding:'6px', fontSize:'12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: selectedEdge.style?.strokeWidth === w ? '#ddd' : '#fff'}}>{w === 2 ? '細' : w === 6 ? '中' : '太'}</button>)}
              </div>
              <label style={{fontSize:'11px', fontWeight: 'bold'}}>種類 (7種)</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginTop: '5px' }}>
                {[{l:'普通',c:{}},{l:'片矢印 (→)',c:{arrow:true}},{l:'二重片矢印 (⇒)',c:{double:true,arrow:true}},{l:'両矢印 (↔)',c:{both:true}},{l:'二重両矢印 (⇔)',c:{double:true,both:true}},{l:'論理和 (∧)',c:{label:'∧'}},{l:'論理積 (∨)',c:{label:'∨'}}].map(item => (
                  <button key={item.l} onClick={() => updateEdgeDesign(item.c)} style={{padding:'8px', fontSize:'12px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', fontWeight: 'bold'}}>{item.l}</button>
                ))}
              </div>
              <button onClick={() => { takeSnapshot(); setEdges((eds: any[]) => eds.filter((e: any) => !e.selected)); }} style={{ width:'100%', marginTop:'30px', color: 'red', fontSize:'12px', border: '1px solid red', background: '#fffcfc', padding: '8px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '8px' }}>線を削除</button>
            </div>
          )}
        </div>

        {isBottomBarOpen ? (
          <div className="no-print" style={{ padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.95)', borderTop: '1px solid #eee', display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', justifyContent: 'center', alignItems: 'center', gap: '6px', zIndex: 1001, boxShadow: '0 -4px 10px rgba(0,0,0,0.03)', backdropFilter: 'blur(4px)' }}>
            <button onClick={undo} disabled={past.length === 0} style={{ ...actionBtnStyle, opacity: past.length === 0 ? 0.4 : 1, cursor: past.length === 0 ? 'default' : 'pointer' }}>↩️ 戻る</button>
            <button onClick={redo} disabled={future.length === 0} style={{ ...actionBtnStyle, opacity: future.length === 0 ? 0.4 : 1, cursor: future.length === 0 ? 'default' : 'pointer' }}>↪️ 進む</button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
            <button onClick={handleManualSave} style={{ ...primaryBtnStyle, backgroundColor: '#059669', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.3)' }}>💾 保存</button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
            <button onClick={goBack} disabled={isRoot} style={{ ...actionBtnStyle, opacity: isRoot ? 0.4 : 1, cursor: isRoot ? 'default' : 'pointer' }}>🔙 前へ</button>
            <button onClick={goTop} disabled={isRoot} style={{ ...actionBtnStyle, opacity: isRoot ? 0.4 : 1, cursor: isRoot ? 'default' : 'pointer' }}>🏠 TOP</button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
            <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 })} style={actionBtnStyle}>🎯 中央</button>
            <button onClick={() => window.print()} style={{ ...actionBtnStyle, backgroundColor: '#f1f5f9' }}>🖨️ 印刷</button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
            <button onClick={() => addNode('text')} style={primaryBtnStyle}>📝 テキスト</button>
            <button onClick={() => addNode('image')} style={{ ...primaryBtnStyle, backgroundColor: '#10b981', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>📸 画像</button>
            <button onClick={() => addNode('shape')} style={{ ...primaryBtnStyle, backgroundColor: '#f59e0b', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)' }}>🟦 図形</button>
            <button onClick={() => addNode('table')} style={{ ...primaryBtnStyle, backgroundColor: '#6366f1', boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)' }}>🧮 表</button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 2px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', color: '#555', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <span>🎨 背景</span>
              <input type="color" value={levelData[currentLevel]?.bgColor || '#ffffff'} onChange={(e) => {
                const newColor = e.target.value;
                setLevelData(prev => ({ ...prev, [currentLevel]: { ...(prev[currentLevel] || {}), bgColor: newColor } }));
              }} style={{width:'16px', height:'16px', cursor:'pointer', border: 'none', padding: 0, borderRadius: '4px'}} />
            </div>
            <button onClick={() => setIsBottomBarOpen(false)} style={{ padding: '4px 8px', marginLeft: 'auto', fontSize: '10px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>▼ 隠す</button>
          </div>
        ) : (
          <button className="no-print" onClick={() => setIsBottomBarOpen(true)} style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 100, padding: '4px 8px', fontSize: '10px', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#475569', boxShadow: '0 -2px 4px rgba(0,0,0,0.1)' }}>▲ ツールバーを表示</button>
        )}
      </div>
    </div>
  );
}

export default function App() { return (<ReactFlowProvider><FlowEditor /></ReactFlowProvider>); }
