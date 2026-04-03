// ============================================================
// KernelCanvas — API Request / Response Types
// ============================================================
// Shapes for all Next.js API route payloads.
// Server routes live under /app/api/**.
// Client callers import these for type-safe fetch wrappers.
//
// Conventions:
//   - Request types: <Verb><Resource>Request
//   - Response types: <Verb><Resource>Response
//   - Streaming responses are modelled as union discriminants
//     on a `type` field so the caller can switch on event kind.
// ============================================================

import type {
  Project,
  ApiSchema,
  Command,
  Event,
  TypeDef,
  TypeField,
  EnumVariant,
  Permission,
  GeneratedArtifact,
  ValidationFinding,
  ValidationReport,
  SchemaVersion,
  AiInteraction,
  Transport,
  SchemaStatus,
  ArtifactType,
  AiMode,
  ChangeClassification,
} from './domain'

// ============================================================
// Shared envelope types
// ============================================================

/**
 * Standard success envelope wrapping all non-streaming API responses.
 * API routes SHOULD return this rather than raw data so clients have
 * a uniform shape to handle.
 */
export interface ApiSuccess<T> {
  ok: true
  data: T
}

/**
 * Standard error envelope returned when a route responds with a 4xx/5xx.
 */
export interface ApiError {
  ok: false
  /** Human-readable error message. */
  error: string
  /** Machine-readable error code, e.g. "NOT_FOUND", "VALIDATION_FAILED". */
  code?: string
  /** Per-field validation errors, keyed by field name. */
  fieldErrors?: Record<string, string[]>
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ============================================================
// Projects
// ============================================================

// POST /api/projects
export interface CreateProjectRequest {
  name: string
  description?: string
  /** Semver range of Linux kernel versions targeted, e.g. ">=6.1 <7.0". */
  targetKernelRange?: string
  /** Comma-separated userspace language targets, e.g. "C,TypeScript". */
  targetUserspaceLanguages?: string
}

export type CreateProjectResponse = ApiResponse<Project>

// GET /api/projects
export interface ListProjectsResponse {
  ok: true
  data: Project[]
}

// GET /api/projects/:id
export type GetProjectResponse = ApiResponse<Project & { schemas: ApiSchema[] }>

// PATCH /api/projects/:id
export interface UpdateProjectRequest {
  name?: string
  description?: string
  targetKernelRange?: string
  targetUserspaceLanguages?: string
  generatorVersion?: string
}

export type UpdateProjectResponse = ApiResponse<Project>

// DELETE /api/projects/:id
export type DeleteProjectResponse = ApiResponse<{ id: string }>

// ============================================================
// Schemas
// ============================================================

// POST /api/projects/:projectId/schemas
export interface CreateSchemaRequest {
  transport: Transport
  /** Generic Netlink family name or ioctl device node path. */
  namespace?: string
  /** Generic Netlink family string (netlink-specific). */
  family?: string
  summary?: string
  compatibilityPolicy?: string
  permissionsModel?: string
  notes?: string
}

export type CreateSchemaResponse = ApiResponse<ApiSchema>

// GET /api/projects/:projectId/schemas
export type ListSchemasResponse = ApiResponse<ApiSchema[]>

// GET /api/schemas/:id
export type GetSchemaResponse = ApiResponse<
  ApiSchema & {
    commands: Command[]
    events: Event[]
    typeDefs: TypeDef[]
    permissions: Permission[]
    artifacts: GeneratedArtifact[]
    versions: SchemaVersion[]
  }
>

// PATCH /api/schemas/:id
export interface UpdateSchemaRequest {
  transport?: Transport
  namespace?: string
  family?: string
  summary?: string
  compatibilityPolicy?: string
  permissionsModel?: string
  notes?: string
  status?: SchemaStatus
}

export type UpdateSchemaResponse = ApiResponse<ApiSchema>

// DELETE /api/schemas/:id
export type DeleteSchemaResponse = ApiResponse<{ id: string }>

// ============================================================
// Commands
// ============================================================

// POST /api/schemas/:schemaId/commands
export interface CreateCommandRequest {
  name: string
  description?: string
  requestTypeId?: string
  responseTypeId?: string
  interactionStyle?: 'REQUEST_RESPONSE' | 'STREAMING' | 'FIRE_AND_FORGET'
  privilegeRequirement?: string
  idempotent?: boolean
  introducedVersion?: number
}

export type CreateCommandResponse = ApiResponse<Command>

// PATCH /api/commands/:id
export interface UpdateCommandRequest {
  name?: string
  description?: string
  requestTypeId?: string | null
  responseTypeId?: string | null
  interactionStyle?: 'REQUEST_RESPONSE' | 'STREAMING' | 'FIRE_AND_FORGET'
  privilegeRequirement?: string | null
  idempotent?: boolean
  deprecated?: boolean
  replacementCommandId?: string | null
  introducedVersion?: number | null
}

export type UpdateCommandResponse = ApiResponse<Command>

// DELETE /api/commands/:id
export type DeleteCommandResponse = ApiResponse<{ id: string }>

// ============================================================
// Events
// ============================================================

// POST /api/schemas/:schemaId/events
export interface CreateEventRequest {
  name: string
  payloadTypeId?: string
  subscriptionModel?: 'MULTICAST' | 'UNICAST'
  deliveryNotes?: string
  filteringSupport?: boolean
  rateLimitNotes?: string
  introducedVersion?: number
}

export type CreateEventResponse = ApiResponse<Event>

// PATCH /api/events/:id
export interface UpdateEventRequest {
  name?: string
  payloadTypeId?: string | null
  subscriptionModel?: 'MULTICAST' | 'UNICAST'
  deliveryNotes?: string | null
  filteringSupport?: boolean
  rateLimitNotes?: string | null
  introducedVersion?: number | null
}

export type UpdateEventResponse = ApiResponse<Event>

// DELETE /api/events/:id
export type DeleteEventResponse = ApiResponse<{ id: string }>

// ============================================================
// TypeDefs, TypeFields, EnumVariants
// ============================================================

// POST /api/schemas/:schemaId/types
export interface CreateTypeDefRequest {
  name: string
  kind: 'STRUCT' | 'ENUM' | 'FLAGS' | 'SCALAR' | 'ALIAS'
  description?: string
  introducedVersion?: number
}

export type CreateTypeDefResponse = ApiResponse<TypeDef>

// PATCH /api/types/:id
export interface UpdateTypeDefRequest {
  name?: string
  description?: string | null
  introducedVersion?: number | null
}

export type UpdateTypeDefResponse = ApiResponse<TypeDef & { fields: TypeField[]; enumVariants: EnumVariant[] }>

// DELETE /api/types/:id
export type DeleteTypeDefResponse = ApiResponse<{ id: string }>

// POST /api/types/:typeDefId/fields
export interface CreateTypeFieldRequest {
  name: string
  fieldType: string
  description?: string
  optional?: boolean
  reserved?: boolean
  validationRules?: string
  sortOrder?: number
}

export type CreateTypeFieldResponse = ApiResponse<TypeField>

// PATCH /api/fields/:id
export interface UpdateTypeFieldRequest {
  name?: string
  fieldType?: string
  description?: string | null
  optional?: boolean
  reserved?: boolean
  validationRules?: string | null
  sortOrder?: number
}

export type UpdateTypeFieldResponse = ApiResponse<TypeField>

// DELETE /api/fields/:id
export type DeleteTypeFieldResponse = ApiResponse<{ id: string }>

// POST /api/types/:typeDefId/variants
export interface CreateEnumVariantRequest {
  name: string
  value: number
  description?: string
  sortOrder?: number
}

export type CreateEnumVariantResponse = ApiResponse<EnumVariant>

// PATCH /api/variants/:id
export interface UpdateEnumVariantRequest {
  name?: string
  value?: number
  description?: string | null
  sortOrder?: number
}

export type UpdateEnumVariantResponse = ApiResponse<EnumVariant>

// DELETE /api/variants/:id
export type DeleteEnumVariantResponse = ApiResponse<{ id: string }>

// ============================================================
// Permissions
// ============================================================

// POST /api/schemas/:schemaId/permissions
export interface CreatePermissionRequest {
  capability: string
  description?: string
  namespaceAware?: boolean
  privilegeNotes?: string
}

export type CreatePermissionResponse = ApiResponse<Permission>

// PATCH /api/permissions/:id
export interface UpdatePermissionRequest {
  capability?: string
  description?: string | null
  namespaceAware?: boolean
  privilegeNotes?: string | null
}

export type UpdatePermissionResponse = ApiResponse<Permission>

// DELETE /api/permissions/:id
export type DeletePermissionResponse = ApiResponse<{ id: string }>

// ============================================================
// Validation
// ============================================================

// POST /api/schemas/:schemaId/validate
export interface ValidateSchemaRequest {
  /** If true, persist the findings to the DB. Default: false (dry-run). */
  persist?: boolean
  /**
   * Subset of validation groups to run.
   * Omit to run all groups.
   */
  groups?: Array<'SCHEMA_VALIDITY' | 'ABI_SAFETY' | 'WIRING_COMPLETENESS' | 'SECURITY' | 'DEVELOPER_QUALITY'>
}

export type ValidateSchemaResponse = ApiResponse<ValidationReport>

// GET /api/schemas/:schemaId/findings
export type ListFindingsResponse = ApiResponse<ValidationFinding[]>

// ============================================================
// Artifact generation
// ============================================================

// POST /api/schemas/:schemaId/generate
export interface GenerateArtifactsRequest {
  /**
   * Which artifact types to generate.
   * Omit to generate all supported types for the schema's transport.
   */
  artifactTypes?: ArtifactType[]
  /** Generator version override. Uses default if omitted. */
  generatorVersion?: string
}

export type GenerateArtifactsResponse = ApiResponse<{
  artifacts: GeneratedArtifact[]
  /** Non-fatal warnings produced during generation. */
  warnings: string[]
}>

// GET /api/schemas/:schemaId/artifacts
export type ListArtifactsResponse = ApiResponse<GeneratedArtifact[]>

// GET /api/artifacts/:id
export type GetArtifactResponse = ApiResponse<GeneratedArtifact>

// ============================================================
// Schema versions / diffs
// ============================================================

// POST /api/schemas/:schemaId/versions  (snapshot current state)
export interface CreateSchemaVersionRequest {
  changeClassification?: ChangeClassification
}

export type CreateSchemaVersionResponse = ApiResponse<SchemaVersion>

// GET /api/schemas/:schemaId/versions
export type ListSchemaVersionsResponse = ApiResponse<SchemaVersion[]>

// GET /api/versions/:id
export type GetSchemaVersionResponse = ApiResponse<SchemaVersion>

// ============================================================
// AI interactions
// ============================================================

/**
 * POST /api/ai/prompt
 *
 * Sends a prompt to the AI backend.
 * Non-streaming: returns the full interaction record once complete.
 * Streaming: set `stream: true`; the route returns Server-Sent Events.
 */
export interface AiPromptRequest {
  projectId: string
  /** The schema the user is working on, if any. */
  schemaId?: string
  mode: AiMode
  prompt: string
  /** If true, the route streams SSE chunks instead of a single JSON response. */
  stream?: boolean
  /** Model to use (e.g. "claude-sonnet-4-5"). Server default used if omitted. */
  modelId?: string
  /**
   * Additional context to inject alongside the prompt:
   * - 'SCHEMA': serialised current schema (commands, events, typeDefs)
   * - 'FINDINGS': current validation findings
   * - 'VERSIONS': recent schema version history
   */
  includeContext?: Array<'SCHEMA' | 'FINDINGS' | 'VERSIONS'>
}

/**
 * Non-streaming response: returned by POST /api/ai/prompt when stream=false.
 */
export type AiPromptResponse = ApiResponse<AiInteraction>

/**
 * Individual chunk emitted on the SSE stream.
 * The stream terminates with a DONE chunk.
 */
export type AiStreamChunk =
  | {
      type: 'TEXT_DELTA'
      /** Incremental text to append to the explanation. */
      delta: string
    }
  | {
      type: 'DIFF_READY'
      /** The proposed schema diff produced by the AI. */
      diff: string
    }
  | {
      type: 'INTERACTION_SAVED'
      /** The persisted AiInteraction record. */
      interaction: AiInteraction
    }
  | {
      type: 'ERROR'
      error: string
      code?: string
    }
  | {
      type: 'DONE'
    }

// POST /api/ai/apply  — apply a proposed diff to a schema
export interface ApplyAiDiffRequest {
  /** The AiInteraction whose proposedDiff should be applied. */
  interactionId: string
  schemaId: string
  /**
   * If true, snapshot the schema before applying.
   * Default: true.
   */
  snapshotBeforeApply?: boolean
}

export type ApplyAiDiffResponse = ApiResponse<{
  schema: ApiSchema
  version: SchemaVersion | null
  interaction: AiInteraction
}>

// ============================================================
// Repo import
// ============================================================

/**
 * POST /api/import
 *
 * Kicks off a kernel repo import job.
 * The import is async; returns a job ID immediately.
 * Poll GET /api/import/:jobId for status.
 */
export interface ImportRepoRequest {
  projectId: string
  /**
   * Path to the kernel source tree on the server,
   * or a URL to a git repository to clone.
   */
  repoPath: string
  /**
   * Subsystems to scan (e.g. ["net", "drivers/net"]).
   * Omit to scan the entire tree.
   */
  subsystems?: string[]
  /**
   * Transport hint to limit discovery to a specific mechanism.
   * Omit to discover all transports.
   */
  transport?: Transport
  /** If true, overwrite an existing import for this project. Default: false. */
  overwrite?: boolean
}

export interface ImportJobStatus {
  jobId: string
  projectId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED'
  /** Progress percentage 0–100. */
  progress: number
  /** Human-readable status message. */
  message: string
  /** ISO timestamp of when the job was started. */
  startedAt: string
  /** ISO timestamp of when the job completed (or failed). */
  completedAt: string | null
  /** Number of entities discovered so far. */
  discoveredCount: number
  /** If FAILED: the error message. */
  error: string | null
}

export type ImportRepoResponse = ApiResponse<{ jobId: string }>

// GET /api/import/:jobId
export type GetImportStatusResponse = ApiResponse<ImportJobStatus>

/**
 * POST /api/import/:jobId/apply
 *
 * Applies the discovered import entities to the given schema,
 * converting IMPORT_DISCOVERED nodes into real domain entities.
 */
export interface ApplyImportRequest {
  schemaId: string
  /** IDs of IMPORT_DISCOVERED entities to accept. Omit to accept all. */
  acceptIds?: string[]
  /** IDs of IMPORT_DISCOVERED entities to reject. */
  rejectIds?: string[]
}

export type ApplyImportResponse = ApiResponse<{
  accepted: number
  rejected: number
  schema: ApiSchema
}>

// ============================================================
// Graph sync
// ============================================================

/**
 * POST /api/schemas/:schemaId/graph/sync
 *
 * Pushes graph node position data back to the server so
 * layout is persisted across sessions.
 */
export interface SyncGraphPositionsRequest {
  /** Node positions keyed by node ID. */
  positions: Record<string, { x: number; y: number }>
}

export type SyncGraphPositionsResponse = ApiResponse<{ updated: number }>
