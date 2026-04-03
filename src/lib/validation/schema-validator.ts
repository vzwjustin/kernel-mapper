import { type SchemaForValidation, type ValidationFinding, type Validator } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findingId(code: string, ...parts: string[]): string {
  return `${code}:${parts.join(':')}`
}

/**
 * Detect cycles in struct field type references.
 *
 * Each STRUCT type whose field types name another STRUCT in the same schema
 * is added as a directed edge.  We then look for any cycle reachable from
 * every node using DFS.
 */
function detectCyclicStructRefs(
  schema: SchemaForValidation,
): Map<string, string[]> {
  // Build a name → id map for STRUCTs so we can resolve field type strings.
  const nameToId = new Map<string, string>()
  for (const td of schema.typeDefs) {
    if (td.kind === 'STRUCT') {
      nameToId.set(td.name, td.id)
    }
  }

  // Build adjacency list: struct id → set of struct ids referenced by fields.
  const adj = new Map<string, Set<string>>()
  for (const td of schema.typeDefs) {
    if (td.kind !== 'STRUCT') continue
    const deps = new Set<string>()
    for (const f of td.fields) {
      // Strip pointer/array decorators to get the base type name.
      const base = f.fieldType.replace(/[\s*\[\]0-9]/g, '')
      if (nameToId.has(base) && nameToId.get(base) !== td.id) {
        deps.add(nameToId.get(base)!)
      }
    }
    adj.set(td.id, deps)
  }

  // DFS cycle detection — returns the cycle path if one is found.
  const cycles = new Map<string, string[]>() // structId → cycle path of ids
  const WHITE = 0, GREY = 1, BLACK = 2
  const color = new Map<string, number>()
  const path: string[] = []

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GREY)
    path.push(nodeId)
    for (const neighbour of adj.get(nodeId) ?? []) {
      if (color.get(neighbour) === GREY) {
        // Found a cycle — record the cycle path starting from the back-edge.
        const cycleStart = path.indexOf(neighbour)
        const cyclePath = path.slice(cycleStart)
        for (const id of cyclePath) {
          if (!cycles.has(id)) cycles.set(id, cyclePath)
        }
        path.pop()
        color.set(nodeId, BLACK)
        return true
      }
      if ((color.get(neighbour) ?? WHITE) === WHITE) {
        dfs(neighbour)
      }
    }
    path.pop()
    color.set(nodeId, BLACK)
    return false
  }

  for (const id of adj.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      dfs(id)
    }
  }

  return cycles
}

// ---------------------------------------------------------------------------
// SchemaValidator
// ---------------------------------------------------------------------------

export class SchemaValidator implements Validator {
  readonly group = 'SCHEMA_VALIDITY' as const

  validate(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    findings.push(...this.v001DuplicateCommandNames(schema))
    findings.push(...this.v002DuplicateEventNames(schema))
    findings.push(...this.v003DuplicateTypeNames(schema))
    findings.push(...this.v004CommandReferencesUnknownType(schema))
    findings.push(...this.v005EventReferencesUnknownType(schema))
    findings.push(...this.v006CircularTypeReferences(schema))
    findings.push(...this.v007EmptySchema(schema))
    findings.push(...this.v008MissingNamespaceFamily(schema))
    findings.push(...this.v009DuplicateEnumVariantValues(schema))
    findings.push(...this.v010DuplicateFieldNames(schema))

    return findings
  }

  // -------------------------------------------------------------------------

  private v001DuplicateCommandNames(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const seen = new Map<string, string>() // name → first id

    for (const cmd of schema.commands) {
      const key = cmd.name.toLowerCase()
      if (seen.has(key)) {
        findings.push({
          id: findingId('V001', cmd.id),
          code: 'V001',
          group: 'SCHEMA_VALIDITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Command name "${cmd.name}" is duplicated in this schema. ` +
            `Linux kernel netlink families use the command name as a dispatch key; ` +
            `duplicate names cause non-deterministic routing and will break generated ` +
            `kernel dispatch tables.`,
          suggestedFix:
            `Rename one of the commands so every command name within the schema is unique. ` +
            `Consider using a suffix like "_v2" if the intent is to introduce a new variant.`,
          impactedNodes: [seen.get(key)!, cmd.id],
        })
      } else {
        seen.set(key, cmd.id)
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v002DuplicateEventNames(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const seen = new Map<string, string>()

    for (const evt of schema.events) {
      const key = evt.name.toLowerCase()
      if (seen.has(key)) {
        findings.push({
          id: findingId('V002', evt.id),
          code: 'V002',
          group: 'SCHEMA_VALIDITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Event name "${evt.name}" is duplicated in this schema. ` +
            `Duplicate event names make it impossible for subscribers to distinguish ` +
            `which notification they are receiving, and corrupt generated enum tables.`,
          suggestedFix:
            `Rename one of the events. If two events carry the same semantics across ` +
            `different transports, model them as a single event with a discriminating field.`,
          impactedNodes: [seen.get(key)!, evt.id],
        })
      } else {
        seen.set(key, evt.id)
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v003DuplicateTypeNames(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const seen = new Map<string, string>()

    for (const td of schema.typeDefs) {
      const key = td.name.toLowerCase()
      if (seen.has(key)) {
        findings.push({
          id: findingId('V003', td.id),
          code: 'V003',
          group: 'SCHEMA_VALIDITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Type name "${td.name}" is duplicated in this schema. ` +
            `Duplicate type names cause ambiguous references and will produce ` +
            `invalid C UAPI headers (multiple typedef/struct definitions with the same name).`,
          suggestedFix:
            `Rename one of the types. If both represent similar data at different schema ` +
            `versions, consider naming them "${td.name}V1" / "${td.name}V2".`,
          impactedNodes: [seen.get(key)!, td.id],
        })
      } else {
        seen.set(key, td.id)
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v004CommandReferencesUnknownType(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const typeIds = new Set(schema.typeDefs.map(t => t.id))

    for (const cmd of schema.commands) {
      if (cmd.requestTypeId !== null && !typeIds.has(cmd.requestTypeId)) {
        findings.push({
          id: findingId('V004', cmd.id, 'request'),
          code: 'V004',
          group: 'SCHEMA_VALIDITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Command "${cmd.name}" references request type ID "${cmd.requestTypeId}" ` +
            `which does not exist in this schema's type definitions. ` +
            `The schema is internally inconsistent and cannot be used to generate ` +
            `correct kernel or userspace code.`,
          suggestedFix:
            `Either create a TypeDef with this ID, assign an existing type as the ` +
            `request type for "${cmd.name}", or set the request type to null if the ` +
            `command carries no payload.`,
          impactedNodes: [cmd.id],
        })
      }

      if (cmd.responseTypeId !== null && !typeIds.has(cmd.responseTypeId)) {
        findings.push({
          id: findingId('V004', cmd.id, 'response'),
          code: 'V004',
          group: 'SCHEMA_VALIDITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Command "${cmd.name}" references response type ID "${cmd.responseTypeId}" ` +
            `which does not exist in this schema's type definitions. ` +
            `Code generation will fail or produce dangling type references.`,
          suggestedFix:
            `Either create a TypeDef with this ID, assign an existing type as the ` +
            `response type for "${cmd.name}", or set the response type to null if the ` +
            `command produces no structured output.`,
          impactedNodes: [cmd.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v005EventReferencesUnknownType(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const typeIds = new Set(schema.typeDefs.map(t => t.id))

    for (const evt of schema.events) {
      if (evt.payloadTypeId !== null && !typeIds.has(evt.payloadTypeId)) {
        findings.push({
          id: findingId('V005', evt.id),
          code: 'V005',
          group: 'SCHEMA_VALIDITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Event "${evt.name}" references payload type ID "${evt.payloadTypeId}" ` +
            `which does not exist in this schema's type definitions. ` +
            `Subscribers cannot decode the event payload and code generation will fail.`,
          suggestedFix:
            `Either create a TypeDef with this ID, assign an existing type as the ` +
            `event payload, or set the payload type to null if the event carries no data.`,
          impactedNodes: [evt.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v006CircularTypeReferences(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const cycles = detectCyclicStructRefs(schema)

    // Build id → name map for readable messages.
    const idToName = new Map(schema.typeDefs.map(t => [t.id, t.name]))

    const reported = new Set<string>()
    for (const [structId, cyclePath] of cycles) {
      // Report only once per unique cycle (keyed on sorted path).
      const cycleKey = [...cyclePath].sort().join(',')
      if (reported.has(cycleKey)) continue
      reported.add(cycleKey)

      const cycleNames = cyclePath.map(id => idToName.get(id) ?? id)
      findings.push({
        id: findingId('V006', structId),
        code: 'V006',
        group: 'SCHEMA_VALIDITY',
        severity: 'ERROR',
        confidence: 'HIGH',
        explanation:
          `Circular type reference detected: ${cycleNames.join(' → ')} → ${cycleNames[0]}. ` +
          `C does not allow a struct to contain a fully-defined instance of itself ` +
          `(only pointers are valid). This cycle will produce invalid UAPI headers ` +
          `and infinite loops in any schema traversal code.`,
        suggestedFix:
          `Break the cycle by converting one of the struct fields to a reference/ID ` +
          `(e.g., use a "__u32 id" instead of an embedded struct) or by introducing ` +
          `an intermediate pointer type.`,
        impactedNodes: cyclePath,
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v007EmptySchema(schema: SchemaForValidation): ValidationFinding[] {
    if (schema.commands.length > 0 || schema.events.length > 0) return []

    return [
      {
        id: findingId('V007', schema.id),
        code: 'V007',
        group: 'SCHEMA_VALIDITY',
        severity: 'WARNING',
        confidence: 'HIGH',
        explanation:
          `This schema defines no commands and no events. An empty schema provides ` +
          `no API surface and will generate empty or trivially useless artifacts. ` +
          `This is likely an incomplete draft.`,
        suggestedFix:
          `Add at least one command (for request/response operations) or one event ` +
          `(for asynchronous notifications) to define a useful API surface.`,
        impactedNodes: [schema.id],
      },
    ]
  }

  // -------------------------------------------------------------------------

  private v008MissingNamespaceFamily(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    if (!schema.namespace || schema.namespace.trim() === '') {
      findings.push({
        id: findingId('V008', schema.id, 'namespace'),
        code: 'V008',
        group: 'SCHEMA_VALIDITY',
        severity: 'ERROR',
        confidence: 'HIGH',
        explanation:
          `The schema has no namespace set. For Generic Netlink APIs the namespace is ` +
          `the genl family name (e.g. "nl80211", "devlink"). For ioctl APIs it is the ` +
          `device node path (e.g. "/dev/net/tun"). Without a namespace the API cannot ` +
          `be registered with the kernel and generated code will be incomplete.`,
        suggestedFix:
          `Set a unique, lowercase namespace string that identifies this kernel subsystem. ` +
          `For Generic Netlink the name must be ≤16 characters (GENL_NAMSIZ limit).`,
        impactedNodes: [schema.id],
      })
    }

    if (!schema.family || schema.family.trim() === '') {
      findings.push({
        id: findingId('V008', schema.id, 'family'),
        code: 'V008',
        group: 'SCHEMA_VALIDITY',
        severity: 'WARNING',
        confidence: 'HIGH',
        explanation:
          `The schema has no family identifier set. The family field maps this schema ` +
          `to a specific kernel subsystem (e.g. "wireless", "ethtool"). Missing family ` +
          `data reduces documentation quality and may break subsystem-level grouping ` +
          `in generated artifacts.`,
        suggestedFix:
          `Set the family field to the relevant kernel subsystem name or the ` +
          `Generic Netlink family identifier.`,
        impactedNodes: [schema.id],
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v009DuplicateEnumVariantValues(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const td of schema.typeDefs) {
      if (td.kind !== 'ENUM' && td.kind !== 'FLAGS') continue
      if (td.variants.length === 0) continue

      const seen = new Map<number, string>() // value → first variant id

      for (const variant of td.variants) {
        if (seen.has(variant.value)) {
          findings.push({
            id: findingId('V009', td.id, String(variant.value)),
            code: 'V009',
            group: 'SCHEMA_VALIDITY',
            severity: 'ERROR',
            confidence: 'HIGH',
            explanation:
              `In type "${td.name}" (${td.kind}), numeric value ${variant.value} is ` +
              `assigned to more than one variant. Duplicate values in a kernel API enum ` +
              `make kernel switch statements non-deterministic and violate the ABI ` +
              `contract that each command/attribute discriminator is unique.`,
            suggestedFix:
              `Assign each variant a unique integer value. If one variant is intentionally ` +
              `an alias for another (e.g. "LAST" == "MAX"), document this explicitly and ` +
              `model the alias as a separate deprecated variant with a comment.`,
            impactedNodes: [td.id, seen.get(variant.value)!, variant.id],
          })
        } else {
          seen.set(variant.value, variant.id)
        }
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------

  private v010DuplicateFieldNames(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const td of schema.typeDefs) {
      if (td.fields.length === 0) continue

      const seen = new Map<string, string>() // lowercased name → first field id

      for (const field of td.fields) {
        const key = field.name.toLowerCase()
        if (seen.has(key)) {
          findings.push({
            id: findingId('V010', td.id, field.id),
            code: 'V010',
            group: 'SCHEMA_VALIDITY',
            severity: 'ERROR',
            confidence: 'HIGH',
            explanation:
              `Type "${td.name}" has two fields both named "${field.name}" ` +
              `(case-insensitive match). Duplicate field names produce invalid ` +
              `C struct definitions and will cause compiler errors in generated headers.`,
            suggestedFix:
              `Rename one of the fields. If the intention was to extend an existing ` +
              `field with a new type, use a new field name and mark the old one as ` +
              `reserved/deprecated.`,
            impactedNodes: [td.id, seen.get(key)!, field.id],
          })
        } else {
          seen.set(key, field.id)
        }
      }
    }

    return findings
  }
}
