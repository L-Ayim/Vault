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
  MUTATION_CREATE_NODE,
  MUTATION_RENAME_NODE,
  MUTATION_DELETE_NODE,
  MUTATION_CREATE_EDGE,
  MUTATION_DELETE_EDGE,
} from "../graphql/operations";
import { Plus, Minus, FileText } from "lucide-react";
import "reactflow/dist/style.css";
import { useAuth } from "../auth/AuthContext";

interface FileOnNode {
  note: string;
  addedAt: string;
  file: {
    id: string;
    name: string;
    uploadUrl: string;
  };
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

interface QueryMyNodesResult {
  myNodes: NodeData[];
}

export default function MapPage() {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1) Hooks must be called in a consistent order
  // ─────────────────────────────────────────────────────────────────────────────

  // 1.a) Page title
  useEffect(() => {
    document.title = "Map";
  }, []);

  // 1.b) AuthContext for header
  const { user, logout } = useAuth();

  // 1.c) Fetch nodes from backend
  const {
    data: nodesData,
    loading: nodesLoading,
    error: nodesError,
  } = useQuery<QueryMyNodesResult>(QUERY_MY_NODES, {
    fetchPolicy: "network-only",
  });

  // 1.d) Track selected items for deletion
  const [selectedItems, setSelectedItems] = useState<{ nodes: Node[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });

  // 1.e) Handler for selection changes
  const onSelectionChange = (sel: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedItems(sel);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) GraphQL Mutations
  // ─────────────────────────────────────────────────────────────────────────────
  const [createNodeMutation] = useMutation(MUTATION_CREATE_NODE, {
    onCompleted: (res) => {
      const newNode = res.createNode.node;
      setNodes((nds) => [
        ...nds,
        {
          id: newNode.id,
          type: "custom",
          position: { x: 200, y: 200 },
          data: { name: newNode.name, description: newNode.description || "", files: [] },
        },
      ]);
      savePosition(newNode.id, 200, 200);
    },
  });
  const [renameNodeMutation] = useMutation(MUTATION_RENAME_NODE);
  const [deleteNodeMutation] = useMutation(MUTATION_DELETE_NODE);
  const [createEdgeMutation] = useMutation(MUTATION_CREATE_EDGE);
  const [deleteEdgeMutation] = useMutation(MUTATION_DELETE_EDGE);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3) Helpers: saving/loading node positions
  // ─────────────────────────────────────────────────────────────────────────────
  const getSavedPositions = (): Record<string, { x: number; y: number }> => {
    try {
      const raw = localStorage.getItem("node-positions");
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const savePosition = (nodeId: string, x: number, y: number) => {
    const all = getSavedPositions();
    all[nodeId] = { x, y };
    localStorage.setItem("node-positions", JSON.stringify(all));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4) Build React Flow nodes & edges from GraphQL data
  // ─────────────────────────────────────────────────────────────────────────────
  const graphNodes: Node[] = useMemo(() => {
    if (!nodesData?.myNodes) return [];
    const saved = getSavedPositions();
    return nodesData.myNodes.map((n, idx) => {
      const defaultX = 50 + (idx % 5) * 200;
      const defaultY = 50 + Math.floor(idx / 5) * 200;
      const pos = saved[n.id] ?? { x: defaultX, y: defaultY };
      return {
        id: n.id,
        type: "custom",
        position: { x: pos.x, y: pos.y },
        data: {
          name: n.name,
          description: n.description || "",
          files: n.files.map((fn) => fn.file.name),
        },
      };
    });
  }, [nodesData]);

  const graphEdges: Edge[] = useMemo(() => {
    if (!nodesData?.myNodes) return [];
    const seen = new Set<string>();
    const out: Edge[] = [];
    nodesData.myNodes.forEach((node) => {
      node.edges.forEach((e) => {
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
      });
    });
    return out;
  }, [nodesData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5) React Flow state hooks
  // ─────────────────────────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);

  // Sync local state when GraphQL data updates
  useEffect(() => {
    if (nodesData?.myNodes) {
      setNodes(graphNodes);
      setEdges(graphEdges);
    }
  }, [nodesData, graphNodes, graphEdges, setNodes, setEdges]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6) UI Handlers (create/delete nodes & edges, selection)
  // ─────────────────────────────────────────────────────────────────────────────

  // 6.a) Add a new node
  const handleAddNode = () => {
    createNodeMutation({ variables: { name: "New Node", description: "" } });
  };

  // 6.b) Delete selected nodes/edges
  const handleDeleteSelected = () => {
    // Delete selected nodes
    selectedItems.nodes.forEach((n) => {
      deleteNodeMutation({
        variables: { nodeId: n.id },
        onCompleted: () => {
          setNodes((nds) => nds.filter((x) => x.id !== n.id));
          setEdges((eds) => eds.filter((e) => e.source !== n.id && e.target !== n.id));
          const all = getSavedPositions();
          delete all[n.id];
          localStorage.setItem("node-positions", JSON.stringify(all));
        },
      });
    });
    // Delete selected edges
    selectedItems.edges.forEach((e) => {
      deleteEdgeMutation({
        variables: { edgeId: e.id },
        onCompleted: () => {
          setEdges((eds) => eds.filter((x) => x.id !== e.id));
        },
      });
    });
  };

  // 6.c) Connect two nodes when dragged
  const handleConnect = useCallback(
    (connection: Connection) => {
      const tempId = `temp-${connection.source}-${connection.target}-${Date.now()}`;
      const optimisticEdge: Edge = {
        id: tempId,
        source: connection.source!,
        target: connection.target!,
        style: { stroke: "#F97316", strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(optimisticEdge, eds));

      createEdgeMutation({
        variables: { nodeAId: connection.source!, nodeBId: connection.target!, label: "" },
        onCompleted: (res) => {
          const realEdge = res.createEdge.edge;
          setEdges((eds) =>
            eds.map((e) =>
              e.id === tempId
                ? {
                    id: realEdge.id,
                    source: realEdge.nodeA.id,
                    target: realEdge.nodeB.id,
                    label: realEdge.label || "",
                    style: { stroke: "#F97316", strokeWidth: 2 },
                  }
                : e
            )
          );
        },
        onError: () => {
          setEdges((eds) => eds.filter((e) => e.id !== tempId));
        },
      });
    },
    [createEdgeMutation, setEdges]
  );

  // 6.d) Click an edge to delete
  const handleEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    deleteEdgeMutation({
      variables: { edgeId: edge.id },
      onCompleted: () => {
        setEdges((eds) => eds.filter((x) => x.id !== edge.id));
      },
    });
  };

  // 6.e) Commit rename when editing is finished
  const commitRename = (nodeId: string, newName: string, newDesc: string) => {
    renameNodeMutation({
      variables: { nodeId, name: newName, description: newDesc },
      onCompleted: (res) => {
        const updatedNode = res.renameNode.node;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === updatedNode.id
              ? {
                  ...n,
                  data: {
                    name: updatedNode.name,
                    description: updatedNode.description || "",
                    files: n.data.files,
                  },
                }
              : n
          )
        );
      },
    });
  };

  // 6.f) Node drag stop: save new position
  const onNodeDragStop: NodeDragHandler = (_event, node) => {
    savePosition(node.id, node.position.x, node.position.y);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id
          ? { ...n, position: { x: node.position.x, y: node.position.y } }
          : n
      )
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 7) CustomNode: shows Name, Description, and file list
  // ─────────────────────────────────────────────────────────────────────────────
  function CustomNode({
    id,
    data,
    selected,
  }: NodeProps<{ name: string; description: string; files: string[] }>) {
    const [currentName, setCurrentName] = useState(data.name);
    const [currentDesc, setCurrentDesc] = useState(data.description);

    // 7.a) Commit rename on blur or Enter
    const handleBlurOrEnter = (
      e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement> | React.KeyboardEvent,
      isTextArea: boolean = false
    ) => {
      if (!isTextArea && "key" in e && e.key !== "Enter") return;
      if (currentName !== data.name || currentDesc !== data.description) {
        commitRename(id, currentName, currentDesc);
      }
    };

    // 7.b) Style for circular Handles
    const handleStyle: React.CSSProperties = {
      background: "#F97316",
      width: 14,
      height: 14,
      borderRadius: "50%",
      cursor: "pointer",
    };

    return (
      <div
        className={`bg-neutral-800/75 backdrop-blur-sm rounded-xl p-4 w-48 select-none ${
          selected ? "ring-2 ring-orange-500" : ""
        }`}
        style={{ fontFamily: "'Segoe UI', sans-serif", color: "#F1F5F9" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Handle type="target" position={Position.Left} style={handleStyle} />

        {/* Name field */}
        <div className="mb-3">
          <label htmlFor={`name-${id}`} className="block text-gray-300 text-xs mb-1">
            Name
          </label>
          <input
            id={`name-${id}`}
            type="text"
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
            onBlur={(e) => handleBlurOrEnter(e)}
            onKeyDown={(e) => handleBlurOrEnter(e)}
            className="
              w-full px-2 py-1
              bg-neutral-700 text-white
              border border-neutral-600
              rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-500
            "
          />
        </div>

        {/* Description field */}
        <div className="mb-3">
          <label htmlFor={`desc-${id}`} className="block text-gray-300 text-xs mb-1">
            Description
          </label>
          <textarea
            id={`desc-${id}`}
            value={currentDesc}
            onChange={(e) => setCurrentDesc(e.target.value)}
            onBlur={(e) => handleBlurOrEnter(e, true)}
            rows={2}
            className="
              w-full px-2 py-1
              bg-neutral-700 text-white
              border border-neutral-600
              rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-500
              resize-vertical
            "
          />
        </div>

        {/* File List */}
        <div className="mb-2">
          <div className="mb-1">
            <span className="text-gray-300 font-medium text-xs">Files</span>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {data.files.length > 0 ? (
              data.files.map((f, idx) => (
                <li key={idx} className="flex items-center space-x-1 text-xs text-neutral-100">
                  <FileText size={12} className="text-orange-500" />
                  <span className="truncate">{f}</span>
                </li>
              ))
            ) : (
              <li className="text-gray-400 italic text-xs">(no files)</li>
            )}
          </ul>
        </div>

        <Handle type="source" position={Position.Right} style={handleStyle} />
      </div>
    );
  }

  // Memoize nodeTypes so React Flow doesn’t warn about recreation
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Early returns must remain *after* hooks
  // ─────────────────────────────────────────────────────────────────────────────
  if (nodesLoading) return <div>Loading map…</div>;
  if (nodesError) return <div>Error loading nodes: {nodesError.message}</div>;

  // ─────────────────────────────────────────────────────────────────────────────
  // 8) Render: header + React Flow
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">
      {/* Header with + and – icons */}
      <header className="flex items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm">
        <div className="text-2xl font-extrabold">
          <span className="text-red-500">V</span>
          <span className="text-white">ault</span>
        </div>
        <div className="flex items-center space-x-4">
          {/* + Add Node */}
          <button
            onClick={handleAddNode}
            className="p-2 bg-orange-500 rounded-full hover:bg-red-600 transition-colors"
            title="Add Node"
          >
            <Plus size={16} className="text-white" />
          </button>

          {/* – Delete Selected */}
          <button
            onClick={handleDeleteSelected}
            className="p-2 bg-orange-500 rounded-full hover:bg-red-600 transition-colors"
            title="Delete Selected"
          >
            <Minus size={16} className="text-white" />
          </button>

          <span className="text-gray-200 font-medium">{user?.username}</span>
          <button
            onClick={logout}
            className="px-4 py-2 bg-orange-500 text-white rounded-md font-medium shadow hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* React Flow canvas */}
      <div className="flex-1" style={{ background: "#2D2D2D" }}>
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
            style={{ background: "#2D2D2D" }}
          >
            <Controls style={{ background: "transparent" }} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
