// ============================================================
// KernelCanvas — Graph Types (React Flow editor)
// ============================================================
// These types define the node and edge shapes used in the
// KernelCanvas visual schema editor. They extend the base
// React Flow Node/Edge types with KernelCanvas-specific data.
//
// Import pattern:
//   import type { KernelNode, KernelEdge, ... } from '@/types/graph'
// ============================================================

import type { Node, Edge, XYPosition } from '@xyflow/react'

// ------------------------------------------------------------
// Node type enum
// ------------------------------------------------------------

/**
 * All node types that can appear in the KernelCanvas graph.
 * These correspond to React Flow's `type` field and must be
 * registered in the nodeTypes map passed to <ReactFlow>.
 */
export type KernelNodeType =
  | 'API_ROOT'           // Top-level schema / API family node
  | 'TRANSPORT'          // Transport mechanism (netlink family, ioctl, char device)
  | 'COMMAND'            // A kernel command (request/response or one-way)
  | 'EVENT'              // An async event emitted from kernel to userspace
  | 'REQUEST_STRUCT'     // TypeDef used as request payload for a command
  | 'RESPONSE_STRUCT'    // TypeDef used as response payload for a command
  | 'ENUM_FLAGS'         // TypeDef of kind ENUM or FLAGS
  | 'FIELD'              // A single TypeField within a struct/enum
  | 'PERMISSION'         // A Linux capability / permission requirement
  | 'VALIDATOR'          // A validation finding or constraint node
  | 'COMPATIBILITY'      // ABI compatibility / version-diff annotation node
  | 'KERNEL_HANDLER'     // Kernel-side handler function stub (generated scaffold)
  | 'USERSPACE_BINDING'  // Userspace client binding (generated TS/C helper)
  | 'DOCS_EXAMPLE'       // Generated documentation or usage example node
  | 'WARNING_ISSUE'      // Surfaced validation finding with severity indicator
  | 'IMPORT_DISCOVERED'  // Entity discovered during repo import, awaiting review

// ------------------------------------------------------------
// Edge type enum
// ------------------------------------------------------------

/**
 * Semantic edge kinds between graph nodes.
 * These are used to style edges differently and convey relationship meaning.
 */
export type KernelEdgeType =
  | 'USES_TRANSPORT'     // API_ROOT → TRANSPORT
  | 'HAS_COMMAND'        // API_ROOT → COMMAND
  | 'HAS_EVENT'          // API_ROOT → EVENT
  | 'REQUEST_PAYLOAD'    // COMMAND → REQUEST_STRUCT
  | 'RESPONSE_PAYLOAD'   // COMMAND → RESPONSE_STRUCT
  | 'EVENT_PAYLOAD'      // EVENT → (struct type)
  | 'HAS_FIELD'          // struct/enum node → FIELD
  | 'FIELD_TYPE_REF'     // FIELD → another struct/enum (type reference)
  | 'REQUIRES_PERMISSION'// COMMAND or EVENT → PERMISSION
  | 'REPLACED_BY'        // deprecated COMMAND → replacement COMMAND
  | 'ALIAS_OF'           // ALIAS TypeDef → target TypeDef
  | 'TRIGGERS_HANDLER'   // COMMAND → KERNEL_HANDLER
  | 'BINDING_FOR'        // USERSPACE_BINDING → COMMAND or EVENT
  | 'VALIDATES'          // VALIDATOR → any node it constrains
  | 'IMPORTED_AS'        // IMPORT_DISCOVERED → the entity it maps to

// ------------------------------------------------------------
// Shared base data carried by every node
// ------------------------------------------------------------

/**
 * Fields present on every KernelCanvas node regardless of type.
 * React Flow requires NodeData to extend Record<string, unknown>.
 */
export interface BaseNodeData extends Record<string, unknown> {
  /** Display label shown in the node header. */
  label: string
  /** The KernelCanvas node type (mirrors Node.type but typed). */
  nodeType: KernelNodeType
  /** The schema ID this node belongs to (absent for IMPORT_DISCOVERED). */
  schemaId?: string
  /** Optional short description shown below the label. */
  description?: string | null
  /** Whether this node is currently selected in the editor. */
  isSelected?: boolean
  /** Whether this node is pinned and should not be moved by auto-layout. */
  isPinned?: boolean
  /** Whether the user has collapsed this node (hides children). */
  isCollapsed?: boolean
}

// ------------------------------------------------------------
// Per-type node data interfaces
// ------------------------------------------------------------

export interface ApiRootNodeData extends BaseNodeData {
  nodeType: 'API_ROOT'
  transport: string
  status: string
  version: number
  namespace?: string | null
  family?: string | null
}

export interface TransportNodeData extends BaseNodeData {
  nodeType: 'TRANSPORT'
  transportKind: 'GENERIC_NETLINK' | 'IOCTL' | 'CHAR_DEVICE'
  family?: string | null
  devicePath?: string | null
}

export interface CommandNodeData extends BaseNodeData {
  nodeType: 'COMMAND'
  /** Backing domain entity ID. */
  commandId: string
  interactionStyle: string
  privilegeRequirement?: string | null
  idempotent: boolean
  deprecated: boolean
  introducedVersion?: number | null
}

export interface EventNodeData extends BaseNodeData {
  nodeType: 'EVENT'
  eventId: string
  subscriptionModel: string
  filteringSupport: boolean
  introducedVersion?: number | null
}

export interface RequestStructNodeData extends BaseNodeData {
  nodeType: 'REQUEST_STRUCT'
  typeDefId: string
  /** ID of the command this is a request type for. */
  commandId: string
  fieldCount: number
}

export interface ResponseStructNodeData extends BaseNodeData {
  nodeType: 'RESPONSE_STRUCT'
  typeDefId: string
  commandId: string
  fieldCount: number
}

export interface EnumFlagsNodeData extends BaseNodeData {
  nodeType: 'ENUM_FLAGS'
  typeDefId: string
  kind: 'ENUM' | 'FLAGS'
  variantCount: number
}

export interface FieldNodeData extends BaseNodeData {
  nodeType: 'FIELD'
  fieldId: string
  /** ID of the parent TypeDef. */
  typeDefId: string
  fieldType: string
  optional: boolean
  reserved: boolean
  sortOrder: number
}

export interface PermissionNodeData extends BaseNodeData {
  nodeType: 'PERMISSION'
  permissionId: string
  capability: string
  namespaceAware: boolean
}

export interface ValidatorNodeData extends BaseNodeData {
  nodeType: 'VALIDATOR'
  /** Validation rule expression. */
  rule: string
  /** The field or node IDs this validator applies to. */
  targetIds: string[]
}

export interface CompatibilityNodeData extends BaseNodeData {
  nodeType: 'COMPATIBILITY'
  changeClassification: 'SAFE' | 'RISKY' | 'BREAKING'
  fromVersion: number
  toVersion: number
  /** Short prose summary of what changed. */
  changeSummary?: string | null
}

export interface KernelHandlerNodeData extends BaseNodeData {
  nodeType: 'KERNEL_HANDLER'
  /** The command ID this handler services. */
  commandId: string
  /** Generated C function name. */
  handlerFnName: string
  /** Whether scaffold code has been emitted for this handler. */
  scaffoldGenerated: boolean
}

export interface UserspaceBindingNodeData extends BaseNodeData {
  nodeType: 'USERSPACE_BINDING'
  /** Language of the generated binding. */
  language: string
  /** The artifact ID of the generated binding. */
  artifactId?: string
  /** The command or event ID this binding is for. */
  targetId: string
}

export interface DocsExampleNodeData extends BaseNodeData {
  nodeType: 'DOCS_EXAMPLE'
  artifactId?: string
  exampleKind: 'CLI_SNIPPET' | 'C_SNIPPET' | 'TS_SNIPPET' | 'PROSE'
  /** The entity (command/event) this example demonstrates. */
  targetId: string
}

export interface WarningIssueNodeData extends BaseNodeData {
  nodeType: 'WARNING_ISSUE'
  findingId: string
  severity: 'ERROR' | 'WARNING' | 'INFO'
  code: string
  group: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  /** IDs of the graph nodes this warning is attached to. */
  impactedNodeIds: string[]
}

export interface ImportDiscoveredNodeData extends BaseNodeData {
  nodeType: 'IMPORT_DISCOVERED'
  /** Source file path this was found in. */
  sourceFile: string
  /** Raw extracted name before mapping to domain entities. */
  rawName: string
  /** Whether the user has reviewed and accepted this import. */
  reviewed: boolean
  /** The domain entity ID this was resolved to, if resolved. */
  resolvedEntityId?: string | null
}

// ------------------------------------------------------------
// Discriminated union of all node data types
// ------------------------------------------------------------

export type KernelNodeData =
  | ApiRootNodeData
  | TransportNodeData
  | CommandNodeData
  | EventNodeData
  | RequestStructNodeData
  | ResponseStructNodeData
  | EnumFlagsNodeData
  | FieldNodeData
  | PermissionNodeData
  | ValidatorNodeData
  | CompatibilityNodeData
  | KernelHandlerNodeData
  | UserspaceBindingNodeData
  | DocsExampleNodeData
  | WarningIssueNodeData
  | ImportDiscoveredNodeData

// ------------------------------------------------------------
// Typed React Flow node and edge aliases
// ------------------------------------------------------------

/** A React Flow node carrying KernelCanvas-typed data. */
export type KernelNode = Node<KernelNodeData, KernelNodeType>

/** Per-type React Flow node aliases for use in node component props. */
export type ApiRootNode = Node<ApiRootNodeData, 'API_ROOT'>
export type TransportNode = Node<TransportNodeData, 'TRANSPORT'>
export type CommandNode = Node<CommandNodeData, 'COMMAND'>
export type EventNode = Node<EventNodeData, 'EVENT'>
export type RequestStructNode = Node<RequestStructNodeData, 'REQUEST_STRUCT'>
export type ResponseStructNode = Node<ResponseStructNodeData, 'RESPONSE_STRUCT'>
export type EnumFlagsNode = Node<EnumFlagsNodeData, 'ENUM_FLAGS'>
export type FieldNode = Node<FieldNodeData, 'FIELD'>
export type PermissionNode = Node<PermissionNodeData, 'PERMISSION'>
export type ValidatorNode = Node<ValidatorNodeData, 'VALIDATOR'>
export type CompatibilityNode = Node<CompatibilityNodeData, 'COMPATIBILITY'>
export type KernelHandlerNode = Node<KernelHandlerNodeData, 'KERNEL_HANDLER'>
export type UserspaceBindingNode = Node<UserspaceBindingNodeData, 'USERSPACE_BINDING'>
export type DocsExampleNode = Node<DocsExampleNodeData, 'DOCS_EXAMPLE'>
export type WarningIssueNode = Node<WarningIssueNodeData, 'WARNING_ISSUE'>
export type ImportDiscoveredNode = Node<ImportDiscoveredNodeData, 'IMPORT_DISCOVERED'>

// ------------------------------------------------------------
// Edge data
// ------------------------------------------------------------

/** Data carried on every KernelCanvas edge. */
export interface KernelEdgeData extends Record<string, unknown> {
  /** Semantic relationship kind. */
  edgeType: KernelEdgeType
  /** Human-readable label shown on the edge (optional). */
  label?: string
  /** Whether this edge is currently highlighted (e.g. on hover). */
  highlighted?: boolean
  /** Whether this edge represents a deprecated / superseded relationship. */
  deprecated?: boolean
}

/** A React Flow edge carrying KernelCanvas-typed data. */
export type KernelEdge = Edge<KernelEdgeData>

// ------------------------------------------------------------
// Layout types
// ------------------------------------------------------------

/** Supported Dagre/ELK layout directions. */
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL'

/** Layout algorithm choices. */
export type LayoutAlgorithm = 'dagre' | 'elk' | 'manual'

export interface GraphLayoutConfig {
  algorithm: LayoutAlgorithm
  direction: LayoutDirection
  /** Vertical gap between rank levels (Dagre ranksep). */
  rankSep: number
  /** Horizontal gap between nodes in the same rank (Dagre nodesep). */
  nodeSep: number
  /** Whether to automatically re-layout on schema changes. */
  autoLayout: boolean
  /** Padding around the entire graph viewport. */
  padding: number
}

export const DEFAULT_LAYOUT_CONFIG: GraphLayoutConfig = {
  algorithm: 'dagre',
  direction: 'TB',
  rankSep: 80,
  nodeSep: 50,
  autoLayout: false,
  padding: 40,
}

// ------------------------------------------------------------
// Graph snapshot (full serializable graph state)
// ------------------------------------------------------------

/**
 * A point-in-time snapshot of the graph used for undo/redo,
 * persistence, and schema-sync.
 */
export interface GraphSnapshot {
  nodes: KernelNode[]
  edges: KernelEdge[]
  /** ISO timestamp of when this snapshot was taken. */
  capturedAt: string
}

// ------------------------------------------------------------
// Viewport
// ------------------------------------------------------------

export interface GraphViewport {
  x: number
  y: number
  zoom: number
}

// ------------------------------------------------------------
// Node factory helpers — position initialisation
// ------------------------------------------------------------

/** Default size hints for each node type (used by layout algorithms). */
export const NODE_SIZE: Record<KernelNodeType, { width: number; height: number }> = {
  API_ROOT:           { width: 220, height: 80 },
  TRANSPORT:          { width: 180, height: 60 },
  COMMAND:            { width: 200, height: 72 },
  EVENT:              { width: 200, height: 72 },
  REQUEST_STRUCT:     { width: 180, height: 64 },
  RESPONSE_STRUCT:    { width: 180, height: 64 },
  ENUM_FLAGS:         { width: 160, height: 56 },
  FIELD:              { width: 160, height: 48 },
  PERMISSION:         { width: 160, height: 56 },
  VALIDATOR:          { width: 160, height: 56 },
  COMPATIBILITY:      { width: 200, height: 64 },
  KERNEL_HANDLER:     { width: 200, height: 64 },
  USERSPACE_BINDING:  { width: 200, height: 64 },
  DOCS_EXAMPLE:       { width: 180, height: 56 },
  WARNING_ISSUE:      { width: 200, height: 72 },
  IMPORT_DISCOVERED:  { width: 200, height: 64 },
}

/** Helper: create a minimal KernelNode with a default position. */
export function makeNode<T extends KernelNodeData>(
  id: string,
  type: KernelNodeType,
  data: T,
  position: XYPosition = { x: 0, y: 0 }
): Node<T> {
  return { id, type, data, position }
}
