// src/pages/MapPage.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  QUERY_FRIENDS,
  MUTATION_CREATE_NODE,
  MUTATION_RENAME_NODE,
  MUTATION_DELETE_NODE,
  MUTATION_CREATE_EDGE,
  MUTATION_DELETE_EDGE,
  MUTATION_UPLOAD_FILE,
  MUTATION_ADD_FILE_TO_NODE,
  MUTATION_REMOVE_FILE_FROM_NODE,
  MUTATION_DELETE_FILE,
  MUTATION_SHARE_NODE_WITH_USER,
  MUTATION_REVOKE_NODE_SHARE,
  MUTATION_CREATE_DIRECT_CHANNEL,
} from "../graphql/operations";
import {
  Plus,
  Minus,
  FileText,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  Pen,
  MessageCircle,
} from "lucide-react";
import "reactflow/dist/style.css";
import Header from "../components/Header";
import ChatBox from "../components/ChatBox"; // your reusable chat overlay

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
interface NodeShare {
  id: string;
  permission: "R" | "W";
  sharedWithUser: { id: string; username: string };
}
interface NodeData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  owner: { id: string; username: string };
  files: FileOnNode[];
  edges: EdgeOnNode[];
  shares: NodeShare[];
}
interface QueryMyNodesResult { myNodes: NodeData[] }
interface QueryMyFilesResult {
  myFiles: { id: string; name: string; downloadUrl: string }[];
}
interface Friend { id: string; username: string }

export default function MapPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // set page title
  useEffect(() => {
    document.title = "Map";
  }, []);

  // chat overlay
  const [chatChannel, setChatChannel] = useState<string | null>(null);
  const [createDirectChannel] = useMutation(MUTATION_CREATE_DIRECT_CHANNEL, {
    onCompleted: res => setChatChannel(res.createDirectChannel.channel.id),
  });

  // friends
  const {
    data: friendsData,
    loading: friendsLoading,
    error: friendsError,
  } = useQuery<{ friends: Friend[] }>(QUERY_FRIENDS, {
    variables: { limit: 20, offset: 0 },
    fetchPolicy: "cache-and-network",
    pollInterval: 1000,
  });

  // per-friend R/W toggle
  const [friendPermMap, setFriendPermMap] = useState<Record<string, "R" | "W">>({});
  useEffect(() => {
    if (friendsData?.friends) {
      const m: Record<string, "R" | "W"> = {};
      friendsData.friends.forEach(f => { m[f.id] = "R" });
      setFriendPermMap(m);
    }
  }, [friendsData]);

  // nodes + files
  const {
    data: nodesData,
    loading: nodesLoading,
    error: nodesError,
    refetch: refetchNodes,
  } = useQuery<QueryMyNodesResult>(QUERY_MY_NODES, {
    fetchPolicy: "network-only",
    pollInterval: 1000,
  });
  const {
    data: filesData,
    loading: filesLoading,
    refetch: refetchFiles,
  } = useQuery<QueryMyFilesResult>(QUERY_MY_FILES);

  // mutations
  const [uploadFile]    = useMutation(MUTATION_UPLOAD_FILE);
  const [addFileToNode] = useMutation(MUTATION_ADD_FILE_TO_NODE);
  const [removeFile]    = useMutation(MUTATION_REMOVE_FILE_FROM_NODE);
  const [deleteFile]    = useMutation(MUTATION_DELETE_FILE);
  const [createNode]    = useMutation(MUTATION_CREATE_NODE, {
    onCompleted: res => {
      const n = res.createNode.node;
      setNodes(nds => [
        ...nds,
        { id: n.id, type: "custom", position: { x:200,y:200 },
          data: { id:n.id, name:n.name, description:"", files:[], shares:[] }
        }
      ]);
      savePosition(n.id,200,200);
    }
  });
  const [renameNode]  = useMutation(MUTATION_RENAME_NODE);
  const [deleteNode]  = useMutation(MUTATION_DELETE_NODE);
  const [createEdge]  = useMutation(MUTATION_CREATE_EDGE);
  const [deleteEdge]  = useMutation(MUTATION_DELETE_EDGE);
  const [shareNode]   = useMutation(MUTATION_SHARE_NODE_WITH_USER);
  const [revokeShare] = useMutation(MUTATION_REVOKE_NODE_SHARE);

  // sidebar upload / delete
  const [sidebarUploading, setSidebarUploading] = useState(false);
  const [removingSidebarId, setRemovingSidebarId] = useState<string|null>(null);
  const handleSidebarDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    setSidebarUploading(true);
    for (const f of files) await uploadFile({ variables:{ name:f.name, upload:f } });
    await refetchFiles();
    setSidebarUploading(false);
  },[uploadFile,refetchFiles]);
  const handleSidebarDelete = async (fileId:string) => {
    setRemovingSidebarId(fileId);
    await deleteFile({ variables:{ fileId } });
    await refetchFiles();
    setRemovingSidebarId(null);
  };

  // long-press drag for touch devices
  type DragItem =
    | { type: "vault-file"; fileId: string; name: string }
    | { type: "vault-friend"; friendId: string; name: string; permission: "R" | "W" };
  const [touchDrag, setTouchDrag] = useState<DragItem | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTouchDrag = () => {
    if (dragTimer.current) clearTimeout(dragTimer.current);
    dragTimer.current = null;
  };
  const startFileTouchDrag = (
    e: React.TouchEvent,
    fileId: string,
    name: string,
  ) => {
    e.preventDefault();
    cancelTouchDrag();
    dragTimer.current = setTimeout(() => {
      setTouchDrag({ type: "vault-file", fileId, name });
      setTouchPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }, 300);
  };
  const startFriendTouchDrag = (
    e: React.TouchEvent,
    friendId: string,
    name: string,
    permission: "R" | "W",
  ) => {
    e.preventDefault();
    cancelTouchDrag();
    dragTimer.current = setTimeout(() => {
      setTouchDrag({ type: "vault-friend", friendId, name, permission });
      setTouchPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }, 300);
  };

  useEffect(() => {
    if (!touchDrag) return;
    const handleMove = (ev: TouchEvent) => {
      ev.preventDefault();
      if (ev.touches.length) {
        setTouchPos({ x: ev.touches[0].clientX, y: ev.touches[0].clientY });
      }
    };
    const handleEnd = async () => {
      cancelTouchDrag();
      if (touchDrag && touchPos) {
        const el = document.elementFromPoint(touchPos.x, touchPos.y);
        const nodeEl = el?.closest('.react-flow__node') as HTMLElement | null;
        const nodeId = nodeEl?.dataset.id;
        if (nodeId) {
          if (touchDrag.type === "vault-file") {
            await addFileToNode({ variables: { nodeId, fileId: touchDrag.fileId } });
          } else {
            await shareNode({
              variables: {
                nodeId,
                userId: touchDrag.friendId,
                permission: touchDrag.permission,
              },
            });
          }
          await refetchNodes();
        }
      }
      setTouchDrag(null);
      setTouchPos(null);
    };
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd,  { passive: false });
    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [touchDrag, touchPos, addFileToNode, shareNode]);

  // persist positions
  const getSavedPositions = () => {
    try { return JSON.parse(localStorage.getItem("node-positions")||"{}") }
    catch { return {} }
  };
  const savePosition = (id:string,x:number,y:number) => {
    const all = getSavedPositions();
    all[id] = { x,y };
    localStorage.setItem("node-positions",JSON.stringify(all));
  };

  // build graph
  const graphNodes:Node[] = useMemo(() => {
    if (!nodesData?.myNodes) return [];
    const saved = getSavedPositions();
    return nodesData.myNodes.map((n,idx) => {
      const defX = 50 + (idx%5)*200;
      const defY = 50 + Math.floor(idx/5)*200;
      const pos = saved[n.id] ?? { x:defX,y:defY };
      return {
        id: n.id,
        type: "custom",
        position: pos,
        data: {
          id: n.id,
          name: n.name,
          description: n.description,
          files: n.files.map(fn=>fn.file.name),
          shares: n.shares,
        },
      };
    });
  }, [nodesData]);
  const graphEdges:Edge[] = useMemo(() => {
    if (!nodesData?.myNodes) return [];
    const seen = new Set<string>();
    const out:Edge[] = [];
    nodesData.myNodes.forEach(node =>
      node.edges.forEach(e => {
        if (e.nodeA.id===node.id && !seen.has(e.id)) {
          seen.add(e.id);
          out.push({
            id: e.id,
            source: e.nodeA.id,
            target: e.nodeB.id,
            label: e.label||"",
            style: { stroke:"#F97316",strokeWidth:2 }
          });
        }
      })
    );
    return out;
  },[nodesData]);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);
  useEffect(() => {
    if (nodesData?.myNodes) {
      setNodes(graphNodes);
      setEdges(graphEdges);
    }
  },[nodesData,graphNodes,graphEdges]);

  const [selected, setSelected] = useState<{nodes:Node[];edges:Edge[]}>({nodes:[],edges:[]});
  const onSelectionChange = (s:{nodes:Node[];edges:Edge[]}) => setSelected(s);

  // add / delete
  const handleAddNode = () => createNode({ variables:{ name:"New Node", description:"" }});
  const handleDeleteSelected = () => {
    selected.nodes.forEach(n=>
      deleteNode({
        variables:{ nodeId:n.id },
        onCompleted:()=>{
          setNodes(nds=>nds.filter(x=>x.id!==n.id));
          setEdges(eds=>eds.filter(e=>e.source!==n.id&&e.target!==n.id));
          const all=getSavedPositions(); delete all[n.id];
          localStorage.setItem("node-positions",JSON.stringify(all));
        }
      })
    );
    selected.edges.forEach(e=>
      deleteEdge({
        variables:{ edgeId:e.id },
        onCompleted:()=>setEdges(eds=>eds.filter(x=>x.id!==e.id))
      })
    );
  };
  const handleConnect = useCallback((c:Connection)=>{
    const temp = `t-${c.source}-${c.target}-${Date.now()}` as const;
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
  const handleEdgeClick = (ev:React.MouseEvent,edge:Edge)=>{
    ev.stopPropagation();
    deleteEdge({
      variables:{ edgeId:edge.id },
      onCompleted:()=>setEdges(eds=>eds.filter(x=>x.id!==edge.id))
    });
  };
  const commitRename = (nodeId:string,nm:string,desc:string)=>{
    renameNode({
      variables:{ nodeId, name:nm, description:desc },
      onCompleted:res=>{
        const u=res.renameNode.node;
        setNodes(nds=>
          nds.map(n=>
            n.id===u.id
              ? { ...n, data:{ ...n.data, name:u.name, description:u.description } }
              : n
          )
        );
      }
    });
  };
  const onNodeDragStop:NodeDragHandler = (_e,node)=>{
    savePosition(node.id,node.position.x,node.position.y);
    setNodes(nds=>nds.map(n=>n.id===node.id?{...n,position:node.position}:n));
  };

  // custom node
  function CustomNode({ id, data, selected }: NodeProps<{
    id:string; name:string; description:string; files:string[]; shares:NodeShare[]
  }>) {
    const [collapsed, setCollapsed] = useState(false);
    const [nm, setNm] = useState(data.name);
    const [desc, setDesc] = useState(data.description);
    const [dropping, setDropping] = useState(false);

    useEffect(() => {
      setNm(data.name);
      setDesc(data.description);
    }, [data.name, data.description]);

    const { data: nfData, refetch: refetchNodeFiles } = useQuery(
      QUERY_NODE_FILES,
      {
        variables:{ nodeId:id },
        fetchPolicy:"network-only",
        pollInterval:1000,
      }
    );

    useEffect(() => {
      if (nfData?.nodeFiles) {
        data.files = nfData.nodeFiles.map((nf:any)=>nf.file.name);
      }
    }, [nfData]);

    const handleStyle: React.CSSProperties = {
      width:12,
      height:12,
      borderRadius:6,
      background:'#F97316',
      border:0
    };

    const onDragOver = (e:React.DragEvent)=>e.preventDefault();
    const onDrop = useCallback(async(e:React.DragEvent)=>{
      e.preventDefault();
      setDropping(true);
      const dt = e.dataTransfer;
      const js = dt.getData("application/json");
      if (js) {
        const obj = JSON.parse(js);
        if (obj.type === "vault-friend") {
          await shareNode({
            variables: {
              nodeId: id,
              userId: obj.friendId,
              permission: obj.permission,
            },
          });
          await Promise.all([refetchNodeFiles(), refetchNodes()]);
          setDropping(false);
          return;
        }
        if (obj.type === "vault-file") {
          await addFileToNode({ variables: { nodeId: id, fileId: obj.fileId } });
          await Promise.all([refetchNodeFiles(), refetchNodes()]);
          setDropping(false);
          return;
        }
      }
      // fallback file drop
      if (dt.files.length) {
        for (const f of Array.from(dt.files)) {
          const r = await uploadFile({ variables:{ name:f.name, upload:f } });
          await addFileToNode({ variables:{ nodeId:id, fileId:r.data.uploadFile.file.id }});
        }
        await Promise.all([refetchNodeFiles(), refetchFiles(), refetchNodes()]);
      }
      setDropping(false);
    },[id,shareNode,addFileToNode,uploadFile,refetchNodeFiles,refetchFiles]);

    const handleBlurOrEnter = (e:any,isArea=false)=>{
      if (!isArea && e.key && e.key!=="Enter") return;
      if (nm!==data.name||desc!==data.description) commitRename(id,nm,desc);
    };

    return (
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`relative bg-neutral-800/75 rounded-xl p-4 ${collapsed? 'w-32 h-10' : 'w-48'} select-none ${
          selected? "ring-2 ring-orange-500":""
        }`}
        style={{ fontFamily:"'Segoe UI',sans-serif", color:"#F1F5F9", transition:'height 0.2s' }}
        onMouseDown={e=>e.stopPropagation()}
      >
        {dropping && (
          <div className="absolute top-0 left-0 h-1 w-full bg-orange-500 animate-pulse"/>
        )}

        <button
          onClick={()=>setCollapsed(c=>!c)}
          className="absolute top-1 right-1 p-1 bg-neutral-700 rounded"
        >
          {collapsed ? <ChevronDown size={12} className="text-white"/> : <ChevronUp size={12} className="text-white"/>}
        </button>

        <Handle type="target" position={Position.Left} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />

        {/* Name */}
        {collapsed ? (
          <div className="h-full flex items-center justify-center px-2">
            <span className="text-white text-sm truncate">{data.name}</span>
          </div>
        ) : (
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
        )}

        {!collapsed && (
          <>
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

            {/* Files */}
            <div className="mb-2">
              <span className="text-gray-300 font-medium text-xs">Files</span>
              <ul className="space-y-1 mt-1 max-h-32 overflow-auto">
                {nfData?.nodeFiles?.length > 0 ? (
                  nfData.nodeFiles.map((nf:any)=>(
                    <li
                      key={nf.file.id}
                      className="flex items-center justify-between px-1 py-0.5 bg-orange-500 rounded text-xs text-white"
                    >
                      <div className="flex-1 flex items-center space-x-1 overflow-hidden">
                        <FileText size={12} className="flex-shrink-0"/>
                        <span className="truncate">{nf.file.name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <a
                          href={nf.file.uploadUrl}
                          download
                          className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                        >
                          <Download size={12} className="text-white"/>
                        </a>
                        <button
                          onClick={()=>
                            removeFile({ variables:{ nodeId:id, fileId:nf.file.id }})
                              .then(()=>refetchNodeFiles())
                          }
                          className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                        >
                          <Minus size={12} className="text-white"/>
                        </button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="italic text-gray-400 text-xs">Drag file here</li>
                )}
              </ul>
            </div>

            {/* Shared with */}
            <div className="mb-2">
              <span className="text-gray-300 font-medium text-xs">Shared with</span>
              <ul className="space-y-1 mt-1 max-h-32 overflow-auto">
                {data.shares.length>0 ? data.shares.map(share=>(
                  <li
                    key={share.id}
                    className="flex items-center justify-between px-1 py-0.5 bg-orange-500 rounded text-xs text-white"
                  >
                    <div className="flex items-center space-x-1">
                      <span className="truncate">{share.sharedWithUser.username}</span>
                      {share.permission==="R"
                        ? <Eye size={12} className="text-white"/>
                        : <Pen size={12} className="text-white"/>
                      }
                    </div>
                    <button
                      onClick={()=>revokeShare({ variables:{ shareId:share.id }})}
                      className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                    >
                      <Minus size={12} className="text-white"/>
                    </button>
                  </li>
                )) : (
                  <li className="italic text-gray-400 text-xs">Drag friend here</li>
                )}
              </ul>
            </div>
          </>
        )}

      </div>
    );
  }

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  if (nodesLoading || filesLoading) return <div className="p-4">Loading…</div>;
  if (nodesError) return <div className="p-4 text-red-500">Error: {nodesError.message}</div>;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white overscroll-none">
      {/* HEADER */}
      <Header>
        <button
          onClick={handleAddNode}
          className="p-2 bg-orange-500 hover:bg-red-600 rounded"
        >
          <Plus size={16} className="text-white" />
        </button>
        <button
          onClick={handleDeleteSelected}
          className="p-2 bg-orange-500 hover:bg-red-600 rounded"
        >
          <Minus size={16} className="text-white" />
        </button>
      </Header>

      {/* MAIN */}
      <div className="flex flex-1 flex-col sm:flex-row">
        {/* SIDEBAR */}
        <aside
          className={`flex flex-col transition-all duration-200 bg-neutral-800/75 p-2 ${
            sidebarCollapsed ? "w-12" : "w-full sm:w-64"
          } overflow-auto`}
          onDragOver={e=>e.preventDefault()}
          onDrop={handleSidebarDrop}
        >
          <div className="flex justify-end mb-2">
            <button onClick={()=>setSidebarCollapsed(s=>!s)} className="p-1 hover:bg-neutral-700 rounded">
              {sidebarCollapsed
                ? <ChevronRight className="text-orange-500" size={16}/>
                : <ChevronLeft className="text-red-500" size={16}/>
              }
            </button>
          </div>
          {!sidebarCollapsed && (
            <>
              {/* Files */}
              <h2 className="text-sm font-medium mb-2 text-white">Files</h2>
              {sidebarUploading && <div className="h-1 w-full bg-orange-500 animate-pulse mb-2"/>}
              {filesData?.myFiles.map(f=>(
                <div
                  key={f.id}
                  draggable
                  onDragStart={e=>{
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({ type: "vault-file", fileId: f.id })
                    );
                    // hide native ghost image
                    e.dataTransfer.setDragImage(new Image(), 0, 0);
                  }}
                  onTouchStart={e=>startFileTouchDrag(e,f.id,f.name)}
                  onTouchEnd={cancelTouchDrag}
                  onTouchMove={cancelTouchDrag}
                  className="flex items-center justify-between px-2 py-1 mb-1 bg-orange-500 rounded cursor-grab"
                >
                  <div className="flex-1 flex items-center space-x-2 overflow-hidden">
                    <FileText size={14} className="text-white flex-shrink-0"/>
                    <span className="truncate text-white text-sm">{f.name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <a href={f.downloadUrl} download className="p-1 bg-neutral-700 hover:bg-red-600 rounded">
                      <Download size={14} className="text-white"/>
                    </a>
                    <button
                      onClick={()=>handleSidebarDelete(f.id)}
                      disabled={removingSidebarId===f.id}
                      className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                    >
                      <Trash2 size={14} className="text-white"/>
                    </button>
                  </div>
                </div>
              ))}

              {/* Friends */}
              <div className="mt-6 mb-2">
                <h2 className="text-sm font-medium text-white">Friends</h2>
              </div>
              {friendsLoading ? (
                <p className="text-gray-400 text-sm">Loading friends…</p>
              ) : friendsError ? (
                <p className="text-red-500 text-sm">Error loading friends</p>
              ) : friendsData?.friends.length ? (
                friendsData.friends.map(f => {
                  const perm = friendPermMap[f.id] || "R";
                  return (
                    <div
                      key={f.id}
                      draggable
                      onDragStart={e=>{
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            type: "vault-friend",
                            friendId: f.id,
                            permission: perm
                          })
                        );
                        // hide native ghost image
                        e.dataTransfer.setDragImage(new Image(), 0, 0);
                      }}
                      onTouchStart={e=>startFriendTouchDrag(e,f.id,f.username,perm)}
                      onTouchEnd={cancelTouchDrag}
                      onTouchMove={cancelTouchDrag}
                      className="flex items-center justify-between px-2 py-1 mb-1 bg-orange-500 rounded cursor-grab"
                    >
                      <span className="flex-1 text-white truncate">{f.username}</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={ev=>{
                            ev.stopPropagation();
                            setFriendPermMap(m=>({...m,[f.id]:"R"}));
                          }}
                          className={`p-1 rounded ${perm==="R"? "bg-red-600":"bg-neutral-700"}`}
                        >
                          <Eye className="text-white" size={14}/>
                        </button>
                        <button
                          onClick={ev=>{
                            ev.stopPropagation();
                            setFriendPermMap(m=>({...m,[f.id]:"W"}));
                          }}
                          className={`p-1 rounded ${perm==="W"? "bg-red-600":"bg-neutral-700"}`}
                        >
                          <Pen className="text-white" size={14}/>
                        </button>
                        <button
                          onClick={()=>{
                            createDirectChannel({ variables:{ withUserId:f.id } });
                          }}
                          className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                        >
                          <MessageCircle className="text-white" size={14}/>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-400 text-sm">No friends</p>
              )}
            </>
          )}
        </aside>

        {/* CANVAS */}
        <div className="flex-1 relative overscroll-none" style={{ touchAction:'none', background:'#2D2D2D' }}>
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
              <Controls style={{ background:"transparent" }}/>
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      {/* Chat overlay */}
      {chatChannel && (
        <ChatBox
          channelId={chatChannel}
          onClose={() => setChatChannel(null)}
        />
      )}

      {touchDrag && touchPos && (
        <div
          className="fixed pointer-events-none z-50 flex items-center space-x-1 bg-orange-500 text-white text-sm px-2 py-1 rounded"
          style={{
            top: touchPos.y,
            left: touchPos.x,
            transform: "translate(-50%,-50%)",
            opacity: 0.8,
          }}
        >
          {touchDrag.type === "vault-file" ? (
            <>
              <FileText size={16} className="text-white" />
              <span className="truncate max-w-40">{touchDrag.name}</span>
            </>
          ) : (
            <span className="truncate max-w-40">{touchDrag.name}</span>
          )}
        </div>
      )}
    </div>
  );
}
