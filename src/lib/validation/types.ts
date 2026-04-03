export type ValidationGroup =
  | 'SCHEMA_VALIDITY'
  | 'ABI_SAFETY'
  | 'WIRING_COMPLETENESS'
  | 'SECURITY'
  | 'DEVELOPER_QUALITY'

export type Severity = 'ERROR' | 'WARNING' | 'INFO'

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ValidationFinding {
  /** Unique instance id for this finding (deterministic, rule-code + target). */
  id: string
  /** Short rule code, e.g. "V001", "A003". */
  code: string
  group: ValidationGroup
  severity: Severity
  confidence: Confidence
  /** Human-readable explanation of why this is a problem. */
  explanation: string
  /** Concrete action the developer should take to resolve the finding. */
  suggestedFix: string
  /** IDs of the schema entities (commands, events, typeDefs, etc.) this finding targets. */
  impactedNodes: string[]
}

export interface ValidationReport {
  schemaId: string
  /** ISO-8601 timestamp of when the validation ran. */
  timestamp: string
  findings: ValidationFinding[]
  summary: {
    errors: number
    warnings: number
    infos: number
    /** Finding count per validation group. */
    byGroup: Record<ValidationGroup, number>
  }
  /** True only when there are zero ERROR-severity findings. */
  passed: boolean
}

// ---------------------------------------------------------------------------
// Input shape — the validators operate on this flattened representation.
// It is deliberately simpler than the full domain types so validators are
// decoupled from Prisma / DB concerns.
// ---------------------------------------------------------------------------

export interface SchemaForValidation {
  id: string
  /** Monotonically-increasing integer version (snapshot number). */
  version: number
  /** Wire transport: GENERIC_NETLINK | IOCTL | CHAR_DEVICE */
  transport: string
  /** Genl family name or ioctl device node path. */
  namespace: string
  /** Subsystem family identifier, e.g. "nl80211". */
  family: string
  commands: Array<{
    id: string
    name: string
    requestTypeId: string | null
    responseTypeId: string | null
    /** REQUEST_RESPONSE | STREAMING | FIRE_AND_FORGET */
    interactionStyle: string
    /** Prose string describing privilege requirements (capability, namespace, etc.) */
    privilegeRequirement: string | null
    idempotent: boolean
    deprecated: boolean
    replacementCommandId: string | null
  }>
  events: Array<{
    id: string
    name: string
    payloadTypeId: string | null
    /** MULTICAST | UNICAST */
    subscriptionModel: string
    filteringSupported?: boolean
  }>
  typeDefs: Array<{
    id: string
    name: string
    /** STRUCT | ENUM | FLAGS | SCALAR | ALIAS */
    kind: string
    fields: Array<{
      id: string
      name: string
      /** C/wire type string, e.g. "__u32", "__be16", or a TypeDef name. */
      fieldType: string
      optional: boolean
      reserved: boolean
      arrayLength?: number | null
    }>
    variants: Array<{
      id: string
      name: string
      value: number
    }>
  }>
  permissions: Array<{
    id: string
    /** Linux capability name required, e.g. "CAP_NET_ADMIN". */
    capability: string
    namespaceAware: boolean
  }>
}

export interface Validator {
  group: ValidationGroup
  validate(schema: SchemaForValidation): ValidationFinding[]
}
