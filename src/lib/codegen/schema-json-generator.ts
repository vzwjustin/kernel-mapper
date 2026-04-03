import type { Generator, GeneratorInput, GeneratedArtifact } from './types'
import { toSnakeCase } from './utils'

// ---------------------------------------------------------------------------
// Schema JSON Generator
//
// Produces a clean, canonical JSON representation of the kernel API schema
// suitable for programmatic consumption, schema diffing, or archiving.
// ---------------------------------------------------------------------------

export class SchemaJsonGenerator implements Generator {
  readonly type = 'SCHEMA_JSON' as const

  generate(input: GeneratorInput): GeneratedArtifact {
    const { schema, generatorVersion } = input
    const warnings: string[] = []

    const family = toSnakeCase(schema.family || schema.namespace || 'unknown')

    const output = {
      $schema: 'https://kernelcanvas.dev/schema/v1/schema.json',
      generatedBy: `KernelCanvas v${generatorVersion}`,
      generatedAt: new Date().toISOString(),
      schemaId: schema.id,
      version: schema.version,
      transport: schema.transport,
      namespace: schema.namespace,
      family,
      summary: schema.summary,

      commands: schema.commands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        interactionStyle: cmd.interactionStyle,
        privilegeRequirement: cmd.privilegeRequirement ?? null,
        idempotent: cmd.idempotent,
        deprecated: cmd.deprecated,
        requestType: cmd.requestType
          ? {
              name: cmd.requestType.name,
              fields: cmd.requestType.fields.map(f => ({
                name: f.name,
                fieldType: f.fieldType,
                optional: f.optional,
                reserved: f.reserved,
                description: f.description,
              })),
            }
          : null,
        responseType: cmd.responseType
          ? {
              name: cmd.responseType.name,
              fields: cmd.responseType.fields.map(f => ({
                name: f.name,
                fieldType: f.fieldType,
                optional: f.optional,
                reserved: f.reserved,
                description: f.description,
              })),
            }
          : null,
      })),

      events: schema.events.map(evt => ({
        name: evt.name,
        description: evt.description,
        subscriptionModel: evt.subscriptionModel,
        payloadType: evt.payloadType
          ? {
              name: evt.payloadType.name,
              fields: evt.payloadType.fields.map(f => ({
                name: f.name,
                fieldType: f.fieldType,
                optional: f.optional,
              })),
            }
          : null,
      })),

      types: schema.typeDefs.map(td => ({
        name: td.name,
        kind: td.kind,
        description: td.description,
        fields: td.fields.map(f => ({
          name: f.name,
          fieldType: f.fieldType,
          optional: f.optional,
          reserved: f.reserved,
          description: f.description,
        })),
        variants: td.variants.map(v => ({
          name: v.name,
          value: v.value,
          description: v.description,
        })),
      })),

      permissions: schema.permissions.map(p => ({
        capability: p.capability,
        description: p.description,
        namespaceAware: p.namespaceAware,
      })),
    }

    if (schema.commands.length === 0 && schema.events.length === 0) {
      warnings.push('Schema has no commands and no events — output will be mostly empty.')
    }

    return {
      filePath: `${family}.schema.json`,
      artifactType: 'SCHEMA_JSON',
      content: JSON.stringify(output, null, 2),
      generatorVersion,
      warnings,
    }
  }
}
