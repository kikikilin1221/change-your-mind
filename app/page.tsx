'use client';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, 
  Node, Edge, OnNodesChange, OnEdgesChange, addEdge, Connection, 
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
  const isDouble = data?.double;
  const strokeWidth = Number(style.strokeWidth) || 2;
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} markerStart={markerStart} style={{ ...style, strokeWidth: isDouble ? strokeWidth + 4 : strokeWidth, stroke: '#333' }} />
      {isDouble && <BaseEdge path={edgePath} style={{ ...style, strokeWidth: strokeWidth, stroke: '#fff' }} />}
      {label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: 'white', padding: '2px 5px', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', pointerEvents: 'none', border: '1px solid #ccc', zIndex: 1000 }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// --- スマートガイド ---
function SmartGuides({ guides }: { guides: { lineX?: number, lineY?: number } }) {
  const transform = useStore((s) => s.transform);
  if (guides.lineX === undefined && guides.lineY === undefined) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {guides.lineX !== undefined && <div style={{ position: 'absolute', left: guides.lineX * transform[2] + transform[0], top: 0, width: '1px', height: '100%', backgroundColor: '#ef4444' }} />}
      {guides.lineY !== undefined && <div style={{ position: 'absolute', top: guides.lineY * transform[2] + transform[1], left: 0, height: '1px', width: '100%', backgroundColor: '#ef4444' }} />}
    </div>
  );
}

const edgeTypes = { default: DoubleEdge };
const PASTEL_COLORS = ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F3E5F5', '#E1F5FE', '#FFF9C4', '#FCE4EC', '#E8F5E9'];
const QUICK_TEXT_COLORS = ['#000000', '#FF0000', '#008000', '#0000FF', '#FFF000'];

function FlowEditor() {
  const { setViewport, getZoom } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<Record<string, any>>({});
  const [activeFileId, setActiveFileId] = useState<string>('default');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [levelData, setLevelData] = useState<Record<string, { nodes: Node[]; edges: Edge[]; bgColor?: string }>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [currentLevel, setCurrentLevel] = useState('root');
  const [currentLabel, setCurrentLabel] = useState('TOP層');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [guides, setGuides] = useState<{ lineX?: number, lineY?: number }>({});
  
  const previewDragRef = useRef<{ id: string, startX: number, startY: number, initX: number, initY: number, moved: boolean } | null>(null);
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  useEffect(() => {
    const saved = localStorage.getItem('my-logic-files');
    if (saved) {
      const parsed = JSON.parse(saved);
      setFiles(parsed);
      const lastId = localStorage.getItem('my-logic-active-id') || 'default';
      if (parsed[lastId]) loadFile(lastId, parsed);
    } else {
      const initial = { 'default': { name: '無題のノート', levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff' } }, currentLevel: 'root', currentLabel: 'TOP層' } };
      setFiles(initial); localStorage.setItem('my-logic-files', JSON.stringify(initial));
    }
  }, []);

  useEffect(() => {
    setLevelData(prev => ({ ...prev, [currentLevel]: { ...prev[currentLevel], nodes, edges } }));
  }, [nodes, edges, currentLevel]);

  useEffect(() => {
    if (!activeFileId || !files[activeFileId]) return;
    const updated = { ...files, [activeFileId]: { ...files[activeFileId], levelData: { ...levelData, [currentLevel]: { ...levelData[currentLevel], nodes, edges } }, currentLevel, currentLabel } };
    localStorage.setItem('my-logic-files', JSON.stringify(updated));
    localStorage.setItem('my-logic-active-id', activeFileId);
  }, [nodes, edges, currentLevel, currentLabel, levelData, activeFileId, files]);

  const loadFile = (id: string, allFiles = files) => {
    const t = allFiles[id]; if (!t) return;
    const loadedLevelData = t.levelData || { root: { nodes: [], edges: [], bgColor: '#ffffff' } };
    const initialLevel = t.currentLevel || 'root';
    setActiveFileId(id); setLevelData(loadedLevelData); setCurrentLevel(initialLevel); setCurrentLabel(t.currentLabel || 'TOP層');
    setNodes(loadedLevelData[initialLevel]?.nodes || []); setEdges(loadedLevelData[initialLevel]?.edges || []);
    setHistory([]); setSelectedNodeId(null);
  };

  const createNewFile = () => {
    const name = prompt("ファイル名", `ノート ${Object.keys(files).length + 1}`);
    if (!name) return;
    const newId = `file-${Date.now()}`;
    const newF = { name, levelData: { root: { nodes: [], edges: [], bgColor: '#ffffff' } }, currentLevel: 'root', currentLabel: 'TOP層' };
    setFiles(prev => ({ ...prev, [newId]: newF })); loadFile(newId, { ...files, [newId]: newF });
  };

  const updateNode = useCallback((newData: any, newStyle: any = {}) => {
    setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, data: { ...n.data, ...newData }, style: { ...n.style, ...newStyle } } : n));
  }, [selectedNodeId]);

  const enterLevel = useCallback((id: string, label: string) => {
    setNodes(nds => {
      const target = nds.find(n => n.id === id);
      if (target?.data.isShape || target?.data.isImage) return nds;
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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = previewDragRef.current;
      if (drag) {
        const zoom = getZoom();
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        setNodes(nds => nds.map(n => n.id === drag.id ? {
          ...n, data: { ...n.data, previewStyle: { ...n.data.previewStyle, offsetX: drag.initX + dx, offsetY: drag.initY + dy } }
        } : n));
      }
    };
    const onMouseUp = () => { setTimeout(() => { previewDragRef.current = null; }, 50); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [getZoom]);

  const onNodeDrag = useCallback((_: any, node: Node) => {
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

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, position: node.position } : n));
    setGuides({});
  }, []);

  const flowNodes = useMemo(() => {
    const centerNode = { 
      id: 'center-mark', type: 'default', position: { x: -10, y: -10 }, draggable: false, selectable: false, 
      data: { label: '＋' }, 
      style: { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '14px', fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', border: '2px solid #ef4444', zIndex: -1000, pointerEvents: 'none', padding: 0 } 
    };

    return [centerNode, ...nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        label: (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: n.style?.textAlign || 'center', position: 'relative' }}>
            {n.data.previewVisible && !n.data.isShape && !n.data.isImage && (() => {
              const w1 = Number(n.style?.width) || 200; const h1 = Number(n.style?.height) || 100;
              const cx1 = w1 / 2; const cy1 = h1 / 2;
              const offsetX = Number(n.data.previewStyle?.offsetX) || 0; const offsetY = Number(n.data.previewStyle?.offsetY) || -180;
              const w2 = Number(n.data.previewStyle?.width) || 180; const h2 = Number(n.data.previewStyle?.height) || 120;
              const cx2 = offsetX + w2 / 2; const cy2 = offsetY + h2 / 2;
              const p1 = getEdgePoint(cx1, cy1, w1, h1, cx2, cy2); const p2 = getEdgePoint(cx2, cy2, w2, h2, cx1, cy1);
              return (
                <>
                  <svg style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: -2 }}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#999" strokeWidth="2" strokeDasharray="4 2" />
                  </svg>
                  <div className="nodrag"
                    onMouseDown={(e) => { e.stopPropagation(); previewDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, initX: offsetX, initY: offsetY, moved: false }; }}
                    onClick={(e) => { e.stopPropagation(); if (!previewDragRef.current?.moved) enterLevel(n.id, String(n.data.content)); }}
                    style={{ position:'absolute', left: offsetX, top: offsetY, width: `${w2}px`, height: `${h2}px`, backgroundColor:`rgba(255,255,255,${n.data.previewStyle?.opacity || 0.7})`, borderRadius: '12px', border: '1px solid #ccc', zIndex: -1, cursor: 'grab', overflow: 'hidden' }}
                  >
                    {levelData[n.id]?.nodes?.length ? (
                      <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '1200px', height: '800px', position: 'relative' }}>
                        {levelData[n.id].nodes.map((cn: any) => cn.id !== 'center-mark' && (
                          <div key={cn.id} style={{ position: 'absolute', left: cn.position.x, top: cn.position.y, width: cn.style?.width || 200, height: cn.style?.height || 100, backgroundColor: cn.style?.backgroundColor || '#fff', border: cn.style?.border || '4px solid #333', borderRadius: cn.style?.borderRadius || '12px' }}></div>
                        ))}
                      </div>
                    ) : <div style={{fontSize: '11px', color: '#999', textAlign: 'center', paddingTop: '40px'}}>中身</div>}
                  </div>
                </>
              );
            })()}
            {n.data.isImage ? (
              <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                <img src={n.data.imageUrl} style={{ position: 'absolute', width: 'auto', height: 'auto', minWidth: '100%', minHeight: '100%', transform: `translate(${n.data.imgPosX || 0}px, ${n.data.imgPosY || 0}px) scale(${n.data.imgZoom || 1})`, transformOrigin: 'center center', pointerEvents: 'none' }} alt="img" />
              </div>
            ) : n.id !== 'center-mark' && (
              <div className="markdown-content" style={{ pointerEvents: 'none', width: '100%', color: n.style?.color || '#000', fontWeight: n.style?.fontWeight || 'normal', fontFamily: n.style?.fontFamily || 'sans-serif' }}>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{String(n.data.content || '').replace(/\n/g, '  \n')}</ReactMarkdown>
              </div>
            )}
            {n.id !== 'center-mark' && <NodeResizer minWidth={30} minHeight={30} keepAspectRatio={!!n.data.keepRatio} isVisible={selectedNodeId === n.id} lineStyle={{ border: '3px solid #3b82f6', zIndex: 100 }} handleStyle={{ background: '#3b82f6', border: '1px solid #fff', width: 12, height: 12, zIndex: 100 }} />}
          </div>
        )
      }
    }))];
  }, [nodes, selectedNodeId, enterLevel, levelData]);

  const updateEdgeDesign = (config: any) => {
    setEdges(eds => eds.map(e => {
      if (e.id !== selectedEdge?.id) return e;
      const mSize = Math.max(8, (Number(e.style?.strokeWidth) || 2) * 1.5);
      const m = { type: MarkerType.ArrowClosed, color: '#333', width: mSize, height: mSize };
      return { ...e, data: { ...e.data, double: config.double }, markerEnd: config.arrow || config.both ? m : undefined, markerStart: config.both ? m : undefined, label: config.label || '' };
    }));
  };

  const isRoot = history.length === 0;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row' }}>
      <style>{`.markdown-content p { margin: 0; }`}</style>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
      <div style={{ width: '220px', backgroundColor: '#f8f9fa', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', padding: '15px', zIndex: 10 }}>
        <h2>ファイル一覧</h2>
        <button onClick={createNewFile} style={{ padding: '8px', marginBottom: '20px', backgroundColor: '#fff', border: '1px solid #ddd', cursor: 'pointer' }}>＋ 新規ノート</button>
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {Object.entries(files).map(([id, f]: [string, any]) => (
            <div key={id} onClick={() => loadFile(id)} style={{ padding: '8px', marginBottom: '5px', borderRadius: '4px', cursor: 'pointer', backgroundColor: activeFileId === id ? '#e7f1ff' : 'transparent', fontSize: '13px' }}>
              {f.name} <span onClick={(e) => { e.stopPropagation(); deleteFile(id); }} style={{ float: 'right' }}>×</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: levelData[currentLevel]?.bgColor || '#ffffff' }}>
        <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.8)', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 'bold' }}>階層: {currentLabel}</div>
        <div style={{ flexGrow: 1, position: 'relative' }}>
          <ReactFlow nodes={flowNodes} edges={edges} edgeTypes={edgeTypes} elevateNodesOnSelect={false} onNodesChange={u => setNodes(nds => applyNodeChanges(u, nds))} onEdgesChange={u => setEdges(eds => applyEdgeChanges(u, eds))} onConnect={p => setEdges(eds => addEdge({...p, type:'default', style: {strokeWidth: 2}}, eds))} onNodeClick={(_, n) => { setSelectedNodeId(n.id !== 'center-mark' ? n.id : null); setSelectedEdge(null); }} onEdgeClick={(_, e) => { setSelectedEdge(e); setSelectedNodeId(null); }} onPaneClick={() => { setSelectedNodeId(null); setSelectedEdge(null); }} onNodeDoubleClick={(_, n) => enterLevel(n.id, String(n.data.content))} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop} fitView>
            <Background color="#f1f1f1" /><Controls /><SmartGuides guides={guides} />
          </ReactFlow>
          {selectedNode && (
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'340px', borderLeft:'1px solid #ddd', padding:'20px', backgroundColor:'#fff', zIndex:1000, overflowY: 'auto' }}>
              <button onClick={() => setSelectedNodeId(null)} style={{ float: 'right', border: 'none', background: 'none', fontSize: '20px' }}>×</button>
              <h3>{selectedNode.data.isImage ? '画像編集' : '項目設定'}</h3>
              <div style={{ display:'flex', gap:'5px', marginBottom:'15px' }}>
                <button onClick={() => setNodes(nds => { const maxZ = Math.max(0, ...nds.map(n => Number(n.zIndex) || 0)); return nds.map(n => n.id === selectedNodeId ? {...n, zIndex: maxZ + 1} : n); })}>最前面</button>
                <button onClick={() => setNodes(nds => { const minZ = Math.min(0, ...nds.map(n => Number(n.zIndex) || 0)); return nds.map(n => n.id === selectedNodeId ? {...n, zIndex: minZ - 1} : n); })}>最背面</button>
              </div>
              {!selectedNode.data.isImage && <textarea value={String(selectedNode.data.content || '')} onChange={(e) => updateNode({ content: e.target.value })} style={{ width:'100%', height:'100px' }} />}
              <div style={{ display:'flex', gap:'5px', margin:'10px 0' }}>
                <button onClick={() => updateNode({}, { textAlign: 'left' })}>左</button><button onClick={() => updateNode({}, { textAlign: 'center' })}>中</button><button onClick={() => updateNode({}, { textAlign: 'right' })}>右</button>
              </div>
              <input type="range" min="10" max="200" value={parseInt(String(selectedNode.style?.fontSize || 18))} onChange={(e) => updateNode({}, { fontSize: `${e.target.value}px` })} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                {PASTEL_COLORS.map(c => <button key={c} onClick={() => updateNode({}, { backgroundColor: c })} style={{ width:'25px', height:'25px', backgroundColor:c }} />)}
              </div>
              {!selectedNode.data.isShape && !selectedNode.data.isImage && (
                <button onClick={() => updateNode({ previewVisible: !selectedNode.data.previewVisible })} style={{ width:'100%', marginTop:'10px' }}>{selectedNode.data.previewVisible ? '吹き出し消去' : '吹き出し追加'}</button>
              )}
              <button onClick={() => setNodes(nds => nds.filter(n => n.id !== selectedNodeId))} style={{ color:'red', marginTop:'20px' }}>削除</button>
            </div>
          )}
          {selectedEdge && (
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'320px', borderLeft:'1px solid #ddd', padding:'20px', backgroundColor:'#fff', zIndex:1000 }}>
              <button onClick={() => setSelectedEdge(null)} style={{ float: 'right' }}>×</button>
              <h3>線デザイン</h3>
              <button onClick={() => updateEdgeDesign({ arrow: true })}>片矢印</button>
              <button onClick={() => updateEdgeDesign({ both: true })}>両矢印</button>
              <button onClick={() => setEdges(eds => eds.filter(e => e.id !== selectedEdge.id))}>削除</button>
            </div>
          )}
        </div>
        <div style={{ padding: '15px', backgroundColor: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center', gap: '15px', zIndex: 1001 }}>
          <button onClick={goBack} disabled={isRoot}>← 1つ前</button>
          <button onClick={goTop} disabled={isRoot}>TOP層へ</button>
          <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 })}>中央</button>
          <button onClick={() => addNode('text')}>＋ テキスト</button>
          <button onClick={() => addNode('image')}>📷 画像</button>
          <button onClick={() => addNode('shape')}>square 図形</button>
          <input type="color" value={levelData[currentLevel]?.bgColor || '#ffffff'} onChange={(e) => setLevelData(prev => ({ ...prev, [currentLevel]: { ...prev[currentLevel], bgColor: e.target.value } }))} />
        </div>
      </div>
    </div>
  );
}

export default function App() { return (<ReactFlowProvider><FlowEditor /></ReactFlowProvider>); }