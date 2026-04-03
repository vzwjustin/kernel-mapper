import { type SchemaForValidation, type ValidationFinding, type Validator } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findingId(code: string, ...parts: string[]): string {
  return `${code}:${parts.join(':')}`
}

// ---------------------------------------------------------------------------
// WiringValidator
// ---------------------------------------------------------------------------

export class WiringValidator implements Validator {
  readonly group = 'WIRING_COMPLETENESS' as const

  validate(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    findings.push(...this.w001CommandWithoutRequestType(schema))
    findings.push(...this.w002CommandWithoutResponseType(schema))
    findings.push(...this.w003EventWithoutPayloadType(schema))
    findings.push(...this.w004UnreferencedTypes(schema))
    findings.push(...this.w005UnreferencedPermissions(schema))
    findings.push(...this.w006PrivilegedCommandWithoutPermission(schema))

    return findings
  }

  // -------------------------------------------------------------------------
  // W001 — Command without a request type
  //
  // Commands that accept parameters from userspace must declare a request type
  // so the kernel can validate/parse the payload.  A command with no request
  // type silently accepts arbitrary (potentially malformed) netlink attributes.
  // -------------------------------------------------------------------------

  private w001CommandWithoutRequestType(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const cmd of schema.commands) {
      // FIRE_AND_FORGET commands with no payload are fine with null requestTypeId.
      // REQUEST_RESPONSE and STREAMING commands that carry no request at all
      // are suspicious — they typically need at least an identity/filter type.
      if (cmd.requestTypeId !== null) continue
      if (cmd.interactionStyle === 'FIRE_AND_FORGET') continue

      findings.push({
        id: findingId('W001', cmd.id),
        code: 'W001',
        group: 'WIRING_COMPLETENESS',
        severity: 'WARNING',
        confidence: 'MEDIUM',
        explanation:
          `Command "${cmd.name}" (${cmd.interactionStyle}) has no request type. ` +
          `Most ${cmd.interactionStyle} commands require callers to specify at least ` +
          `an object identifier or filter criteria. Without a request type, the ` +
          `kernel-side handler receives an unvalidated attribute blob and must ` +
          `defensively parse every attribute — a common source of kernel bugs ` +
          `in netlink handlers.`,
        suggestedFix:
          `Define a request struct for "${cmd.name}" and assign it as the requestTypeId. ` +
          `At minimum, include the object identifier(s) this command operates on ` +
          `(e.g. interface index, device handle). If the command truly requires no ` +
          `input, set interactionStyle to FIRE_AND_FORGET to document that intent.`,
        impactedNodes: [cmd.id],
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // W002 — REQUEST_RESPONSE command without a response type
  //
  // A REQUEST_RESPONSE command that declares no response type will either
  // return raw, untyped bytes (which callers cannot safely parse) or silently
  // succeed with no data, leaving callers uncertain about the outcome.
  // -------------------------------------------------------------------------

  private w002CommandWithoutResponseType(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const cmd of schema.commands) {
      if (cmd.interactionStyle !== 'REQUEST_RESPONSE') continue
      if (cmd.responseTypeId !== null) continue

      findings.push({
        id: findingId('W002', cmd.id),
        code: 'W002',
        group: 'WIRING_COMPLETENESS',
        severity: 'WARNING',
        confidence: 'HIGH',
        explanation:
          `Command "${cmd.name}" uses REQUEST_RESPONSE interaction style but has no ` +
          `response type defined. REQUEST_RESPONSE commands must return structured ` +
          `data so callers can interpret the kernel's reply. Without a response type, ` +
          `the schema cannot be used to generate correct client-side parsing code ` +
          `and the API contract is incomplete.`,
        suggestedFix:
          `Define a response struct for "${cmd.name}" and assign it as the responseTypeId. ` +
          `If the command only signals success/failure with no payload (e.g. a ` +
          `set-configuration command), consider changing its interactionStyle to ` +
          `FIRE_AND_FORGET to accurately reflect its semantics.`,
        impactedNodes: [cmd.id],
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // W003 — Event without a payload type
  //
  // An event with no payload carries no information to subscribers and is
  // effectively a bare notification with no parseable content.  While some
  // events are legitimately payload-free (e.g. a "link-up" notification that
  // carries the interface index in the nlmsg header), modelling them without
  // a payload type makes them invisible to schema tooling.
  // -------------------------------------------------------------------------

  private w003EventWithoutPayloadType(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const evt of schema.events) {
      if (evt.payloadTypeId !== null) continue

      findings.push({
        id: findingId('W003', evt.id),
        code: 'W003',
        group: 'WIRING_COMPLETENESS',
        severity: 'INFO',
        confidence: 'MEDIUM',
        explanation:
          `Event "${evt.name}" has no payload type. Subscribers receive this ` +
          `notification but have no schema-driven way to parse its content. ` +
          `Even a minimal payload struct with an object identifier (e.g. interface ` +
          `index, ifindex) would let generated code deserialise the notification ` +
          `correctly. An event without a payload type is opaque to schema tooling.`,
        suggestedFix:
          `Define a payload struct for "${evt.name}" that includes at minimum an ` +
          `identifier for the object the event pertains to (e.g. "__u32 ifindex"). ` +
          `If the event is truly data-free, document this explicitly in the event's ` +
          `description field so future maintainers understand the choice.`,
        impactedNodes: [evt.id],
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // W004 — Type defined but never referenced
  //
  // Unreferenced types are dead schema weight: they are not part of any
  // wire-visible API surface and will be generated into headers that no
  // kernel or userspace code ever uses.  In kernel UAPI, unused type
  // definitions are noise that obscures the true API surface and mislead
  // automated analysis tools.
  // -------------------------------------------------------------------------

  private w004UnreferencedTypes(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    // Build the set of all type IDs directly referenced by commands/events.
    const directlyReferenced = new Set<string>()
    for (const cmd of schema.commands) {
      if (cmd.requestTypeId) directlyReferenced.add(cmd.requestTypeId)
      if (cmd.responseTypeId) directlyReferenced.add(cmd.responseTypeId)
    }
    for (const evt of schema.events) {
      if (evt.payloadTypeId) directlyReferenced.add(evt.payloadTypeId)
    }

    // Expand to include types referenced by field types within those types
    // (transitive closure via field-type name resolution).
    const typeByName = new Map(schema.typeDefs.map(td => [td.name, td.id]))
    const allReferenced = new Set(directlyReferenced)

    // BFS expansion.
    const queue = [...directlyReferenced]
    while (queue.length > 0) {
      const typeId = queue.shift()!
      const td = schema.typeDefs.find(t => t.id === typeId)
      if (!td) continue
      for (const field of td.fields) {
        const base = field.fieldType.replace(/[\s*[\]0-9]/g, '')
        const referencedId = typeByName.get(base)
        if (referencedId && !allReferenced.has(referencedId)) {
          allReferenced.add(referencedId)
          queue.push(referencedId)
        }
      }
    }

    for (const td of schema.typeDefs) {
      if (!allReferenced.has(td.id)) {
        findings.push({
          id: findingId('W004', td.id),
          code: 'W004',
          group: 'WIRING_COMPLETENESS',
          severity: 'WARNING',
          confidence: 'HIGH',
          explanation:
            `Type "${td.name}" (${td.kind}) is defined in this schema but is not ` +
            `referenced by any command's request/response type, any event's payload ` +
            `type, or as a field type within any reachable type. This type is dead ` +
            `schema weight: it will be included in generated headers that no runtime ` +
            `code uses, polluting the UAPI namespace and creating maintenance burden.`,
          suggestedFix:
            `Either delete this type if it is obsolete, or wire it into the schema by ` +
            `assigning it as the request/response type of an appropriate command, ` +
            `as an event payload, or as a field type within an already-referenced struct.`,
          impactedNodes: [td.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // W005 — Permission defined but not referenced
  //
  // A permission entity that is not linked to any command's privilege
  // requirement is an orphaned security policy fragment.  It provides no
  // enforcement and misleads reviewers about the schema's access-control model.
  // -------------------------------------------------------------------------

  private w005UnreferencedPermissions(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    if (schema.permissions.length === 0) return findings

    // Build the set of capability names actually cited by commands.
    const referencedCapabilities = new Set<string>()
    for (const cmd of schema.commands) {
      if (cmd.privilegeRequirement) {
        // Match capability identifiers like "CAP_NET_ADMIN" within the prose string.
        const caps = cmd.privilegeRequirement.match(/CAP_[A-Z_]+/g) ?? []
        for (const cap of caps) referencedCapabilities.add(cap)
      }
    }

    for (const perm of schema.permissions) {
      if (!referencedCapabilities.has(perm.capability)) {
        findings.push({
          id: findingId('W005', perm.id),
          code: 'W005',
          group: 'WIRING_COMPLETENESS',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          explanation:
            `Permission entity "${perm.capability}" is defined in this schema but is ` +
            `not cited in any command's privilege requirement. This is a dangling ` +
            `security policy entry: it documents a capability that the schema claims ` +
            `to require but that no concrete operation enforces. Security auditors ` +
            `relying on the schema's permission model will be misled.`,
          suggestedFix:
            `Either assign "${perm.capability}" to the privilegeRequirement of every ` +
            `command that should require it, or remove this permission entity if it ` +
            `was added by mistake. Permissions should only be defined when at least ` +
            `one command actively enforces them.`,
          impactedNodes: [perm.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // W006 — Privileged command without a matching permission entity
  //
  // The inverse of W005: a command cites a capability in its privilege
  // requirement but the schema has no corresponding permission entity that
  // documents namespace-awareness, scope, or justification.  This means the
  // security model is partially documented.
  // -------------------------------------------------------------------------

  private w006PrivilegedCommandWithoutPermission(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    if (schema.commands.length === 0) return findings

    const definedCapabilities = new Set(schema.permissions.map(p => p.capability))

    for (const cmd of schema.commands) {
      if (!cmd.privilegeRequirement) continue

      const caps = cmd.privilegeRequirement.match(/CAP_[A-Z_]+/g) ?? []
      for (const cap of caps) {
        if (!definedCapabilities.has(cap)) {
          findings.push({
            id: findingId('W006', cmd.id, cap),
            code: 'W006',
            group: 'WIRING_COMPLETENESS',
            severity: 'WARNING',
            confidence: 'MEDIUM',
            explanation:
              `Command "${cmd.name}" requires "${cap}" but this schema has no ` +
              `Permission entity for that capability. Without a permission record, ` +
              `the schema cannot specify whether "${cap}" is namespace-aware ` +
              `(i.e. sufficient within a user namespace), which is critical for ` +
              `container security: if the schema incorrectly implies CAP_NET_ADMIN ` +
              `is namespace-scoped when it isn't, container escapes become possible.`,
            suggestedFix:
              `Add a Permission entity for "${cap}" and set namespaceAware correctly ` +
              `(true if a user-namespace-held capability is sufficient, false if ` +
              `only initial/global capability is accepted). Consult the kernel's ` +
              `capability(7) man page and the relevant subsystem code for the ` +
              `correct setting.`,
            impactedNodes: [cmd.id],
          })
        }
      }
    }

    return findings
  }
}
