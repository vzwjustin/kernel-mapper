import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

// ---------------------------------------------------------------------------
// Graph-specific types — inline until @/types/graph is created
// ---------------------------------------------------------------------------

export type GraphNodeType =
  | 'command'
  | 'event'
  | 'typeDef'
  | 'entry'
  | 'group'

export interface NodeData extends Record<string, unknown> {
  label: string
  nodeType: GraphNodeType
  schemaId?: string
  description?: string
  isSelected?: boolean
}

export interface GraphLayoutConfig {
  direction: 'TB' | 'LR' | 'BT' | 'RL'
  rankSep: number
  nodeSep: number
  autoLayout: boolean
}

// Snapshot stored for undo/redo
interface HistoryEntry {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

// ---------------------------------------------------------------------------
// Store state and actions
// ---------------------------------------------------------------------------

interface GraphState {
  // React Flow data
  nodes: Node<NodeData>[]
  edges: Edge[]

  // Selection
  selectedNodeId: string | null
  selectedEdgeId: string | null

  // Layout config
  layoutConfig: GraphLayoutConfig

  // Undo/redo
  history: HistoryEntry[]
  historyIndex: number // points at the current position in history

  // Dirty tracking
  hasUnsavedChanges: boolean

  // Node actions
  addNode: (node: Node<NodeData>) => void
  removeNode: (id: string) => void
  updateNodeData: (id: string, data: Partial<NodeData>) => void
  setNodes: (nodes: Node<NodeData>[]) => void

  // Edge actions
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void
  setEdges: (edges: Edge[]) => void

  // Selection actions
  setSelectedNodeId: (id: string | null) => void
  setSelectedEdgeId: (id: string | null) => void
  clearSelection: () => void

  // Layout config
  setLayoutConfig: (config: Partial<GraphLayoutConfig>) => void

  // Sync actions
  syncFromSchema: (nodes: Node<NodeData>[], edges: Edge[]) => void
  syncToSchema: () => { nodes: Node<NodeData>[]; edges: Edge[] }

  // Undo/redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  pushHistory: () => void

  // Dirty tracking
  markClean: () => void
}

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50

function pushToHistory(
  history: HistoryEntry[],
  index: number,
  nodes: Node<NodeData>[],
  edges: Edge[]
): { history: HistoryEntry[]; historyIndex: number } {
  // Discard any forward history beyond current index
  const trimmed = history.slice(0, index + 1)
  const next = [...trimmed, { nodes, edges }]
  // Enforce max history depth
  const clamped = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
  return { history: clamped, historyIndex: clamped.length - 1 }
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphState>()((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  layoutConfig: {
    direction: 'TB',
    rankSep: 80,
    nodeSep: 50,
    autoLayout: false,
  },
  history: [],
  historyIndex: -1,
  hasUnsavedChanges: false,

  // Node actions
  addNode: (node) =>
    set((state) => {
      const nodes = [...state.nodes, node]
      const { history, historyIndex } = pushToHistory(
        state.history,
        state.historyIndex,
        state.nodes,
        state.edges
      )
      return { nodes, history, historyIndex, hasUnsavedChanges: true }
    }),

  removeNode: (id) =>
    set((state) => {
      const nodes = state.nodes.filter((n) => n.id !== id)
      // Also remove connected edges
      const edges = state.edges.filter((e) => e.source !== id && e.target !== id)
      const { history, historyIndex } = pushToHistory(
        state.history,
        state.historyIndex,
        state.nodes,
        state.edges
      )
      return {
        nodes,
        edges,
        history,
        historyIndex,
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        hasUnsavedChanges: true,
      }
    }),

  updateNodeData: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
      hasUnsavedChanges: true,
    })),

  setNodes: (nodes) => set({ nodes, hasUnsavedChanges: true }),

  // Edge actions
  addEdge: (edge) =>
    set((state) => {
      const edges = [...state.edges, edge]
      const { history, historyIndex } = pushToHistory(
        state.history,
        state.historyIndex,
        state.nodes,
        state.edges
      )
      return { edges, history, historyIndex, hasUnsavedChanges: true }
    }),

  removeEdge: (id) =>
    set((state) => {
      const edges = state.edges.filter((e) => e.id !== id)
      const { history, historyIndex } = pushToHistory(
        state.history,
        state.historyIndex,
        state.nodes,
        state.edges
      )
      return {
        edges,
        history,
        historyIndex,
        selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
        hasUnsavedChanges: true,
      }
    }),

  setEdges: (edges) => set({ edges, hasUnsavedChanges: true }),

  // Selection actions
  setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),

  // Layout config
  setLayoutConfig: (config) =>
    set((state) => ({
      layoutConfig: { ...state.layoutConfig, ...config },
    })),

  // Sync from schema: replaces graph state with schema-derived nodes and edges,
  // snapshots history, and resets dirty flag.
  syncFromSchema: (nodes, edges) => {
    set((state) => {
      const { history, historyIndex } = pushToHistory(
        state.history,
        state.historyIndex,
        state.nodes,
        state.edges
      )
      return {
        nodes,
        edges,
        history,
        historyIndex,
        selectedNodeId: null,
        selectedEdgeId: null,
        hasUnsavedChanges: false,
      }
    })
  },

  // syncToSchema: returns current nodes and edges for the caller to extract
  // schema data from. Does not mutate store state.
  syncToSchema: () => {
    const { nodes, edges } = get()
    return { nodes, edges }
  },

  // Undo/redo
  pushHistory: () =>
    set((state) => {
      const { history, historyIndex } = pushToHistory(
        state.history,
        state.historyIndex,
        state.nodes,
        state.edges
      )
      return { history, historyIndex }
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state
      const prevIndex = state.historyIndex - 1
      const entry = state.history[prevIndex]
      return {
        nodes: entry.nodes,
        edges: entry.edges,
        historyIndex: prevIndex,
        selectedNodeId: null,
        selectedEdgeId: null,
        hasUnsavedChanges: true,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const nextIndex = state.historyIndex + 1
      const entry = state.history[nextIndex]
      return {
        nodes: entry.nodes,
        edges: entry.edges,
        historyIndex: nextIndex,
        selectedNodeId: null,
        selectedEdgeId: null,
        hasUnsavedChanges: true,
      }
    }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // Dirty tracking
  markClean: () => set({ hasUnsavedChanges: false }),
}))
