import { type SchemaForValidation, type ValidationFinding, type Validator } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findingId(code: string, ...parts: string[]): string {
  return `${code}:${parts.join(':')}`
}

// Primitive / scalar wire types that do not need an introducedVersion marker
// because they are anonymous (not referenceable by name across versions).
const PRIMITIVE_TYPES = new Set([
  '__u8', '__u16', '__u32', '__u64',
  '__s8', '__s16', '__s32', '__s64',
  '__be16', '__be32', '__be64',
  '__le16', '__le32', '__le64',
  'u8', 'u16', 'u32', 'u64',
  's8', 's16', 's32', 's64',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'char', 'bool', '__bool',
])

// Field types whose names suggest they carry unbounded dynamic data.
const UNBOUNDED_TYPE_PATTERNS = [
  /\*\s*$/, // pointer (arbitrary length)
  /char\s*\[/, // char array with size (borderline, captured separately)
]

// Commands that sound inherently non-idempotent / risky from an ABI
// deprecation standpoint.  We reuse this set in A006 to tighten the finding.
const DESTRUCTIVE_VERB_PATTERN = /^(delete|remove|destroy|reset|clear|flush|purge|wipe)/i

// ---------------------------------------------------------------------------
// AbiValidator
// ---------------------------------------------------------------------------

export class AbiValidator implements Validator {
  readonly group = 'ABI_SAFETY' as const

  validate(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    findings.push(...this.a001StructFieldRemoval(schema))
    findings.push(...this.a002EnumVariantReorderRisk(schema))
    findings.push(...this.a003MissingReservedFields(schema))
    findings.push(...this.a004NonOptionalFieldsInRequestTypes(schema))
    findings.push(...this.a005MissingVersioningOnTypes(schema))
    findings.push(...this.a006DeprecatedCommandWithoutReplacement(schema))

    return findings
  }

  // -------------------------------------------------------------------------
  // A001 — Struct field removal between versions
  //
  // We detect this heuristically: if a struct has any field whose name
  // contains "reserved" or "pad" with a numeric suffix (e.g. "reserved1",
  // "pad2"), those are canonical ABI padding fields that must never be
  // removed.  If we see a struct that previously had such fields but now has
  // none, it's a removal risk.  Since we don't carry previous-version data in
  // the flat SchemaForValidation, we check the inverse: structs with version
  // > 1 that have no reserved fields at all are flagged as at-risk (the prior
  // version likely had reserved fields that were reused or removed).
  // -------------------------------------------------------------------------

  private a001StructFieldRemoval(schema: SchemaForValidation): ValidationFinding[] {
    // Only meaningful when the schema has been versioned past its initial cut.
    if (schema.version <= 1) return []

    const findings: ValidationFinding[] = []

    for (const td of schema.typeDefs) {
      if (td.kind !== 'STRUCT') continue
      if (td.fields.length === 0) continue

      // A struct that carries no reserved/pad fields at version > 1 may have
      // had them removed, which breaks ABI for existing userspace consumers.
      const hasReserved = td.fields.some(
        f => f.reserved || /^(reserved|pad|__pad|rsvd)\d*$/i.test(f.name),
      )

      if (!hasReserved) {
        findings.push({
          id: findingId('A001', td.id),
          code: 'A001',
          group: 'ABI_SAFETY',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          explanation:
            `Struct "${td.name}" is at schema version ${schema.version} but contains ` +
            `no reserved or padding fields. In a versioned Linux UAPI struct, reserved ` +
            `fields must never be removed between versions — their removal shifts field ` +
            `offsets, breaking binary compatibility with userspace binaries compiled ` +
            `against an earlier kernel header.`,
          suggestedFix:
            `Verify that no reserved/pad fields were removed since the first published ` +
            `version of this struct. If fields were removed, restore them (mark as ` +
            `"reserved", zero on send, ignored on receive). If the struct is brand new ` +
            `at this version, add at least one reserved field now for future extensibility.`,
          impactedNodes: [td.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // A002 — Enum variant reuse / reordering risk
  //
  // Kernel enums used as wire discriminators are ABI.  Reordering changes
  // integer values for existing variants, breaking any userspace that hardcodes
  // them.  We detect the most common symptom: an enum whose variants do not
  // start at 0 (or 1) and are not densely packed, suggesting a past reorder
  // or gap-fill that could indicate a reordering pattern.
  // -------------------------------------------------------------------------

  private a002EnumVariantReorderRisk(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const td of schema.typeDefs) {
      if (td.kind !== 'ENUM' && td.kind !== 'FLAGS') continue
      if (td.variants.length < 2) continue

      const values = td.variants.map(v => v.value).sort((a, b) => a - b)
      const min = values[0]

      // Detect non-sequential (sparse) assignments, which indicate either
      // deliberate gaps (fine for FLAGS) or deleted/renumbered variants (ABI risk).
      const isFlags = td.kind === 'FLAGS'
      if (!isFlags) {
        // For enums: values should be sequential starting from 0 or 1.
        // Gaps imply a variant was deleted — a reuse/reorder risk.
        const expectedStart = min <= 1 ? min : 0
        let expectedNext = expectedStart
        let hasGap = false
        for (const v of values) {
          if (v !== expectedNext) { hasGap = true; break }
          expectedNext++
        }

        if (hasGap || min > 1) {
          findings.push({
            id: findingId('A002', td.id),
            code: 'A002',
            group: 'ABI_SAFETY',
            severity: 'WARNING',
            confidence: 'MEDIUM',
            explanation:
              `Enum "${td.name}" has non-sequential variant values ` +
              `(${values.slice(0, 5).join(', ')}${values.length > 5 ? '…' : ''}). ` +
              `Gaps or a high starting value suggest that variants may have been ` +
              `deleted or renumbered in a previous schema revision. In kernel UAPI ` +
              `enums the integer values are wire-format ABI — reordering or renumbering ` +
              `breaks userspace programs that switch on these values.`,
            suggestedFix:
              `Never reorder or renumber existing enum variants. If a variant was ` +
              `removed, keep its integer slot as a deprecated placeholder ` +
              `(e.g. "__ENUM_RESERVED_3 = 3"). If values are intentionally sparse ` +
              `(e.g. sentinel values), change the type to FLAGS or add a comment.`,
            impactedNodes: [td.id],
          })
        }
      } else {
        // For FLAGS: values should be powers of two.  Anything else suggests
        // the type was converted from an enum without updating values.
        const nonPow2 = values.filter(v => v !== 0 && (v & (v - 1)) !== 0)
        if (nonPow2.length > 0) {
          findings.push({
            id: findingId('A002', td.id, 'flags'),
            code: 'A002',
            group: 'ABI_SAFETY',
            severity: 'WARNING',
            confidence: 'MEDIUM',
            explanation:
              `FLAGS type "${td.name}" contains non-power-of-two values ` +
              `(${nonPow2.slice(0, 4).join(', ')}). FLAGS types are used as bitmasks; ` +
              `non-power-of-two values cannot be independently set/cleared and may ` +
              `indicate values were copied from a sequential enum without conversion.`,
            suggestedFix:
              `Assign each flag bit as a power of two (1, 2, 4, 8, …). ` +
              `If combined masks (e.g. ALL = FLAG_A | FLAG_B) are needed, document ` +
              `them with a comment rather than storing them as first-class variants.`,
            impactedNodes: [td.id],
          })
        }
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // A003 — Missing reserved/extension fields in structs
  //
  // Every struct exposed over a Linux UAPI should have at least one reserved
  // field so future attributes can be added without breaking older kernels.
  // -------------------------------------------------------------------------

  private a003MissingReservedFields(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    // Collect all type IDs referenced by commands/events — only those are
    // actually part of the wire ABI.
    const referencedTypeIds = new Set<string>()
    for (const cmd of schema.commands) {
      if (cmd.requestTypeId) referencedTypeIds.add(cmd.requestTypeId)
      if (cmd.responseTypeId) referencedTypeIds.add(cmd.responseTypeId)
    }
    for (const evt of schema.events) {
      if (evt.payloadTypeId) referencedTypeIds.add(evt.payloadTypeId)
    }

    for (const td of schema.typeDefs) {
      if (td.kind !== 'STRUCT') continue
      if (!referencedTypeIds.has(td.id)) continue // not wire-visible
      if (td.fields.length === 0) continue // empty structs handled elsewhere

      const hasReserved = td.fields.some(
        f => f.reserved || /^(reserved|pad|__pad|rsvd)\d*$/i.test(f.name),
      )

      if (!hasReserved) {
        findings.push({
          id: findingId('A003', td.id),
          code: 'A003',
          group: 'ABI_SAFETY',
          severity: 'WARNING',
          confidence: 'HIGH',
          explanation:
            `Wire-visible struct "${td.name}" has no reserved or padding fields. ` +
            `The Linux kernel UAPI convention (see Documentation/userspace-api/abi.rst) ` +
            `requires that structs sent over netlink or ioctl interfaces include at ` +
            `least one reserved field so future kernel versions can add attributes ` +
            `without changing the struct size or breaking old userspace.`,
          suggestedFix:
            `Add one or more zero-initialised reserved fields at the end of the struct, ` +
            `e.g. "__u8 reserved[4];" or "__u32 reserved;". Document that userspace ` +
            `must zero these on send and the kernel must ignore non-zero values ` +
            `(backward compatibility) while old kernels must zero them on reply ` +
            `(forward compatibility).`,
          impactedNodes: [td.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // A004 — Non-optional fields without defaults in request types
  //
  // Non-optional request fields force every userspace caller to set them,
  // meaning a new required field is always an ABI break.  They also prevent
  // partial/incremental updates.
  // -------------------------------------------------------------------------

  private a004NonOptionalFieldsInRequestTypes(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    const requestTypeIds = new Set(
      schema.commands
        .filter(c => c.requestTypeId !== null)
        .map(c => c.requestTypeId as string),
    )

    for (const td of schema.typeDefs) {
      if (!requestTypeIds.has(td.id)) continue
      if (td.kind !== 'STRUCT') continue

      // Count non-optional, non-reserved, non-primitive fields.
      const risky = td.fields.filter(
        f =>
          !f.optional &&
          !f.reserved &&
          !/^(reserved|pad|__pad|rsvd)\d*$/i.test(f.name) &&
          !PRIMITIVE_TYPES.has(f.fieldType.trim()),
      )

      if (risky.length > 0) {
        findings.push({
          id: findingId('A004', td.id),
          code: 'A004',
          group: 'ABI_SAFETY',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          explanation:
            `Request struct "${td.name}" has ${risky.length} non-optional field(s) ` +
            `with non-primitive types (${risky.slice(0, 3).map(f => `"${f.name}"`).join(', ')}` +
            `${risky.length > 3 ? ', …' : ''}). ` +
            `In a versioned kernel API, every new mandatory field is an ABI break: ` +
            `old userspace that does not set the field will send zero bytes, which ` +
            `the kernel must either reject (breaking old callers) or silently accept ` +
            `(potentially unsafe). Netlink UAPI best practice is to make all ` +
            `non-fundamental attributes optional with well-defined absent-means-default ` +
            `semantics.`,
          suggestedFix:
            `Mark complex request fields as optional and document the kernel's ` +
            `behaviour when they are absent (default value, error, no-op). ` +
            `For truly required identity fields (e.g. an interface index) keep them ` +
            `mandatory but use a primitive type (__u32) directly.`,
          impactedNodes: [td.id, ...risky.map(f => f.id)],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // A005 — Missing versioning on types
  //
  // Named types (STRUCT, ENUM, FLAGS) that are wire-visible but carry no
  // introducedVersion information cannot be tracked across schema snapshots.
  // We represent this as a WARNING because the field is optional in the schema
  // type but its absence weakens tooling confidence.
  // -------------------------------------------------------------------------

  private a005MissingVersioningOnTypes(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    if (schema.version <= 1) return findings // Only relevant for evolving schemas.

    const referencedTypeIds = new Set<string>()
    for (const cmd of schema.commands) {
      if (cmd.requestTypeId) referencedTypeIds.add(cmd.requestTypeId)
      if (cmd.responseTypeId) referencedTypeIds.add(cmd.responseTypeId)
    }
    for (const evt of schema.events) {
      if (evt.payloadTypeId) referencedTypeIds.add(evt.payloadTypeId)
    }

    for (const td of schema.typeDefs) {
      // Only check named structural types that are wire-visible.
      if (!['STRUCT', 'ENUM', 'FLAGS'].includes(td.kind)) continue
      if (!referencedTypeIds.has(td.id)) continue

      // The SchemaForValidation input does not carry introducedVersion directly,
      // but we can detect a proxy: if the schema version is > 1 and the type
      // has no reserved fields and is not a simple scalar/alias, it is likely
      // that no version tracking was applied.
      // We use the absence of any versioning convention (reserved fields,
      // naming with "V2" / "V3" suffixes) as a heuristic signal.
      const hasVersionSuffix = /[Vv]\d+$/.test(td.name)
      const hasReserved =
        td.kind === 'STRUCT' &&
        td.fields.some(
          f => f.reserved || /^(reserved|pad|__pad|rsvd)\d*$/i.test(f.name),
        )

      if (!hasVersionSuffix && !hasReserved) {
        findings.push({
          id: findingId('A005', td.id),
          code: 'A005',
          group: 'ABI_SAFETY',
          severity: 'INFO',
          confidence: 'LOW',
          explanation:
            `Wire-visible type "${td.name}" has no detectable version tracking ` +
            `convention (no reserved fields, no "V2/V3" name suffix) in a schema ` +
            `that has been versioned to ${schema.version}. Without version markers it ` +
            `is difficult to determine which kernel version introduced this type or ` +
            `when it was last changed, making kernel back-porting and userspace ` +
            `compatibility checks unreliable.`,
          suggestedFix:
            `Annotate when each type was introduced (e.g. by tagging it with an ` +
            `"introducedVersion" attribute in the schema). For structs, adding reserved ` +
            `fields also provides an implicit extension point that documents the ` +
            `original struct boundary.`,
          impactedNodes: [td.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // A006 — Deprecated command without replacement
  //
  // A deprecated command with no replacement leaves API consumers with no
  // migration path.  This is especially concerning for destructive commands.
  // -------------------------------------------------------------------------

  private a006DeprecatedCommandWithoutReplacement(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    const commandIds = new Set(schema.commands.map(c => c.id))

    for (const cmd of schema.commands) {
      if (!cmd.deprecated) continue

      const missingReplacement =
        cmd.replacementCommandId === null ||
        cmd.replacementCommandId.trim() === '' ||
        !commandIds.has(cmd.replacementCommandId)

      if (missingReplacement) {
        const isDestructive = DESTRUCTIVE_VERB_PATTERN.test(cmd.name)
        findings.push({
          id: findingId('A006', cmd.id),
          code: 'A006',
          group: 'ABI_SAFETY',
          severity: isDestructive ? 'ERROR' : 'WARNING',
          confidence: 'HIGH',
          explanation:
            `Command "${cmd.name}" is marked deprecated but has no replacement ` +
            `command${cmd.replacementCommandId ? ` (referenced ID "${cmd.replacementCommandId}" does not exist in this schema)` : ''}. ` +
            `${isDestructive
              ? `This is a destructive command — leaving it deprecated without a safe replacement creates a dangerous vacuum for callers that need this capability.`
              : `Callers that currently use this command have no documented migration path.`
            } ` +
            `The Linux kernel deprecation model requires that userspace always has a ` +
            `forward path before an old interface is removed.`,
          suggestedFix:
            `Either add a replacement command to this schema and set replacementCommandId, ` +
            `or un-deprecate "${cmd.name}" if removal is not yet planned. ` +
            `If the replacement lives in a different schema family, document the ` +
            `migration path in the command's description field.`,
          impactedNodes: [cmd.id],
        })
      }
    }

    return findings
  }
}

// Re-export primitive types set for use by other validators that need it.
export { PRIMITIVE_TYPES, DESTRUCTIVE_VERB_PATTERN }
