import type { ToolDefinition } from './types'

// ---------------------------------------------------------------------------
// Internal tools the AI model can call during schema design sessions.
// Each tool definition includes a full JSON Schema for its parameters.
// ---------------------------------------------------------------------------

export const AI_TOOLS: ToolDefinition[] = [
  // ---------------------------------------------------------------------------
  // read_current_schema
  // Read the current state of a named API schema (Generic Netlink family,
  // ioctl interface, sysfs node, etc.) from the active design session.
  // ---------------------------------------------------------------------------
  {
    name: 'read_current_schema',
    description:
      'Read the current API schema for a given schema ID. Returns the full schema ' +
      'definition including all attributes, commands, policies, and transport ' +
      'metadata. Use this before proposing edits to ensure you are working against ' +
      'the latest version.',
    parameters: {
      type: 'object',
      properties: {
        schemaId: {
          type: 'string',
          description:
            'Unique identifier of the schema to read (e.g. "nl80211", "taskstats", ' +
            '"my-custom-family"). Must match an existing schema in the session.',
        },
      },
      required: ['schemaId'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // update_schema_patch
  // Propose a structured patch to a schema. The patch is validated before
  // being applied. Use this to add/remove attributes, change policies, add
  // commands, or update transport metadata.
  // ---------------------------------------------------------------------------
  {
    name: 'update_schema_patch',
    description:
      'Propose a patch to an existing schema. The patch is expressed as a partial ' +
      'schema object whose keys will be merged into (or removed from) the target ' +
      'schema. The patch is validated against ABI-safety rules before being applied. ' +
      'Use this rather than rewriting the whole schema when making targeted changes.',
    parameters: {
      type: 'object',
      properties: {
        schemaId: {
          type: 'string',
          description: 'ID of the schema to patch.',
        },
        patch: {
          type: 'object',
          description:
            'Partial schema object to merge. Keys present in the patch replace ' +
            'existing keys. Set a key to null to remove it. Nested objects are ' +
            'merged recursively unless the value is null.',
          additionalProperties: true,
        },
        rationale: {
          type: 'string',
          description:
            'Short explanation of why this patch is being proposed. Becomes part ' +
            'of the audit trail for the change.',
        },
        abiImpact: {
          type: 'string',
          enum: ['none', 'additive', 'breaking'],
          description:
            'Expected ABI impact of this patch. "none" = no change to the wire ' +
            'format. "additive" = new optional attributes/commands added (safe for ' +
            'old kernels/userspace). "breaking" = existing attributes removed, ' +
            'types changed, or command semantics altered.',
        },
      },
      required: ['schemaId', 'patch', 'rationale', 'abiImpact'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // diff_schema_versions
  // Compare two named schema versions and return a structured diff. Useful for
  // reviewing what changed between design iterations or kernel versions.
  // ---------------------------------------------------------------------------
  {
    name: 'diff_schema_versions',
    description:
      'Compare two versions of a schema and return a structured diff. Shows added, ' +
      'removed, and changed attributes, commands, policies, and flags. Use this to ' +
      'audit changes between design iterations or to verify that a proposed patch ' +
      'only introduces the intended changes.',
    parameters: {
      type: 'object',
      properties: {
        schemaId: {
          type: 'string',
          description: 'ID of the schema to diff.',
        },
        fromVersion: {
          type: 'string',
          description:
            'Version label or commit-like identifier of the base (older) version. ' +
            'Use "current" to refer to the currently saved version.',
        },
        toVersion: {
          type: 'string',
          description:
            'Version label or commit-like identifier of the target (newer) version. ' +
            'Use "proposed" to refer to the currently proposed patch.',
        },
        focusArea: {
          type: 'string',
          enum: ['attributes', 'commands', 'policies', 'flags', 'transport', 'all'],
          description:
            'Limit the diff to a specific area of the schema. Defaults to "all".',
        },
      },
      required: ['schemaId', 'fromVersion', 'toVersion'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // list_generated_artifacts
  // List the code artifacts that have been generated from a schema: kernel-side
  // header stubs, UAPI headers, userspace library wrappers, etc.
  // ---------------------------------------------------------------------------
  {
    name: 'list_generated_artifacts',
    description:
      'List all code artifacts that have been generated from a schema. Returns ' +
      'artifact names, types (kernel header, UAPI header, libnl policy, etc.), ' +
      'generation timestamps, and staleness indicators (whether the schema has ' +
      'changed since the artifact was last generated).',
    parameters: {
      type: 'object',
      properties: {
        schemaId: {
          type: 'string',
          description: 'ID of the schema whose artifacts to list.',
        },
        artifactType: {
          type: 'string',
          enum: [
            'kernel_header',
            'uapi_header',
            'libnl_policy',
            'python_bindings',
            'rust_bindings',
            'go_bindings',
            'all',
          ],
          description:
            'Filter by artifact type. Defaults to "all" (return all artifact types).',
        },
        includeStaleOnly: {
          type: 'boolean',
          description:
            'If true, return only artifacts that are out of date with the current ' +
            'schema. Useful for identifying what needs to be regenerated.',
        },
      },
      required: ['schemaId'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // run_validation_suite
  // Run the schema validation suite against a schema. Checks ABI safety rules,
  // Generic Netlink policy consistency, capability requirements, attribute
  // numbering constraints, and forward-compatibility invariants.
  // ---------------------------------------------------------------------------
  {
    name: 'run_validation_suite',
    description:
      'Run the full schema validation suite against a schema. Checks include: ' +
      'ABI safety (no removed or renumbered attributes in stable families), ' +
      'Generic Netlink policy consistency (attribute types match declared policies), ' +
      'capability annotations (privileged operations have CAP_* requirements), ' +
      'attribute numbering (no gaps, no reuse of deprecated numbers), ' +
      'forward-compatibility invariants (unknown attributes handled gracefully), ' +
      'and transport completeness (all commands have request/reply policies). ' +
      'Returns a structured report with pass/fail per check and actionable messages.',
    parameters: {
      type: 'object',
      properties: {
        schemaId: {
          type: 'string',
          description: 'ID of the schema to validate.',
        },
        checks: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'abi_safety',
              'policy_consistency',
              'capability_annotations',
              'attribute_numbering',
              'forward_compat',
              'transport_completeness',
              'all',
            ],
          },
          description:
            'Specific checks to run. Omit or pass ["all"] to run the full suite.',
        },
        treatWarningsAsErrors: {
          type: 'boolean',
          description:
            'If true, validation warnings are promoted to errors. Use when preparing ' +
            'a schema for kernel submission.',
        },
      },
      required: ['schemaId'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // inspect_graph_node
  // Inspect a single node in the kernel-mapper call graph / symbol graph.
  // Returns callers, callees, struct references, and config guards for a
  // named kernel symbol.
  // ---------------------------------------------------------------------------
  {
    name: 'inspect_graph_node',
    description:
      'Inspect a kernel symbol (function, struct, or config option) in the ' +
      'kernel-mapper graph database. Returns: direct callers and callees, struct ' +
      'field accesses, Kconfig guards (which CONFIG_ options control compilation), ' +
      'file location, and subsystem membership. Use this to understand how a kernel ' +
      'symbol is used before proposing API changes that affect it.',
    parameters: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description:
            'Name of the kernel symbol to inspect (e.g. "genl_register_family", ' +
            '"sk_buff", "CONFIG_NET_NS").',
        },
        symbolType: {
          type: 'string',
          enum: ['function', 'struct', 'config', 'auto'],
          description:
            'Type of the symbol. Use "auto" to let the tool infer it from the name.',
        },
        depth: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          description:
            'Call graph traversal depth. 1 = direct callers/callees only. ' +
            'Higher values expand the graph. Defaults to 1.',
        },
        includeConfig: {
          type: 'boolean',
          description:
            'If true, include Kconfig dependency information in the result. ' +
            'Shows which CONFIG_ options must be enabled for this symbol to exist.',
        },
      },
      required: ['symbolName'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // get_transport_guidelines
  // Retrieve design guidelines for a specific kernel transport mechanism
  // (Generic Netlink, ioctl, sysfs, debugfs, etc.).
  // ---------------------------------------------------------------------------
  {
    name: 'get_transport_guidelines',
    description:
      'Retrieve authoritative design guidelines for a kernel transport mechanism. ' +
      'Covers: when to use this transport vs alternatives, required boilerplate, ' +
      'locking requirements, namespace (netns, pidns, userns) considerations, ' +
      'capability requirements, versioning strategy, and common anti-patterns. ' +
      'Use before designing a new API to ensure it follows subsystem conventions.',
    parameters: {
      type: 'object',
      properties: {
        transport: {
          type: 'string',
          enum: [
            'generic_netlink',
            'rtnetlink',
            'ioctl',
            'sysfs',
            'debugfs',
            'procfs',
            'bpf_map',
            'perf_event',
            'io_uring',
            'fanotify',
            'inotify',
          ],
          description: 'The kernel transport mechanism to get guidelines for.',
        },
        topic: {
          type: 'string',
          enum: [
            'overview',
            'versioning',
            'capabilities',
            'namespaces',
            'locking',
            'abi_stability',
            'anti_patterns',
            'all',
          ],
          description:
            'Specific topic to focus on within the transport guidelines. ' +
            'Defaults to "all".',
        },
      },
      required: ['transport'],
      additionalProperties: false,
    },
  },

  // ---------------------------------------------------------------------------
  // get_compatibility_rules
  // Retrieve the ABI stability and forward/backward compatibility rules that
  // apply to a specific kernel interface class or UAPI header.
  // ---------------------------------------------------------------------------
  {
    name: 'get_compatibility_rules',
    description:
      'Retrieve ABI stability and compatibility rules for a kernel interface ' +
      'class. Returns: what changes are always safe (additive), what changes ' +
      'require careful coordination (deprecation), what changes are never allowed ' +
      'in stable interfaces (breaking), and how to use versioning mechanisms ' +
      '(extack, flags fields, new attribute numbers) to evolve interfaces safely. ' +
      'Use before making any change to an existing kernel API.',
    parameters: {
      type: 'object',
      properties: {
        interfaceClass: {
          type: 'string',
          enum: [
            'uapi_header',
            'generic_netlink_family',
            'netlink_message',
            'ioctl_command',
            'sysfs_attribute',
            'syscall',
            'bpf_helper',
            'kfunc',
          ],
          description: 'The class of kernel interface to retrieve compatibility rules for.',
        },
        stabilityLevel: {
          type: 'string',
          enum: ['stable', 'unstable', 'internal', 'auto'],
          description:
            'Stability level of the interface. "stable" interfaces have strict rules. ' +
            '"unstable" allows breaking changes with proper deprecation. ' +
            '"internal" is kernel-only with no UAPI contract. Use "auto" to infer ' +
            'from the interface class.',
        },
        includeExamples: {
          type: 'boolean',
          description:
            'If true, include concrete examples of safe vs unsafe changes for this ' +
            'interface class.',
        },
      },
      required: ['interfaceClass'],
      additionalProperties: false,
    },
  },
]

// ---------------------------------------------------------------------------
// Convenience: look up a single tool by name
// ---------------------------------------------------------------------------
export function getToolByName(name: string): ToolDefinition | undefined {
  return AI_TOOLS.find((t) => t.name === name)
}

// ---------------------------------------------------------------------------
// Convenience: get a subset of tools by name
// ---------------------------------------------------------------------------
export function getTools(names: string[]): ToolDefinition[] {
  return AI_TOOLS.filter((t) => names.includes(t.name))
}
