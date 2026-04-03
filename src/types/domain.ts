// ============================================================
// KernelCanvas — Core Domain Types
// ============================================================
// These types mirror what Prisma returns from the DB and are
// used across the full stack (server actions, API routes, UI).
// Nested relation shapes include the most common eager-loaded
// associations. When Prisma returns a flat record without
// relations, use the base interface directly.
// ============================================================

// ------------------------------------------------------------
// Primitive union types (transport, status, style, etc.)
// ------------------------------------------------------------

/** Wire transport used by the API family. */
export type Transport = 'GENERIC_NETLINK' | 'IOCTL' | 'CHAR_DEVICE'

/** Lifecycle status of a schema version. */
export type SchemaStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'

/** How a command communicates with userspace. */
export type InteractionStyle = 'REQUEST_RESPONSE' | 'STREAMING' | 'FIRE_AND_FORGET'

/** How events are delivered to subscribers. */
export type SubscriptionModel = 'MULTICAST' | 'UNICAST'

/** Structural kind of a type definition. */
export type TypeKind = 'STRUCT' | 'ENUM' | 'FLAGS' | 'SCALAR' | 'ALIAS'

/** Kind of generated artifact produced for a schema version. */
export type ArtifactType =
  | 'SCHEMA_JSON'
  | 'SCHEMA_YAML'
  | 'MARKDOWN_DOCS'
  | 'TS_CLIENT'
  | 'C_UAPI_HEADER'
  | 'KERNEL_SCAFFOLD'
  | 'EXAMPLE_CLI'
  | 'TEST_SCAFFOLD'
  | 'VALIDATION_REPORT'
  | 'DIFF_SUMMARY'

/** High-level category a validation finding belongs to. */
export type ValidationGroup =
  | 'SCHEMA_VALIDITY'
  | 'ABI_SAFETY'
  | 'WIRING_COMPLETENESS'
  | 'SECURITY'
  | 'DEVELOPER_QUALITY'

/** How bad a validation finding is. */
export type Severity = 'ERROR' | 'WARNING' | 'INFO'

/** Confidence level attached to AI-generated findings or suggestions. */
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

/** ABI impact classification of a schema diff. */
export type ChangeClassification = 'SAFE' | 'RISKY' | 'BREAKING'

/** Which AI interaction mode is active. */
export type AiMode = 'BUILD' | 'EDIT' | 'EXPLAIN' | 'AUDIT' | 'IMPORT' | 'REPAIR'

// ------------------------------------------------------------
// Project
// ------------------------------------------------------------

export interface Project {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  /** Version string of the KernelCanvas codegen engine used when the project was created. */
  generatorVersion: string
  /** Semver range of Linux kernel versions this API targets, e.g. ">=6.1 <7.0". */
  targetKernelRange: string | null
  /** Comma-separated list of target userspace language bindings, e.g. "C,TypeScript". */
  targetUserspaceLanguages: string[]

  // Relations (optional — present when fetched with include)
  schemas?: ApiSchema[]
}

// ------------------------------------------------------------
// ApiSchema
// ------------------------------------------------------------

export interface ApiSchema {
  id: string
  projectId: string
  /** Human-readable version tag, e.g. "v1", "v2-beta". */
  version: string
  transport: Transport
  /** Generic Netlink family name or ioctl device node path. */
  namespace: string
  summary: string | null
  /** Prose description of the compatibility/evolution policy. */
  compatibilityPolicy: string | null
  /** Prose description of the permission model. */
  permissionsModel: string | null
  notes: string | null
  status: SchemaStatus
  createdAt: Date
  updatedAt: Date

  // Relations (optional)
  project?: Project
  commands?: Command[]
  events?: Event[]
  typeDefs?: TypeDef[]
  permissions?: Permission[]
  artifacts?: GeneratedArtifact[]
  versions?: SchemaVersion[]
}

// ------------------------------------------------------------
// Command
// ------------------------------------------------------------

export interface Command {
  id: string
  schemaId: string
  name: string
  description: string | null
  /** Reference to the TypeDef id used as request payload. */
  requestTypeId: string | null
  /** Reference to the TypeDef id used as response payload. */
  responseTypeId: string | null
  interactionStyle: InteractionStyle
  /** Prose description of privilege requirements (capability, namespace, etc.). */
  privilegeRequirements: string | null
  /** Whether repeated identical calls are safe. */
  idempotent: boolean
  /** Documented failure modes, e.g. ["EINVAL", "EPERM"]. */
  failureModes: string[]
  introducedVersion: string | null
  deprecated: boolean
  /** id of the Command that replaces this one when deprecated. */
  replacedByCommandId: string | null
  createdAt: Date
  updatedAt: Date

  // Relations (optional)
  schema?: ApiSchema
  requestType?: TypeDef | null
  responseType?: TypeDef | null
  replacedBy?: Command | null
}

// ------------------------------------------------------------
// Event
// ------------------------------------------------------------

export interface Event {
  id: string
  schemaId: string
  name: string
  description: string | null
  /** Reference to the TypeDef id used as event payload. */
  payloadTypeId: string | null
  subscriptionModel: SubscriptionModel
  deliveryNotes: string | null
  /** Whether per-subscriber filtering is supported. */
  filteringSupported: boolean
  /** Prose description of rate-limiting policy. */
  rateLimits: string | null
  introducedVersion: string | null
  deprecated: boolean
  createdAt: Date
  updatedAt: Date

  // Relations (optional)
  schema?: ApiSchema
  payloadType?: TypeDef | null
}

// ------------------------------------------------------------
// TypeDef and TypeField
// ------------------------------------------------------------

export interface TypeDef {
  id: string
  schemaId: string
  name: string
  description: string | null
  kind: TypeKind
  /** For ALIAS kind: the id of the TypeDef being aliased. */
  aliasOfId: string | null
  /** For SCALAR kind: the underlying C/wire type, e.g. "__u32". */
  scalarType: string | null
  /** Reserved fields or extension strategy notes. */
  extensionNotes: string | null
  createdAt: Date
  updatedAt: Date

  // Relations (optional)
  schema?: ApiSchema
  fields?: TypeField[]
  aliasOf?: TypeDef | null
}

export interface TypeField {
  id: string
  typeDefId: string
  name: string
  description: string | null
  /** C/wire type string, e.g. "__u32", "__be16", or ref to another TypeDef name. */
  fieldType: string
  /** For arrays: element count, or -1 for variable-length. */
  arrayLength: number | null
  optional: boolean
  /** Whether this field is opaque (no stable layout guarantee). */
  opaque: boolean
  /** Whether this field is reserved for future ABI extension. */
  reserved: boolean
  /** Validation rule expression, e.g. "value >= 0 && value <= 255". */
  validationRule: string | null
  /** Field order within the struct/enum. */
  order: number
  createdAt: Date
  updatedAt: Date

  // Relations (optional)
  typeDef?: TypeDef
}

export interface EnumVariant {
  id: string
  typeDefId: string
  name: string
  /** Integer value of this variant. */
  value: number
  description: string | null
  deprecated: boolean
  /** id of the variant that replaces this one when deprecated. */
  replacedByVariantId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

// ------------------------------------------------------------
// Permission
// ------------------------------------------------------------

export interface Permission {
  id: string
  schemaId: string
  name: string
  description: string | null
  /** Linux capability name required, e.g. "CAP_NET_ADMIN". */
  capabilityRequired: string | null
  /** Whether a user namespace is sufficient. */
  namespaceAware: boolean
  unprivilegedAllowed: boolean
  /** Prose policy guidance for implementors. */
  policyGuidance: string | null
  createdAt: Date
  updatedAt: Date

  // Relations (optional)
  schema?: ApiSchema
}

// ------------------------------------------------------------
// GeneratedArtifact
// ------------------------------------------------------------

export interface GeneratedArtifact {
  id: string
  schemaId: string
  /** Schema version tag this artifact was generated from. */
  schemaVersion: string
  type: ArtifactType
  /** Relative path the artifact was written to (or would be written to). */
  filePath: string
  /** Full text content of the artifact. */
  content: string
  /** Version of the KernelCanvas generator that produced this artifact. */
  generatorVersion: string
  /** Non-fatal warnings produced during generation. */
  warnings: string[]
  createdAt: Date

  // Relations (optional)
  schema?: ApiSchema
}

// ------------------------------------------------------------
// ValidationFinding and ValidationReport
// ------------------------------------------------------------

export interface ValidationFinding {
  id: string
  schemaId: string
  /** Short code identifying the rule, e.g. "ABI_FIELD_REMOVAL". */
  code: string
  group: ValidationGroup
  severity: Severity
  confidence: Confidence
  explanation: string
  /** Suggested fix for the developer. */
  suggestedFix: string | null
  /** ids of graph nodes or schema entities impacted. */
  impactedNodeIds: string[]
  /** Relative file paths impacted. */
  impactedFiles: string[]
  createdAt: Date

  // Relations (optional)
  schema?: ApiSchema
}

/** Aggregate result of running the full validation suite against a schema. */
export interface ValidationReport {
  schemaId: string
  schemaVersion: string
  runAt: Date
  /** Whether all ERROR-severity findings are absent. */
  passed: boolean
  findings: ValidationFinding[]
  /** Counts by severity for quick display. */
  counts: {
    errors: number
    warnings: number
    infos: number
  }
}

// ------------------------------------------------------------
// SchemaVersion
// ------------------------------------------------------------

export interface SchemaVersion {
  id: string
  schemaId: string
  /** Monotonically increasing snapshot number. */
  snapshotNumber: number
  /** Tag at time of snapshot, e.g. "v1.2". */
  versionTag: string
  /** Full JSON snapshot of the ApiSchema at this point in time. */
  snapshotJson: string
  /** Human-readable summary of what changed from the previous version. */
  changeSummary: string | null
  classification: ChangeClassification
  createdAt: Date
  createdByAi: boolean

  // Relations (optional)
  schema?: ApiSchema
}

// ------------------------------------------------------------
// AiInteraction
// ------------------------------------------------------------

export interface AiInteraction {
  id: string
  schemaId: string | null
  projectId: string
  mode: AiMode
  /** The user's prompt text. */
  prompt: string
  /** Model identifier used, e.g. "openai/gpt-4o". */
  modelId: string
  /** Structured JSON output from the model (after validation). */
  structuredOutput: Record<string, unknown> | null
  /** Human-readable explanation produced by the model. */
  explanation: string | null
  /** JSON diff proposed by the model (not yet applied). */
  proposedDiff: string | null
  /** Whether the proposed diff was accepted and applied. */
  applied: boolean
  /** Total tokens consumed (prompt + completion). */
  tokensUsed: number | null
  /** Estimated cost in USD. */
  estimatedCostUsd: number | null
  createdAt: Date

  // Relations (optional)
  project?: Project
  schema?: ApiSchema | null
}

// ------------------------------------------------------------
// WizardState — create-from-prompt wizard
// ------------------------------------------------------------

/** Which stage of the create-from-prompt wizard is active. */
export type WizardStage =
  | 'INTENT'          // What are you building?
  | 'INTERACTION'     // Interaction style
  | 'PRIVILEGE'       // Privilege model
  | 'STABILITY'       // Stability expectations
  | 'GENERATION'      // Generation target
  | 'GENERATING'      // AI is generating
  | 'REVIEW'          // User reviews the draft

export type WizardIntent =
  | 'NETWORKING_CONTROL_PLANE'
  | 'TELEMETRY_STATS'
  | 'DRIVER_DEVICE_CONTROL'
  | 'EVENT_STREAM'
  | 'CUSTOM'

export type WizardInteractionStyle =
  | 'REQUEST_RESPONSE'
  | 'EVENTS'
  | 'STREAMING'
  | 'MIXED'

export type WizardPrivilegeModel =
  | 'ADMIN_ONLY'
  | 'MIXED_PRIVILEGED_UNPRIVILEGED'
  | 'NAMESPACE_AWARE'
  | 'CUSTOM'

export type WizardStabilityExpectation =
  | 'EXPERIMENTAL'
  | 'INTERNAL_ONLY'
  | 'STABLE_USERSPACE_CONTRACT'

export type WizardGenerationTarget =
  | 'SCHEMA_ONLY'
  | 'DOCS_AND_CLIENT'
  | 'FULL_SCAFFOLD'

export interface WizardState {
  stage: WizardStage
  /** Free-text prompt the user typed before or during the wizard. */
  freeTextPrompt: string
  intent: WizardIntent | null
  interactionStyle: WizardInteractionStyle | null
  privilegeModel: WizardPrivilegeModel | null
  stabilityExpectation: WizardStabilityExpectation | null
  generationTarget: WizardGenerationTarget | null
  /** Draft schema produced by the AI, ready for review/edit before save. */
  draftSchema: Partial<ApiSchema> | null
  /** Non-fatal warnings or assumptions the AI surfaced during generation. */
  generationWarnings: string[]
  /** Whether the AI is currently streaming a response. */
  isGenerating: boolean
  error: string | null
}
