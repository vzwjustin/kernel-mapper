import { type SchemaForValidation, type ValidationFinding, type Validator } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findingId(code: string, ...parts: string[]): string {
  return `${code}:${parts.join(':')}`
}

// Pattern tests for naming conventions.
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/
const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/
const UPPER_SNAKE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/

// Identifiers commonly reserved by C / POSIX / Linux headers.
// Using these as UAPI type names causes redefinition errors in generated headers.
const RESERVED_C_IDENTIFIERS = new Set([
  // C standard types
  'size_t', 'ssize_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
  'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  'intmax_t', 'uintmax_t',
  // POSIX / glibc
  'pid_t', 'uid_t', 'gid_t', 'mode_t', 'dev_t', 'ino_t', 'off_t',
  'time_t', 'clock_t', 'suseconds_t', 'useconds_t',
  'socklen_t', 'sa_family_t',
  // Linux kernel UAPI
  '__u8', '__u16', '__u32', '__u64',
  '__s8', '__s16', '__s32', '__s64',
  '__be16', '__be32', '__be64',
  '__le16', '__le32', '__le64',
  '__sum16', '__wsum',
  '__kernel_pid_t', '__kernel_uid_t', '__kernel_gid_t',
  '__kernel_size_t', '__kernel_ssize_t',
  // Common kernel structs that appear in UAPI
  'sockaddr', 'iovec', 'msghdr', 'in_addr', 'in6_addr',
  'timeval', 'timespec', 'itimerval',
  'nlmsghdr', 'nlattr', 'genlmsghdr',
  // C keywords / reserved words
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default',
  'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
  'if', 'inline', 'int', 'long', 'register', 'restrict', 'return',
  'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
  'union', 'unsigned', 'void', 'volatile', 'while',
  // C++ keywords that affect cross-language headers
  'class', 'namespace', 'template', 'virtual', 'new', 'delete',
  'bool', 'true', 'false', 'nullptr',
])

// Maximum number of fields before a struct is considered too complex.
const MAX_STRUCT_FIELDS = 20

// Maximum nesting depth before we flag a type as overly nested.
const MAX_NESTING_DEPTH = 3

// ---------------------------------------------------------------------------
// QualityValidator
// ---------------------------------------------------------------------------

export class QualityValidator implements Validator {
  readonly group = 'DEVELOPER_QUALITY' as const

  validate(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    findings.push(...this.q001NamingInconsistency(schema))
    findings.push(...this.q002OverlyNestedTypes(schema))
    findings.push(...this.q003InconsistentResponseTypes(schema))
    findings.push(...this.q004ReservedCIdentifiers(schema))
    findings.push(...this.q005OverlyComplexStructs(schema))

    return findings
  }

  // -------------------------------------------------------------------------
  // Q001 — Naming inconsistency (mixed snake_case and camelCase)
  //
  // Linux UAPI conventions require snake_case for struct field names and
  // UPPER_SNAKE_CASE for enum/flag variants.  camelCase names in kernel
  // headers are non-idiomatic and make generated C code look wrong.  Mixed
  // conventions within a single schema also indicate lack of review standards.
  // -------------------------------------------------------------------------

  private q001NamingInconsistency(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    // Classify command and event names: they are typically also snake_case in
    // kernel Netlink families (e.g. "get_policy", "set_channel").
    const allNames: Array<{ kind: string; name: string; id: string }> = [
      ...schema.commands.map(c => ({ kind: 'command', name: c.name, id: c.id })),
      ...schema.events.map(e => ({ kind: 'event', name: e.name, id: e.id })),
    ]

    for (const item of allNames) {
      if (CAMEL_CASE_RE.test(item.name)) {
        findings.push({
          id: findingId('Q001', item.id, 'camel'),
          code: 'Q001',
          group: 'DEVELOPER_QUALITY',
          severity: 'WARNING',
          confidence: 'HIGH',
          explanation:
            `${item.kind === 'command' ? 'Command' : 'Event'} name "${item.name}" ` +
            `uses camelCase. Linux kernel netlink command names are conventionally ` +
            `snake_case (e.g. "get_channel", "set_policy"). camelCase names appear ` +
            `non-idiomatic in generated C headers and may conflict with code review ` +
            `guidelines that enforce consistent naming across subsystems.`,
          suggestedFix:
            `Rename to snake_case: "${toSnakeCase(item.name)}". ` +
            `Consistent snake_case across all commands and events makes generated ` +
            `code easier to review and matches the style of existing kernel netlink ` +
            `families (nl80211, devlink, ethtool_netlink, etc.).`,
          impactedNodes: [item.id],
        })
      }
    }

    // Check struct field names: should be snake_case.
    for (const td of schema.typeDefs) {
      if (td.kind !== 'STRUCT') continue
      for (const field of td.fields) {
        if (CAMEL_CASE_RE.test(field.name)) {
          findings.push({
            id: findingId('Q001', td.id, field.id, 'camel'),
            code: 'Q001',
            group: 'DEVELOPER_QUALITY',
            severity: 'WARNING',
            confidence: 'HIGH',
            explanation:
              `Field "${field.name}" in struct "${td.name}" uses camelCase. ` +
              `Linux kernel C struct members use snake_case exclusively. ` +
              `camelCase fields will look wrong in generated UAPI headers and may ` +
              `be rejected during kernel code review.`,
            suggestedFix:
              `Rename to snake_case: "${toSnakeCase(field.name)}".`,
            impactedNodes: [td.id, field.id],
          })
        }
      }
    }

    // Check enum/flags variant names: should be UPPER_SNAKE_CASE.
    for (const td of schema.typeDefs) {
      if (td.kind !== 'ENUM' && td.kind !== 'FLAGS') continue
      for (const variant of td.variants) {
        const name = variant.name
        // Allow UPPER_SNAKE_CASE; flag anything that looks camelCase or pure lowercase.
        if (CAMEL_CASE_RE.test(name) || SNAKE_CASE_RE.test(name)) {
          findings.push({
            id: findingId('Q001', td.id, variant.id, 'variant'),
            code: 'Q001',
            group: 'DEVELOPER_QUALITY',
            severity: 'WARNING',
            confidence: 'HIGH',
            explanation:
              `Variant "${name}" in ${td.kind} "${td.name}" is not UPPER_SNAKE_CASE. ` +
              `Linux kernel enum and flag constants are always UPPER_SNAKE_CASE ` +
              `(e.g. NL80211_CMD_GET_WIPHY, IFLA_STATS_LINK_64). Non-uppercase ` +
              `variants produce non-idiomatic generated headers and will be flagged ` +
              `during kernel code review.`,
            suggestedFix:
              `Rename to UPPER_SNAKE_CASE: "${name.toUpperCase().replace(/-/g, '_')}". ` +
              `Follow the subsystem-specific prefix convention, e.g. ` +
              `"${schema.family.toUpperCase()}_${name.toUpperCase()}".`,
            impactedNodes: [td.id, variant.id],
          })
        }
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // Q002 — Overly nested types
  //
  // A type whose fields reference other structs, whose fields reference more
  // structs (>3 levels deep) creates complex recursive codegen requirements
  // and is very difficult to serialise/deserialise correctly over netlink.
  // Linux kernel UAPI structs are typically flat or one level deep.
  // -------------------------------------------------------------------------

  private q002OverlyNestedTypes(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    const typeByName = new Map(schema.typeDefs.map(td => [td.name, td]))

    function nestingDepth(typeName: string, visited = new Set<string>()): number {
      if (visited.has(typeName)) return 0 // cycle guard
      const td = typeByName.get(typeName)
      if (!td || td.kind !== 'STRUCT' || td.fields.length === 0) return 0
      visited.add(typeName)
      let max = 0
      for (const field of td.fields) {
        const base = field.fieldType.replace(/[\s*[\]0-9]/g, '')
        const depth = nestingDepth(base, new Set(visited))
        if (depth > max) max = depth
      }
      return 1 + max
    }

    for (const td of schema.typeDefs) {
      if (td.kind !== 'STRUCT') continue
      const depth = nestingDepth(td.name)
      if (depth > MAX_NESTING_DEPTH) {
        findings.push({
          id: findingId('Q002', td.id),
          code: 'Q002',
          group: 'DEVELOPER_QUALITY',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          explanation:
            `Struct "${td.name}" has a nesting depth of ${depth} levels ` +
            `(threshold: ${MAX_NESTING_DEPTH}). Deeply nested structs are ` +
            `problematic in Linux UAPI designs: they require recursive netlink ` +
            `attribute nesting (NLA_NESTED), which significantly increases ` +
            `serialisation complexity, error paths, and the risk of size-limit ` +
            `violations (NLMSG_GOODSIZE ~= 8 KB for most sockets). Most production ` +
            `kernel netlink APIs use flat or one-level-nested attribute layouts.`,
          suggestedFix:
            `Flatten "${td.name}" by inlining the nested struct fields directly, ` +
            `or by replacing deep nesting with a flat list of typed attributes ` +
            `using a discriminating kind/type field. If nesting is required ` +
            `(e.g. per-object statistics), consider whether the nested struct can ` +
            `be sent as a separate netlink message in a multi-part reply instead.`,
          impactedNodes: [td.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // Q003 — Inconsistent response types across similar commands
  //
  // Commands with the same verb prefix (get_, list_, dump_) should return
  // comparable shapes.  If "get_foo" returns FooInfo but "get_bar" returns
  // BarStats, that is expected.  But if two commands both claim to "get" the
  // same kind of thing (same noun) but return different types, it indicates
  // inconsistent design that will confuse callers.
  // -------------------------------------------------------------------------

  private q003InconsistentResponseTypes(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    // Group commands by their verb prefix (first word of snake_case name).
    const GET_VERBS = new Set(['get', 'list', 'dump', 'query', 'fetch', 'read'])

    // Only check commands that have a response type — others are handled by W002.
    const withResponse = schema.commands.filter(
      c => c.responseTypeId !== null && GET_VERBS.has(c.name.split('_')[0]),
    )

    if (withResponse.length < 2) return findings

    // Map response type id → set of commands using it.
    const responseTypeUsage = new Map<string, string[]>()
    for (const cmd of withResponse) {
      const key = cmd.responseTypeId!
      if (!responseTypeUsage.has(key)) responseTypeUsage.set(key, [])
      responseTypeUsage.get(key)!.push(cmd.id)
    }

    // Detect divergence: if we have more unique response type IDs than we
    // have distinct nouns (second word of command name), flag the outlier.
    const nounToResponses = new Map<string, Set<string>>()
    for (const cmd of withResponse) {
      const parts = cmd.name.split('_')
      const noun = parts.slice(1).join('_') || cmd.name
      if (!nounToResponses.has(noun)) nounToResponses.set(noun, new Set())
      nounToResponses.get(noun)!.add(cmd.responseTypeId!)
    }

    for (const [noun, responseIds] of nounToResponses) {
      if (responseIds.size <= 1) continue

      const cmdsForNoun = withResponse.filter(c => {
        const parts = c.name.split('_')
        return (parts.slice(1).join('_') || c.name) === noun
      })

      findings.push({
        id: findingId('Q003', schema.id, noun),
        code: 'Q003',
        group: 'DEVELOPER_QUALITY',
        severity: 'INFO',
        confidence: 'LOW',
        explanation:
          `Commands that retrieve "${noun}" return ${responseIds.size} different ` +
          `response types (commands: ${cmdsForNoun.map(c => `"${c.name}"`).join(', ')}). ` +
          `Inconsistent response shapes for semantically related commands force ` +
          `callers to maintain per-command deserialisation logic, increase the ` +
          `chance of bugs when a developer assumes the shapes are interchangeable, ` +
          `and make generic tooling (CLI introspection, schema-driven UIs) harder ` +
          `to build.`,
        suggestedFix:
          `Consider whether these commands could share a common response type, ` +
          `optionally with a "kind" discriminator field for variant-specific data. ` +
          `If the shapes differ intentionally (e.g. summary vs full detail), ` +
          `reflect that distinction in the command names ` +
          `(e.g. "get_${noun}_summary" vs "get_${noun}_detail").`,
        impactedNodes: cmdsForNoun.map(c => c.id),
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // Q004 — Type name collisions with common C identifiers
  //
  // If a schema-defined type shares a name with a C standard library type,
  // POSIX type, or Linux kernel type, including the generated header into any
  // C file alongside those system headers will cause redefinition errors or
  // silent shadowing — both of which produce subtle bugs.
  // -------------------------------------------------------------------------

  private q004ReservedCIdentifiers(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const td of schema.typeDefs) {
      const lower = td.name.toLowerCase()
      if (RESERVED_C_IDENTIFIERS.has(td.name) || RESERVED_C_IDENTIFIERS.has(lower)) {
        findings.push({
          id: findingId('Q004', td.id),
          code: 'Q004',
          group: 'DEVELOPER_QUALITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Type "${td.name}" collides with a well-known C / POSIX / Linux ` +
            `kernel identifier. Including the generated UAPI header alongside ` +
            `standard system headers will cause a redefinition error or silently ` +
            `shadow the system type, leading to cryptic compile failures or ` +
            `type-mismatch bugs in userspace code.`,
          suggestedFix:
            `Rename the type to a subsystem-prefixed name to avoid collisions, ` +
            `e.g. "${schema.family.toUpperCase()}_${td.name.toUpperCase()}" or ` +
            `"${schema.family}_${td.name.toLowerCase()}_t". ` +
            `Linux UAPI types use the subsystem name as a prefix (e.g. ` +
            `"nl80211_chan_width", "devlink_port_type") to prevent namespace pollution.`,
          impactedNodes: [td.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // Q005 — Struct with >20 fields
  //
  // Structs with many fields are hard to read, hard to version, and often
  // indicate that multiple distinct concepts have been merged.  In kernel
  // UAPI, large structs are also risky because adding to them requires
  // careful zeroing/ignoring of new fields across kernel versions.
  // -------------------------------------------------------------------------

  private q005OverlyComplexStructs(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const td of schema.typeDefs) {
      if (td.kind !== 'STRUCT') continue
      if (td.fields.length <= MAX_STRUCT_FIELDS) continue

      findings.push({
        id: findingId('Q005', td.id),
        code: 'Q005',
        group: 'DEVELOPER_QUALITY',
        severity: 'WARNING',
        confidence: 'HIGH',
        explanation:
          `Struct "${td.name}" has ${td.fields.length} fields ` +
          `(threshold: ${MAX_STRUCT_FIELDS}). Overly large UAPI structs are ` +
          `difficult to maintain: each new field must be zero-initialised by ` +
          `old userspace and zero-on-receive by old kernels, every field occupies ` +
          `fixed wire space even when unused, and kernel reviewers must verify ` +
          `alignment and padding for every member. Large structs also typically ` +
          `indicate that multiple distinct logical objects have been conflated, ` +
          `making the API harder to understand and document.`,
        suggestedFix:
          `Consider splitting "${td.name}" into smaller, purpose-specific structs ` +
          `linked by a common identifier (e.g. an object ID or handle). ` +
          `Group related fields into nested types delivered via separate netlink ` +
          `attributes (NLA_NESTED). Reserve fields that are genuinely needed ` +
          `for future expansion rather than including speculative fields now.`,
        impactedNodes: [td.id],
      })
    }

    return findings
  }
}

// ---------------------------------------------------------------------------
// Utility: best-effort camelCase → snake_case conversion for fix suggestions.
// ---------------------------------------------------------------------------

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
}
