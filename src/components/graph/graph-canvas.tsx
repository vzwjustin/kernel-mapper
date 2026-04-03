'use client'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  Panel,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeMouseHandler,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { v4 as uuidv4 } from 'uuid'
import { useGraphStore } from '@/stores/graph-store'
import { nodeTypes } from './nodes'

// ---------------------------------------------------------------------------
// Default data shapes for newly dropped nodes
// ---------------------------------------------------------------------------

function defaultNodeData(type: string, id: string): Record<string, unknown> {
  switch (type) {
    case 'apiRoot':
      return {
        label: 'New API',
        nodeType: 'API_ROOT',
        transport: 'GENERIC_NETLINK',
        status: 'DRAFT',
        version: 1,
        family: 'New API',
      }
    case 'transport':
      return {
        label: 'Transport',
        nodeType: 'TRANSPORT',
        transportKind: 'GENERIC_NETLINK',
        family: null,
        devicePath: null,
      }
    case 'command':
      return {
        label: 'New Command',
        nodeType: 'COMMAND',
        commandId: id,
        interactionStyle: 'REQUEST_RESPONSE',
        privilegeRequirement: null,
        idempotent: false,
        deprecated: false,
      }
    case 'event':
      return {
        label: 'New Event',
        nodeType: 'EVENT',
        eventId: id,
        subscriptionModel: 'MULTICAST',
        filteringSupport: false,
      }
    case 'struct':
      return {
        label: 'NewStruct',
        nodeType: 'REQUEST_STRUCT',
        typeDefId: id,
        commandId: '',
        fieldCount: 0,
      }
    case 'enum':
      return {
        label: 'NewEnum',
        nodeType: 'ENUM_FLAGS',
        typeDefId: id,
        kind: 'ENUM',
        variantCount: 0,
      }
    case 'permission':
      return {
        label: 'CAP_NET_ADMIN',
        nodeType: 'PERMISSION',
        permissionId: id,
        capability: 'CAP_NET_ADMIN',
        namespaceAware: false,
      }
    case 'warning':
      return {
        label: 'Warning',
        nodeType: 'WARNING_ISSUE',
        findingId: id,
        severity: 'WARNING',
        code: 'W001',
        group: 'general',
        confidence: 'MEDIUM',
        impactedNodeIds: [],
      }
    default:
      return { label: 'Node', nodeType: type }
  }
}

// ---------------------------------------------------------------------------
// Inner canvas — must be inside ReactFlowProvider
// ---------------------------------------------------------------------------

function GraphCanvasInner() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const addNode = useGraphStore((s) => s.addNode)
  const storeAddEdge = useGraphStore((s) => s.addEdge)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const clearSelection = useGraphStore((s) => s.clearSelection)

  // Sync React Flow node changes back to the store
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNodes(applyNodeChanges(changes, nodes) as any)
    },
    [nodes, setNodes]
  )

  // Sync React Flow edge changes back to the store
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges))
    },
    [edges, setEdges]
  )

  // Create an edge when the user draws a connection
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge(connection, edges)
      setEdges(newEdges)
      // Also persist via store's addEdge for the last newly-added edge
      const added = newEdges.find((e) => !edges.some((ex) => ex.id === e.id))
      if (added) storeAddEdge(added)
    },
    [edges, setEdges, storeAddEdge]
  )

  // Select a node on click
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  // Deselect when clicking canvas background
  const onPaneClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  // Handle drag-over (must prevent default to allow drop)
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // Create a new node when a palette item is dropped
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/kernelcanvas-node-type')
      if (!type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const id = uuidv4()
      const data = defaultNodeData(type, id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addNode({ id, type, position, data: data as any })
    },
    [screenToFlowPosition, addNode]
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950"
      style={{ minHeight: '100%' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        className="dark"
        fitView
        deleteKeyCode="Delete"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#334155"
        />

        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'apiRoot':    return '#7c3aed'
              case 'transport':  return '#0891b2'
              case 'command':    return '#2563eb'
              case 'event':      return '#7c3aed'
              case 'struct':     return '#16a34a'
              case 'enum':       return '#ea580c'
              case 'permission': return '#dc2626'
              case 'warning':    return '#ca8a04'
              default:           return '#475569'
            }
          }}
          className="!bg-slate-900 !border !border-slate-700/60"
          maskColor="rgba(15,23,42,0.7)"
        />

        <Controls className="[&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700" />

        <Panel position="top-right" className="flex gap-2">
          <div className="text-[10px] text-slate-500 bg-slate-900/80 border border-slate-700/60 rounded px-2 py-1 select-none">
            Drag nodes from the palette — connect handles to wire
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exported component — wraps inner canvas in a ReactFlowProvider
// ---------------------------------------------------------------------------

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  )
}
