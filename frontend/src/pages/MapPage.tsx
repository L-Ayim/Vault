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
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import {
  QUERY_MY_NODES,
  QUERY_MY_FILES,
  QUERY_NODE_FILES,
  QUERY_FRIENDS,
  QUERY_MY_GROUPS,
  MUTATION_CREATE_NODE,
  MUTATION_RENAME_NODE,
  MUTATION_DELETE_NODE,
  MUTATION_CREATE_EDGE,
  MUTATION_DELETE_EDGE,
  MUTATION_UPLOAD_FILE,
  MUTATION_ADD_FILE_VERSION,
  MUTATION_ADD_FILE_TO_NODE,
  MUTATION_REMOVE_FILE_FROM_NODE,
  MUTATION_DELETE_FILE,
  MUTATION_SHARE_NODE_WITH_USER,
  MUTATION_SHARE_NODE_WITH_GROUP,
  MUTATION_REVOKE_NODE_SHARE,
  MUTATION_CREATE_DIRECT_CHANNEL,
  MUTATION_JOIN_GROUP_CHANNEL,
  MUTATION_JOIN_NODE_CHANNEL,
  SUBSCRIPTION_NODE_UPDATES,
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
import FileVersionsDropdown from "../components/FileVersionsDropdown";
import usePersistentState from "../hooks/usePersistentState";

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
  sharedWithUser?: { id: string; username: string } | null;
  sharedWithGroup?: { id: string; name: string } | null;
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
interface QueryMyGroupsResult { myGroups: Group[] }
interface Friend { id: string; username: string }
interface Group { id: string; name: string }

export default function MapPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    "sidebar-collapsed",
    false
  );

  // set page title
  useEffect(() => {
    document.title = "Map";
  }, []);

  // chat overlay
  const [chatInfo, setChatInfo] = useState<{ id: string; name: string } | null>(null);
  const [createDirectChannel] = useMutation(MUTATION_CREATE_DIRECT_CHANNEL);
  const [joinNodeChannel] = useMutation(MUTATION_JOIN_NODE_CHANNEL);
  const [joinGroupChannel] = useMutation(MUTATION_JOIN_GROUP_CHANNEL);

  // friends
  const {
    data: friendsData,
    loading: friendsLoading,
    error: friendsError,
    refetch: refetchFriends,
  } = useQuery<{ friends: Friend[] }>(QUERY_FRIENDS, {
    variables: { limit: 20, offset: 0 },
    fetchPolicy: "cache-and-network",
  });

  // groups
  const {
    data: groupsData,
    loading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useQuery<QueryMyGroupsResult>(QUERY_MY_GROUPS, {
    variables: { limit: 20, offset: 0 },
    fetchPolicy: "cache-and-network",
  });

  const [groupPermMap, setGroupPermMap] = useState<Record<string, "R" | "W">>({});
  useEffect(() => {
    if (groupsData?.myGroups) {
      const m: Record<string, "R" | "W"> = {};
      groupsData.myGroups.forEach(g => { m[g.id] = "R" });
      setGroupPermMap(m);
    }
  }, [groupsData]);

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
  });
  const {
    data: filesData,
    loading: filesLoading,
    refetch: refetchFiles,
  } = useQuery<QueryMyFilesResult>(QUERY_MY_FILES);

  // Subscribe for updates and refetch lists when events fire
  const { data: subData } = useSubscription(SUBSCRIPTION_NODE_UPDATES);
  useEffect(() => {
    if (subData) {
      refetchNodes();
      refetchFiles();
      refetchFriends();
      refetchGroups();
    }
  }, [subData, refetchNodes, refetchFiles, refetchFriends, refetchGroups]);

  // mutations
  const [uploadFile]    = useMutation(MUTATION_UPLOAD_FILE);
  const [addFileVersion] = useMutation(MUTATION_ADD_FILE_VERSION);
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
  const [shareNodeWithUser]   = useMutation(MUTATION_SHARE_NODE_WITH_USER);
  const [shareNodeWithGroup]  = useMutation(MUTATION_SHARE_NODE_WITH_GROUP);
  const [revokeShare] = useMutation(MUTATION_REVOKE_NODE_SHARE);

  // sidebar upload / delete
  const [sidebarUploading, setSidebarUploading] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"new" | "version">("new");
  const [sidebarTargetId, setSidebarTargetId] = useState<string>("");
  const [sidebarFiles, setSidebarFiles] = useState<File[]>([]);
  const [removingSidebarId, setRemovingSidebarId] = useState<string|null>(null);
  const handleSidebarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setSidebarFiles(files ? Array.from(files) : []);
  };
  const handleSidebarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sidebarFiles.length) return;
    setSidebarUploading(true);
    for (const f of sidebarFiles) {
      if (sidebarMode === "new") {
        await uploadFile({ variables: { name: f.name, upload: f } });
      } else if (sidebarTargetId) {
        await addFileVersion({ variables: { fileId: sidebarTargetId, upload: f } });
      }
    }
    setSidebarFiles([]);
    await refetchFiles();
    setSidebarUploading(false);
  };
  const handleSidebarDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    setSidebarUploading(true);
    for (const f of files) {
      if (sidebarMode === "new") {
        await uploadFile({ variables: { name: f.name, upload: f } });
      } else if (sidebarTargetId) {
        await addFileVersion({ variables: { fileId: sidebarTargetId, upload: f } });
      }
    }
    await refetchFiles();
    setSidebarUploading(false);
  },[uploadFile,addFileVersion,refetchFiles,sidebarMode,sidebarTargetId]);
  const handleSidebarDelete = async (fileId:string) => {
    setRemovingSidebarId(fileId);
    await deleteFile({ variables:{ fileId } });
    await refetchFiles();
    setRemovingSidebarId(null);
  };


  // long-press drag for touch devices
  type DragItem =
    | { type: "vault-file"; fileId: string; name: string }
    | { type: "vault-friend"; friendId: string; name: string; permission: "R" | "W" }
    | { type: "vault-group"; groupId: string; name: string; permission: "R" | "W" };
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
  const startGroupTouchDrag = (
    e: React.TouchEvent,
    groupId: string,
    name: string,
    permission: "R" | "W",
  ) => {
    e.preventDefault();
    cancelTouchDrag();
    dragTimer.current = setTimeout(() => {
      setTouchDrag({ type: "vault-group", groupId, name, permission });
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
          } else if (touchDrag.type === "vault-friend") {
            await shareNodeWithUser({
              variables: {
                nodeId,
                userId: touchDrag.friendId,
                permission: touchDrag.permission,
              },
            });
          } else if (touchDrag.type === "vault-group") {
            await shareNodeWithGroup({
              variables: {
                nodeId,
                groupId: touchDrag.groupId,
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
  }, [touchDrag, touchPos, addFileToNode, shareNodeWithUser, shareNodeWithGroup]);

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
    id: string;
    name: string;
    description: string;
    files: string[];
    shares: NodeShare[];
  }>) {
    const [collapsed, setCollapsed] = usePersistentState<boolean>(
      `node-collapsed-${id}`,
      false
    );
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
      }
    );

    const { data: nodeSub } = useSubscription(SUBSCRIPTION_NODE_UPDATES, { variables:{ nodeId:id } });
    useEffect(() => {
      if (nodeSub) {
        refetchNodeFiles();
      }
    }, [nodeSub, refetchNodeFiles]);

    useEffect(() => {
      if (nfData?.nodeFiles) {
        data.files = nfData.nodeFiles.map((nf: FileOnNode) => nf.file.name);
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
          await shareNodeWithUser({
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
        if (obj.type === "vault-group") {
          await shareNodeWithGroup({
            variables: {
              nodeId: id,
              groupId: obj.groupId,
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
    },[id,shareNodeWithUser,shareNodeWithGroup,addFileToNode,uploadFile,refetchNodeFiles,refetchFiles]);

      const handleBlurOrEnter = (
        e: React.KeyboardEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
        isArea = false
      ) => {
      const k = 'key' in e ? (e as React.KeyboardEvent<HTMLElement>).key : undefined;
      if (!isArea && k && k!=="Enter") return;
      if (nm!==data.name||desc!==data.description) commitRename(id,nm,desc);
    };

    return (
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`relative bg-neutral-800/75 rounded-xl p-2 select-none flex flex-col w-60 ${
          collapsed ? "" : "space-y-2"
        } ${selected ? "ring-2 ring-orange-500" : ""}`}
        style={{
          fontFamily: "'Segoe UI',sans-serif",
          color: "#F1F5F9",
          height: collapsed ? "2.5rem" : undefined,
          overflow: "hidden",
          transition: "height 0.2s",
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {dropping && (
          <div className="absolute top-0 left-0 h-1 w-full bg-orange-500 animate-pulse"/>
        )}

        {collapsed ? (
          <div className="flex items-center justify-between px-2">
            <span className="text-white text-sm truncate mr-2">{data.name}</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() =>
                  joinNodeChannel({ variables: { nodeId: id } })
                    .then(res =>
                      setChatInfo({
                        id: res.data.joinNodeChannel.channel.id,
                        name: data.name,
                      })
                    )
                }
                className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
              >
                <MessageCircle size={12} className="text-white" />
              </button>
              <button
                onClick={() => setCollapsed(false)}
                className="p-1 bg-neutral-700 rounded"
              >
                <ChevronDown size={12} className="text-white" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <button
              onClick={() =>
                joinNodeChannel({ variables: { nodeId: id } })
                  .then(res =>
                    setChatInfo({
                      id: res.data.joinNodeChannel.channel.id,
                      name: data.name,
                    })
                  )
              }
              className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
            >
              <MessageCircle size={12} className="text-white" />
            </button>

            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1 bg-neutral-700 rounded"
            >
              {collapsed ? (
                <ChevronDown size={12} className="text-white" />
              ) : (
                <ChevronUp size={12} className="text-white" />
              )}
            </button>
          </div>
        )}

        <Handle type="target" position={Position.Left} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />

        {/* Name */}
        {!collapsed && (
          <div className="mb-3">
            <label className="block text-gray-300 text-sm mb-1">Name</label>
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
              <label className="block text-gray-300 text-sm mb-1">Description</label>
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
              <span className="text-gray-300 font-medium text-sm">Files</span>
              <ul className="space-y-1 mt-1 max-h-32 overflow-auto">
                  {nfData?.nodeFiles?.length > 0 ? (
                    nfData.nodeFiles.map((nf: FileOnNode) => (
                    <li key={nf.file.id} className="space-y-1">
                      <div className="flex items-center justify-between px-1 py-0.5 bg-orange-500 rounded text-sm text-white">
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
                      </div>
                      <FileVersionsDropdown fileId={nf.file.id} />
                    </li>
                  ))
                ) : (
                  <li className="italic text-gray-400 text-sm">Drag file here</li>
                )}
              </ul>
            </div>

            {/* Shared with */}
            <div className="mb-2">
              <span className="text-gray-300 font-medium text-sm">Shared with</span>
              <ul className="space-y-1 mt-1 max-h-32 overflow-auto">
                {data.shares.length>0 ? data.shares.map(share=>(
                  <li
                    key={share.id}
                    className="flex items-center justify-between px-1 py-0.5 bg-orange-500 rounded text-sm text-white"
                  >
                    <div className="flex items-center space-x-1">
                      <span className="truncate">
                        {share.sharedWithUser
                          ? share.sharedWithUser.username
                          : share.sharedWithGroup
                            ? share.sharedWithGroup.name
                            : "Public"}
                      </span>
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
                  <li className="italic text-gray-400 text-sm">Drag friend or group here</li>
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
              <form onSubmit={handleSidebarUpload} className="mb-2 space-y-2 flex flex-col">
                <input
                  type="file"
                  multiple
                  onChange={handleSidebarFileChange}
                  className="file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-white hover:file:bg-neutral-600"
                />
                <div className="flex space-x-2">
                  <select
                    value={sidebarMode}
                    onChange={e=>setSidebarMode(e.target.value as "new" | "version")}
                    className="px-2 py-1 bg-neutral-700 text-white rounded-md"
                  >
                    <option value="new">New file</option>
                    <option value="version">Add version</option>
                  </select>
                  {sidebarMode === "version" && (
                    <select
                      value={sidebarTargetId}
                      onChange={e=>setSidebarTargetId(e.target.value)}
                      className="flex-1 px-2 py-1 bg-neutral-700 text-white rounded-md"
                    >
                      <option value="">Select file…</option>
                      {filesData?.myFiles.map(f=>(
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    disabled={
                      sidebarUploading ||
                      sidebarFiles.length === 0 ||
                      (sidebarMode === "version" && !sidebarTargetId)
                    }
                    className="px-3 py-1 bg-orange-500 rounded text-white disabled:opacity-50"
                  >
                    Upload
                  </button>
                </div>
              </form>
              <div className="max-h-48 overflow-y-auto space-y-1">
              {filesData?.myFiles.map(f=>(
                <div key={f.id} className="mb-1 space-y-1">
                  <div
                    draggable
                    onDragStart={e=>{
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ type: "vault-file", fileId: f.id })
                      );
                      e.dataTransfer.setDragImage(new Image(), 0, 0);
                    }}
                    onTouchStart={e=>startFileTouchDrag(e,f.id,f.name)}
                    onTouchEnd={cancelTouchDrag}
                    onTouchMove={cancelTouchDrag}
                    className="flex items-center justify-between px-2 py-1 bg-orange-500 rounded cursor-grab"
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
                  <FileVersionsDropdown fileId={f.id} />
                </div>
              ))}
              </div>

              {/* Friends */}
              <div className="mt-6 mb-2">
                <h2 className="text-sm font-medium text-white">Friends</h2>
              </div>
              {friendsLoading ? (
                <p className="text-gray-400 text-sm">Loading friends…</p>
              ) : friendsError ? (
                <p className="text-red-500 text-sm">Error loading friends</p>
              ) : friendsData?.friends.length ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                {friendsData.friends.map(f => {
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
                          onClick={() =>
                            createDirectChannel({ variables: { withUserId: f.id } })
                              .then(res =>
                                setChatInfo({
                                  id: res.data.createDirectChannel.channel.id,
                                  name: f.username,
                                })
                              )
                          }
                          className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                        >
                          <MessageCircle className="text-white" size={14}/>
                        </button>
                    </div>
                    </div>
                  );
                })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No friends</p>
              )}

              {/* Groups */}
              <div className="mt-6 mb-2">
                <h2 className="text-sm font-medium text-white">Groups</h2>
              </div>
              {groupsLoading ? (
                <p className="text-gray-400 text-sm">Loading groups…</p>
              ) : groupsError ? (
                <p className="text-red-500 text-sm">Error loading groups</p>
              ) : groupsData?.myGroups.length ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                {groupsData.myGroups.map(g => {
                  const perm = groupPermMap[g.id] || "R";
                  return (
                    <div
                      key={g.id}
                      draggable
                      onDragStart={e=>{
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            type: "vault-group",
                            groupId: g.id,
                            permission: perm
                          })
                        );
                        e.dataTransfer.setDragImage(new Image(),0,0);
                      }}
                      onTouchStart={e=>startGroupTouchDrag(e,g.id,g.name,perm)}
                      onTouchEnd={cancelTouchDrag}
                      onTouchMove={cancelTouchDrag}
                      className="flex items-center justify-between px-2 py-1 mb-1 bg-orange-500 rounded cursor-grab"
                    >
                      <span className="flex-1 text-white truncate">{g.name}</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={ev=>{
                            ev.stopPropagation();
                            setGroupPermMap(m=>({...m,[g.id]:"R"}));
                          }}
                          className={`p-1 rounded ${perm==="R"? "bg-red-600":"bg-neutral-700"}`}
                        >
                          <Eye className="text-white" size={14}/>
                        </button>
                        <button
                          onClick={ev=>{
                            ev.stopPropagation();
                            setGroupPermMap(m=>({...m,[g.id]:"W"}));
                          }}
                          className={`p-1 rounded ${perm==="W"? "bg-red-600":"bg-neutral-700"}`}
                        >
                          <Pen className="text-white" size={14}/>
                        </button>
                        <button
                          onClick={() =>
                            joinGroupChannel({ variables: { groupId: g.id } })
                              .then(res =>
                                setChatInfo({
                                  id: res.data.joinGroupChannel.channel.id,
                                  name: g.name,
                                })
                              )
                          }
                          className="p-1 bg-neutral-700 hover:bg-red-600 rounded"
                        >
                          <MessageCircle className="text-white" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No groups</p>
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
      {chatInfo && (
        <ChatBox
          channelId={chatInfo.id}
          title={chatInfo.name}
          onClose={() => setChatInfo(null)}
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
