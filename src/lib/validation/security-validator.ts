import { type SchemaForValidation, type ValidationFinding, type Validator } from './types'
import { DESTRUCTIVE_VERB_PATTERN } from './abi-validator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findingId(code: string, ...parts: string[]): string {
  return `${code}:${parts.join(':')}`
}

// Field types that indicate potentially unbounded data:
//   - pointer types (void *, char *)
//   - variable-length arrays (modelled as arrayLength null/0)
//   - string aliases
const UNBOUNDED_TYPE_PATTERNS = [
  /\*/, // pointer type
  /^string$/i,
  /^nlattr$/i, // raw netlink attribute blob
  /^nla_policy$/i,
]

function isUnboundedType(fieldType: string, arrayLength?: number | null): boolean {
  if (UNBOUNDED_TYPE_PATTERNS.some(p => p.test(fieldType))) return true
  // An array field with no explicit length cap is unbounded.
  if (arrayLength === null || arrayLength === undefined || arrayLength === 0) {
    // Only flag char[] and byte[] arrays — __u32 arrays have fixed element size.
    if (/^(char|__u8|u8|uint8_t|byte)/.test(fieldType.trim())) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// SecurityValidator
// ---------------------------------------------------------------------------

export class SecurityValidator implements Validator {
  readonly group = 'SECURITY' as const

  validate(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    findings.push(...this.s001CommandWithoutPrivilege(schema))
    findings.push(...this.s002MulticastEventWithoutFiltering(schema))
    findings.push(...this.s003NamespaceAwarePermissionMissing(schema))
    findings.push(...this.s004UnboundedFieldsInRequestTypes(schema))
    findings.push(...this.s005DestructiveCommandWithoutCapability(schema))

    return findings
  }

  // -------------------------------------------------------------------------
  // S001 — Command with no privilege requirement
  //
  // Every kernel API command should explicitly state whether it requires a
  // capability or is available to unprivileged callers.  Leaving the field
  // null makes the security model ambiguous — a "fix" that later adds a
  // capability check is an ABI break; a "fix" that intentionally allows
  // unprivileged access should be explicitly documented.
  // -------------------------------------------------------------------------

  private s001CommandWithoutPrivilege(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const cmd of schema.commands) {
      if (cmd.privilegeRequirement !== null && cmd.privilegeRequirement.trim() !== '') continue

      const isDestructive = DESTRUCTIVE_VERB_PATTERN.test(cmd.name)
      findings.push({
        id: findingId('S001', cmd.id),
        code: 'S001',
        group: 'SECURITY',
        severity: isDestructive ? 'ERROR' : 'WARNING',
        confidence: 'HIGH',
        explanation:
          `Command "${cmd.name}" has no privilege requirement specified. ` +
          `${isDestructive
            ? `This command's name suggests a destructive operation (delete/reset/clear/destroy). ` +
              `Leaving a destructive command unprivileged — even accidentally — is a ` +
              `serious security risk that could allow unprivileged processes to corrupt ` +
              `kernel state.`
            : `Every kernel API command must explicitly document its access control: ` +
              `either name the required Linux capability (e.g. CAP_NET_ADMIN) or ` +
              `explicitly state that the operation is available to all callers.`
          } ` +
          `Implicit "no privilege required" is indistinguishable from "forgot to ` +
          `specify" — both look the same to security auditors and automated tools.`,
        suggestedFix:
          `Set privilegeRequirement to the required Linux capability (e.g. ` +
          `"Requires CAP_NET_ADMIN") or to an explicit statement that the operation ` +
          `is unprivileged (e.g. "No privilege required — available to all callers"). ` +
          `For namespace-scoped capabilities, also add a Permission entity and set ` +
          `namespaceAware accordingly.`,
        impactedNodes: [cmd.id],
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // S002 — MULTICAST event with no filtering support
  //
  // Multicast netlink groups deliver notifications to every subscriber that
  // has joined the group, regardless of whether the event data is relevant to
  // them.  If the event contains sensitive information (counters, addresses,
  // routing data) and no subscriber filtering is applied, unprivileged
  // processes that join the group can observe data that does not belong to them.
  // -------------------------------------------------------------------------

  private s002MulticastEventWithoutFiltering(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const evt of schema.events) {
      if (evt.subscriptionModel !== 'MULTICAST') continue
      if (evt.filteringSupported === true) continue

      findings.push({
        id: findingId('S002', evt.id),
        code: 'S002',
        group: 'SECURITY',
        severity: 'WARNING',
        confidence: 'MEDIUM',
        explanation:
          `Event "${evt.name}" uses MULTICAST delivery but does not indicate that ` +
          `subscriber filtering is supported. Multicast netlink groups broadcast to ` +
          `all subscribed sockets including those held by unprivileged processes. ` +
          `Without per-subscriber filtering, any process that joins the group ` +
          `receives every notification — including those containing data from other ` +
          `network namespaces, other users' interfaces, or sensitive kernel-internal ` +
          `counters. This is a data-leakage risk in containerised environments.`,
        suggestedFix:
          `Add namespace-based or UID-based filtering to the multicast group handler ` +
          `so that each subscriber only receives events relevant to their own ` +
          `namespace/credentials. Mark filteringSupported as true once implemented. ` +
          `Alternatively, if sensitivity is low (e.g. link-state changes are public ` +
          `information), document explicitly why filtering is not required.`,
        impactedNodes: [evt.id],
      })
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // S003 — Namespace-aware permission not set for scoped commands
  //
  // Linux capabilities held within a user namespace are weaker than the same
  // capability held globally.  For example, CAP_NET_ADMIN inside a network
  // namespace cannot reconfigure the host network.  If a permission entity
  // does not declare whether it is namespace-aware, the schema is ambiguous
  // about which privilege level is sufficient — a common source of
  // privilege-escalation bugs at container boundaries.
  // -------------------------------------------------------------------------

  private s003NamespaceAwarePermissionMissing(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    // Find commands that operate on network or device resources and whose
    // capability is NOT marked namespace-aware.
    const networkScopedPattern = /\b(net|network|interface|link|route|addr|socket|netns)\b/i

    for (const perm of schema.permissions) {
      // Capabilities that are commonly subject to namespace scoping questions.
      const isNetworkCap =
        perm.capability === 'CAP_NET_ADMIN' ||
        perm.capability === 'CAP_NET_RAW' ||
        perm.capability === 'CAP_NET_BIND_SERVICE' ||
        perm.capability === 'CAP_SYS_ADMIN'

      if (!isNetworkCap) continue

      // Check whether any command that requires this capability touches
      // network-scoped resources (heuristic: namespace/family name or command name).
      const isSchemaNetworkScoped =
        networkScopedPattern.test(schema.namespace) ||
        networkScopedPattern.test(schema.family) ||
        schema.commands.some(
          c =>
            c.privilegeRequirement?.includes(perm.capability) &&
            networkScopedPattern.test(c.name),
        )

      if (isSchemaNetworkScoped && !perm.namespaceAware) {
        findings.push({
          id: findingId('S003', perm.id),
          code: 'S003',
          group: 'SECURITY',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          explanation:
            `Permission "${perm.capability}" is used in a network-scoped API ` +
            `("${schema.namespace}") but is not marked as namespace-aware. ` +
            `If this capability check does not account for user namespaces, ` +
            `a container with CAP_NET_ADMIN in its own network namespace could ` +
            `invoke commands intended only for the global network administrator, ` +
            `potentially affecting host-level network state. Many CVEs in the Linux ` +
            `kernel have resulted from missing namespace checks on netlink commands.`,
          suggestedFix:
            `Audit the kernel handler for every command requiring "${perm.capability}" ` +
            `to verify that it calls capable() (global) vs. ns_capable() (namespaced). ` +
            `If ns_capable() is used (namespace-scoped enforcement), set namespaceAware ` +
            `= true. If capable() is used (global enforcement), set namespaceAware = ` +
            `false and document that container-held capabilities are insufficient.`,
          impactedNodes: [perm.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // S004 — Unbounded arrays or strings in request types (DoS risk)
  //
  // A kernel netlink handler that accepts an unbounded array or string from
  // userspace without a length cap is vulnerable to memory exhaustion attacks.
  // The kernel must always enforce a maximum attribute payload size.
  // -------------------------------------------------------------------------

  private s004UnboundedFieldsInRequestTypes(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    const requestTypeIds = new Set(
      schema.commands
        .filter(c => c.requestTypeId !== null)
        .map(c => c.requestTypeId as string),
    )

    for (const td of schema.typeDefs) {
      if (!requestTypeIds.has(td.id)) continue
      if (td.kind !== 'STRUCT') continue

      for (const field of td.fields) {
        if (!isUnboundedType(field.fieldType, field.arrayLength)) continue

        findings.push({
          id: findingId('S004', td.id, field.id),
          code: 'S004',
          group: 'SECURITY',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          explanation:
            `Field "${field.name}" in request struct "${td.name}" has type ` +
            `"${field.fieldType}" which can carry unbounded data. ` +
            `Accepting uncapped arrays or strings from userspace in a kernel netlink ` +
            `handler is a DoS risk: a malicious or buggy process can send an ` +
            `arbitrarily large payload, causing excessive kernel memory allocation. ` +
            `The Linux kernel netlink policy framework (nla_policy) requires explicit ` +
            `length constraints on NLA_STRING, NLA_BINARY, and NLA_NESTED attributes.`,
          suggestedFix:
            `Add an explicit maximum length to field "${field.name}" (e.g. set ` +
            `arrayLength to the maximum number of elements, or change the type to ` +
            `a fixed-size array like "char[IFNAMSIZ]"). In the kernel handler, ` +
            `enforce the limit via nla_policy with .len set to the maximum.`,
          impactedNodes: [td.id, field.id],
        })
      }
    }

    return findings
  }

  // -------------------------------------------------------------------------
  // S005 — Destructive command without a capability requirement
  //
  // Commands whose names suggest a destructive operation (delete, reset, clear,
  // destroy, remove, flush, purge, wipe) must require an explicit privilege.
  // An unprivileged "delete_all_routes" command would be catastrophic.
  // -------------------------------------------------------------------------

  private s005DestructiveCommandWithoutCapability(schema: SchemaForValidation): ValidationFinding[] {
    const findings: ValidationFinding[] = []

    for (const cmd of schema.commands) {
      if (!DESTRUCTIVE_VERB_PATTERN.test(cmd.name)) continue

      const hasCapability =
        cmd.privilegeRequirement !== null &&
        cmd.privilegeRequirement.trim() !== '' &&
        /CAP_[A-Z_]+/.test(cmd.privilegeRequirement)

      if (!hasCapability) {
        findings.push({
          id: findingId('S005', cmd.id),
          code: 'S005',
          group: 'SECURITY',
          severity: 'ERROR',
          confidence: 'HIGH',
          explanation:
            `Command "${cmd.name}" has a destructive name pattern but requires no ` +
            `Linux capability. Destructive kernel API commands (those that delete, ` +
            `reset, clear, destroy, remove, flush, purge, or wipe state) that can ` +
            `be called without a capability allow any unprivileged process to cause ` +
            `irreversible data loss or system disruption. Even within a namespace, ` +
            `a destructive unprivileged command is a high-severity vulnerability.`,
          suggestedFix:
            `Add a capability requirement to "${cmd.name}" (at minimum CAP_NET_ADMIN ` +
            `for network state or CAP_SYS_ADMIN for system-wide state). ` +
            `If the operation is intentionally available to unprivileged callers ` +
            `(e.g. a user can delete their own resource), document this explicitly ` +
            `and verify that the kernel handler enforces ownership/namespace checks ` +
            `to prevent cross-user or cross-namespace destruction.`,
          impactedNodes: [cmd.id],
        })
      }
    }

    return findings
  }
}
