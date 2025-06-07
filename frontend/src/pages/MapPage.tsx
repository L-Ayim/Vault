// src/pages/MapPage.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  type NodeDragHandler,
  type NodeProps,
  type Connection,
  type Node,
  type Edge,
} from "reactflow";
import { useQuery, useMutation } from "@apollo/client";
import {
  QUERY_MY_NODES,
  QUERY_MY_FILES,
  QUERY_NODE_FILES,
  MUTATION_CREATE_NODE,
  MUTATION_RENAME_NODE,
  MUTATION_DELETE_NODE,
  MUTATION_CREATE_EDGE,
  MUTATION_DELETE_EDGE,
  MUTATION_UPLOAD_FILE,
  MUTATION_ADD_FILE_TO_NODE,
  MUTATION_REMOVE_FILE_FROM_NODE,
  MUTATION_DELETE_FILE,
} from "../graphql/operations";
import {
  Plus,
  Minus,
  FileText,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import "reactflow/dist/style.css";
import { useAuth } from "../auth/AuthContext";

interface FileOnNode {
  note: string;
  addedAt: string;
  file: { id: string; name: string; uploadUrl: string };
}
interface EdgeOnNode {
  id: string;
  nodeA: { id: string; name: string };
  nodeB: { id: string; name: string };
  label: string | null;
  createdAt: string;
}
interface NodeData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  owner: { id: string; username: string };
  files: FileOnNode[];
  edges: EdgeOnNode[];
  shares: any[];
}
interface QueryMyNodesResult { myNodes: NodeData[] }
interface QueryMyFilesResult { myFiles: { id: string; name: string; downloadUrl: string }[] }

export default function MapPage() {
  // Page title & auth
  useEffect(() => { document.title = "Map"; }, []);
  const { user, logout } = useAuth();

  // Fetch nodes & files
  const { data: nodesData, loading: nodesLoading, error: nodesError } =
    useQuery<QueryMyNodesResult>(QUERY_MY_NODES, { fetchPolicy: "network-only" });
  const {
    data: filesData,
    loading: filesLoading,
    refetch: refetchFiles,
  } = useQuery<QueryMyFilesResult>(QUERY_MY_FILES);

  // Mutations
  const [uploadFile]    = useMutation(MUTATION_UPLOAD_FILE);
  const [addFileToNode] = useMutation(MUTATION_ADD_FILE_TO_NODE);
  const [removeNodeFile]= useMutation(MUTATION_REMOVE_FILE_FROM_NODE);
  const [deleteFile]    = useMutation(MUTATION_DELETE_FILE);
  const [createNode]    = useMutation(MUTATION_CREATE_NODE, {
    onCompleted: res => {
      const n = res.createNode.node;
      setNodes(nds => [
        ...nds,
        { id: n.id, type: "custom", position: { x:200,y:200 }, data:{ name:n.name, description:"", files:[] } }
      ]);
      savePosition(n.id,200,200);
    }
  });
  const [renameNode] = useMutation(MUTATION_RENAME_NODE);
  const [deleteNode] = useMutation(MUTATION_DELETE_NODE);
  const [createEdge] = useMutation(MUTATION_CREATE_EDGE);
  const [deleteEdge] = useMutation(MUTATION_DELETE_EDGE);

  // Sidebar upload/delete status
  const [sidebarUploading, setSidebarUploading] = useState(false);
  const [removingSidebarId, setRemovingSidebarId] = useState<string|null>(null);

  // Sidebar OS-drop handler
  const handleSidebarDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      setSidebarUploading(true);
      for (const file of files) {
        await uploadFile({ variables: { name: file.name, upload: file } });
      }
      await refetchFiles();
      setSidebarUploading(false);
    }
  }, [uploadFile, refetchFiles]);

  // Delete from storage
  const handleSidebarDelete = async (fileId: string) => {
    setRemovingSidebarId(fileId);
    await deleteFile({ variables: { fileId } });
    await refetchFiles();
    setRemovingSidebarId(null);
  };

  // Position helpers
  const getSavedPositions = (): Record<string,{x:number,y:number}> => {
    try { return JSON.parse(localStorage.getItem("node-positions")||"{}"); }
    catch { return {}; }
  };
  const savePosition = (id:string,x:number,y:number) => {
    const all = getSavedPositions(); all[id] = {x,y};
    localStorage.setItem("node-positions", JSON.stringify(all));
  };

  // Build ReactFlow nodes & edges
  const graphNodes: Node[] = useMemo(() => {
    if (!nodesData?.myNodes) return [];
    const saved = getSavedPositions();
    return nodesData.myNodes.map((n,idx) => {
      const defX = 50 + (idx%5)*200, defY = 50 + Math.floor(idx/5)*200;
      const pos = saved[n.id] ?? { x:defX, y:defY };
      return {
        id: n.id,
        type: "custom",
        position: pos,
        data: { name: n.name, description: n.description, files: n.files.map(fn=>fn.file.name) },
      };
    });
  }, [nodesData]);

  const graphEdges: Edge[] = useMemo(() => {
    if (!nodesData?.myNodes) return [];
    const seen = new Set<string>(), out: Edge[] = [];
    nodesData.myNodes.forEach(node =>
      node.edges.forEach(e => {
        if (e.nodeA.id === node.id && !seen.has(e.id)) {
          seen.add(e.id);
          out.push({
            id: e.id,
            source: e.nodeA.id,
            target: e.nodeB.id,
            label: e.label || "",
            style: { stroke: "#F97316", strokeWidth: 2 },
          });
        }
      })
    );
    return out;
  }, [nodesData]);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);
  useEffect(() => {
    if (nodesData?.myNodes) {
      setNodes(graphNodes);
      setEdges(graphEdges);
    }
  }, [nodesData, graphNodes, graphEdges, setNodes, setEdges]);

  // Selection & handlers
  const [selected, setSelected] = useState<{nodes:Node[];edges:Edge[]}>({nodes:[],edges:[]});
  const onSelectionChange = (s:{nodes:Node[];edges:Edge[]}) => setSelected(s);

  const handleAddNode = () => createNode({ variables:{ name:"New Node", description:"" }});
  const handleDeleteSelected = () => {
    selected.nodes.forEach(n =>
      deleteNode({
        variables:{ nodeId:n.id },
        onCompleted:()=>{
          setNodes(nds=>nds.filter(x=>x.id!==n.id));
          setEdges(eds=>eds.filter(e=>e.source!==n.id&&e.target!==n.id));
          const all=getSavedPositions(); delete all[n.id];
          localStorage.setItem("node-positions", JSON.stringify(all));
        }
      })
    );
    selected.edges.forEach(e =>
      deleteEdge({
        variables:{ edgeId:e.id },
        onCompleted:()=>setEdges(eds=>eds.filter(x=>x.id!==e.id))
      })
    );
  };

  const handleConnect = useCallback((c:Connection)=>{
    const temp = `t-${c.source}-${c.target}-${Date.now()}`;
    const optim:Edge = { id:temp, source:c.source!, target:c.target!, style:{ stroke:"#F97316",strokeWidth:2 } };
    setEdges(es=>addEdge(optim,es));
    createEdge({
      variables:{ nodeAId:c.source!, nodeBId:c.target!, label:"" },
      onCompleted:res=>{
        const real = res.createEdge.edge;
        setEdges(es=>es.map(e=>
          e.id===temp
            ? { id:real.id, source:real.nodeA.id, target:real.nodeB.id, label:real.label||"", style:optim.style }
            : e
        ));
      },
      onError:()=>setEdges(es=>es.filter(e=>e.id!==temp))
    });
  },[createEdge]);

  const handleEdgeClick = (ev:React.MouseEvent, edge:Edge) => {
    ev.stopPropagation();
    deleteEdge({
      variables:{ edgeId:edge.id },
      onCompleted:()=>setEdges(eds=>eds.filter(x=>x.id!==edge.id))
    });
  };

  const commitRename = (nodeId:string,nm:string,desc:string) => {
    renameNode({
      variables:{ nodeId, name:nm, description:desc },
      onCompleted:res=>{
        const u = res.renameNode.node;
        setNodes(nds=>nds.map(n=>
          n.id===u.id
            ? { ...n, data:{ ...n.data, name:u.name, description:u.description } }
            : n
        ));
      }
    });
  };

  const onNodeDragStop:NodeDragHandler = (_e,node)=>{
    savePosition(node.id,node.position.x,node.position.y);
    setNodes(nds=>nds.map(n=>n.id===node.id?{...n,position:node.position}:n));
  };

  // CustomNode
  function CustomNode({ id, data, selected }: NodeProps<{name:string;description:string;files:string[]}>) {
    const [nm, setNm] = useState(data.name);
    const [desc, setDesc] = useState(data.description);
    const { data: nfData, refetch: refetchNodeFiles } = useQuery(QUERY_NODE_FILES, { variables:{ nodeId:id }});
    const [dropping, setDropping] = useState(false);
    const [removingId, setRemovingId] = useState<string|null>(null);

    // sync files
    useEffect(()=>{
      if(nfData?.nodeFiles){
        data.files = nfData.nodeFiles.map((nf:any)=>nf.file.name);
      }
    },[nfData]);

    const onDragOver = (e:React.DragEvent) => e.preventDefault();
    const onDrop = useCallback(async (e:React.DragEvent)=>{
      e.preventDefault();
      setDropping(true);

      const dt = e.dataTransfer;
      const js = dt.getData("application/json");
      if(js){
        const { type, fileId } = JSON.parse(js);
        if(type==="vault-file"){
          await addFileToNode({ variables:{ nodeId:id, fileId }});
          await refetchNodeFiles();
          setDropping(false);
          return;
        }
      }

      if(dt.files.length){
        for(let i=0;i<dt.files.length;i++){
          const f = dt.files[i];
          const res = await uploadFile({ variables:{ name:f.name, upload:f }});
          await addFileToNode({ variables:{ nodeId:id, fileId:res.data.uploadFile.file.id }});
        }
        await Promise.all([refetchNodeFiles(), refetchFiles()]);
      }

      setDropping(false);
    },[id,addFileToNode,uploadFile,refetchNodeFiles,refetchFiles]);

    const handleBlurOrEnter = (e:any, isArea=false) => {
      if(!isArea && e.key && e.key!=="Enter") return;
      if(nm!==data.name||desc!==data.description) commitRename(id,nm,desc);
    };

    const handleRemove = async (fname:string) => {
      setRemovingId(fname);
      const match = nfData.nodeFiles.find((nf:any)=>nf.file.name===fname);
      if(match){
        await removeNodeFile({ variables:{ nodeId:id, fileId:match.file.id }});
        await refetchNodeFiles();
      }
      setRemovingId(null);
    };

    const hs:React.CSSProperties = { background:"#F97316", width:14, height:14, borderRadius:"50%", cursor:"pointer" };

    return (
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`bg-neutral-800/75 backdrop-blur-sm rounded-xl p-4 w-48 select-none ${selected?"ring-2 ring-orange-500":""}`}
        style={{ fontFamily:"'Segoe UI',sans-serif", color:"#F1F5F9"}}
        onMouseDown={e=>e.stopPropagation()}
      >
        <Handle type="target" position={Position.Left} style={hs} />
        {dropping && (
          <div className="absolute top-1 left-1 flex items-center text-xs space-x-1">
            <Loader2 className="animate-spin" size={12}/>
            <span>Attaching…</span>
          </div>
        )}

        {/* Name */}
        <div className="mb-3">
          <label className="block text-gray-300 text-xs mb-1">Name</label>
          <input
            value={nm}
            onChange={e=>setNm(e.target.value)}
            onBlur={handleBlurOrEnter}
            onKeyDown={e=>handleBlurOrEnter(e)}
            className="w-full px-2 py-1 bg-neutral-700 text-white border border-neutral-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="block text-gray-300 text-xs mb-1">Description</label>
          <textarea
            value={desc}
            onChange={e=>setDesc(e.target.value)}
            onBlur={e=>handleBlurOrEnter(e,true)}
            rows={2}
            className="w-full px-2 py-1 bg-neutral-700 text-white border border-neutral-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-vertical"
          />
        </div>

        {/* Files (auto-expanding list) */}
        <div className="mb-2">
          <span className="text-gray-300 font-medium text-xs">Files</span>
          <ul className="space-y-1 mt-1">
            {data.files.length > 0 ? data.files.map((f,i)=>(
              <li
                key={i}
                className="flex items-center justify-between px-1 py-0.5 bg-orange-500 hover:bg-red-600 active:bg-red-700 rounded transition-colors text-xs text-white"
              >
                <div className="flex-1 flex items-center space-x-1 overflow-hidden">
                  <FileText size={12} className="flex-shrink-0"/>
                  <span className="truncate">{f}</span>
                </div>
                <button
                  onClick={()=>handleRemove(f)}
                  disabled={removingId===f}
                  className="p-1 hover:bg-red-600 active:bg-red-700 rounded transition-colors"
                  title="Remove"
                >
                  {removingId===f
                    ? <Loader2 className="animate-spin" size={12}/>
                    : <Minus size={12} className="text-white"/>}
                </button>
              </li>
            )) : (
              <li className="text-gray-400 italic text-xs">(no files)</li>
            )}
          </ul>
        </div>

        <Handle type="source" position={Position.Right} style={hs} />
      </div>
    );
  }

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Early returns
  if (nodesLoading || filesLoading) return <div className="p-4">Loading…</div>;
  if (nodesError) return <div className="p-4 text-red-500">Error: {nodesError.message}</div>;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm">
        <div className="text-2xl font-extrabold">
          <span className="text-red-500">V</span><span className="text-white">ault</span>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={handleAddNode} className="p-2 bg-orange-500 hover:bg-red-600 active:bg-red-700 rounded transition-colors">
            <Plus size={16} className="text-white" />
          </button>
          <button onClick={handleDeleteSelected} className="p-2 bg-orange-500 hover:bg-red-600 active:bg-red-700 rounded transition-colors">
            <Minus size={16} className="text-white" />
          </button>
          <span className="text-gray-200 font-medium">{user?.username}</span>
          <button onClick={logout} className="px-4 py-2 bg-orange-500 hover:bg-red-600 active:bg-red-700 rounded transition-colors">
            Logout
          </button>
        </div>
      </header>

      {/* MAIN: SIDEBAR + MAP */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className="w-64 bg-neutral-800/75 backdrop-blur-sm p-4 overflow-auto"
          onDragOver={e=>e.preventDefault()}
          onDrop={handleSidebarDrop}
        >
          <h2 className="text-sm font-medium mb-2 text-white">My Files</h2>
          {sidebarUploading && (
            <div className="flex items-center text-xs mb-2 space-x-1 text-white">
              <Loader2 className="animate-spin" size={12}/>
              <span>Uploading…</span>
            </div>
          )}
          {filesData!.myFiles.map(f => (
            <div
              key={f.id}
              draggable
              onDragStart={e=>
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ type:"vault-file", fileId:f.id })
                )
              }
              className="flex items-center justify-between px-2 py-1 mb-1 bg-orange-500 hover:bg-red-600 active:bg-red-700 rounded cursor-grab transition-colors"
            >
              <div className="flex-1 flex items-center space-x-2 overflow-hidden">
                <FileText size={14} className="text-white flex-shrink-0"/>
                <span className="truncate text-white text-sm">{f.name}</span>
              </div>
              <div className="flex items-center space-x-1">
                <a
                  href={f.downloadUrl}
                  download
                  className="p-1 hover:bg-red-600 active:bg-red-700 rounded transition-colors"
                  title="Download"
                >
                  <Download size={14} className="text-white"/>
                </a>
                <button
                  onClick={() => handleSidebarDelete(f.id)}
                  disabled={removingSidebarId === f.id}
                  className="p-1 hover:bg-red-600 active:bg-red-700 rounded transition-colors"
                  title="Delete"
                >
                  {removingSidebarId===f.id
                    ? <Loader2 className="animate-spin text-white" size={12}/>
                    : <Trash2 size={14} className="text-white"/>}
                </button>
              </div>
            </div>
          ))}
        </aside>

        {/* ReactFlow canvas */}
        <div className="flex-1 relative" style={{ background:"#2D2D2D" }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onEdgeClick={handleEdgeClick}
              onNodeDragStop={onNodeDragStop}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes}
              style={{ background:"transparent" }}
            >
              <Controls style={{ background:"transparent" }} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
