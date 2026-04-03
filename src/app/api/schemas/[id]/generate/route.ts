import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { ArtifactType } from '@/types/domain'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const GenerateRequestSchema = z.object({
  targets: z
    .array(
      z.enum([
        'SCHEMA_JSON',
        'SCHEMA_YAML',
        'MARKDOWN_DOCS',
        'TS_CLIENT',
        'C_UAPI_HEADER',
        'KERNEL_SCAFFOLD',
        'EXAMPLE_CLI',
        'TEST_SCAFFOLD',
        'VALIDATION_REPORT',
        'DIFF_SUMMARY',
      ]),
    )
    .min(1, 'At least one target is required'),
})

// ---------------------------------------------------------------------------
// Route params type
// ---------------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Generator helpers
// ---------------------------------------------------------------------------

function generateSchemaJson(schema: NonNullable<Awaited<ReturnType<typeof fetchSchema>>>): string {
  // Serialize the full schema as pretty-printed JSON.
  return JSON.stringify(schema, null, 2)
}

function generateMarkdownDocs(schema: NonNullable<Awaited<ReturnType<typeof fetchSchema>>>): string {
  const lines: string[] = []

  lines.push(`# ${schema.family ?? schema.namespace ?? schema.id} API Schema`)
  lines.push('')
  if (schema.summary) {
    lines.push(schema.summary)
    lines.push('')
  }
  lines.push(`**Transport:** ${schema.transport}`)
  if (schema.namespace) lines.push(`**Namespace:** ${schema.namespace}`)
  if (schema.family) lines.push(`**Family:** ${schema.family}`)
  lines.push(`**Status:** ${schema.status}`)
  lines.push(`**Version:** ${schema.version}`)
  lines.push('')

  // Commands
  if (schema.commands.length > 0) {
    lines.push('## Commands')
    lines.push('')
    for (const cmd of schema.commands) {
      lines.push(`### ${cmd.name}`)
      if (cmd.description) lines.push(cmd.description)
      lines.push('')
      lines.push(`- **Interaction style:** ${cmd.interactionStyle}`)
      lines.push(`- **Idempotent:** ${cmd.idempotent ? 'yes' : 'no'}`)
      if (cmd.privilegeRequirement) {
        lines.push(`- **Privilege requirement:** ${cmd.privilegeRequirement}`)
      }
      if (cmd.deprecated) lines.push('- **Deprecated:** yes')
      lines.push('')
    }
  }

  // Events
  if (schema.events.length > 0) {
    lines.push('## Events')
    lines.push('')
    for (const evt of schema.events) {
      lines.push(`### ${evt.name}`)
      if (evt.deliveryNotes) lines.push(evt.deliveryNotes)
      lines.push('')
      lines.push(`- **Subscription model:** ${evt.subscriptionModel}`)
      lines.push(`- **Filtering support:** ${evt.filteringSupport ? 'yes' : 'no'}`)
      if (evt.rateLimitNotes) lines.push(`- **Rate limit notes:** ${evt.rateLimitNotes}`)
      lines.push('')
    }
  }

  // Types
  if (schema.typeDefs.length > 0) {
    lines.push('## Types')
    lines.push('')
    for (const td of schema.typeDefs) {
      lines.push(`### ${td.name} (${td.kind})`)
      if (td.description) lines.push(td.description)
      lines.push('')

      if (td.fields.length > 0) {
        lines.push('| Field | Type | Optional | Reserved |')
        lines.push('|-------|------|----------|----------|')
        for (const f of td.fields) {
          lines.push(
            `| ${f.name} | ${f.fieldType} | ${f.optional ? 'yes' : 'no'} | ${f.reserved ? 'yes' : 'no'} |`,
          )
        }
        lines.push('')
      }

      if (td.enumVariants.length > 0) {
        lines.push('| Variant | Value |')
        lines.push('|---------|-------|')
        for (const v of td.enumVariants) {
          lines.push(`| ${v.name} | ${v.value} |`)
        }
        lines.push('')
      }
    }
  }

  // Permissions
  if (schema.permissions.length > 0) {
    lines.push('## Permissions')
    lines.push('')
    for (const p of schema.permissions) {
      lines.push(`### ${p.capability}`)
      if (p.description) lines.push(p.description)
      lines.push(`- **Namespace aware:** ${p.namespaceAware ? 'yes' : 'no'}`)
      if (p.privilegeNotes) lines.push(`- **Notes:** ${p.privilegeNotes}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Fetch schema with all relations needed for generation
// ---------------------------------------------------------------------------

async function fetchSchema(id: string) {
  return prisma.apiSchema.findUnique({
    where: { id },
    include: {
      commands: true,
      events: true,
      typeDefs: {
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
          enumVariants: { orderBy: { sortOrder: 'asc' } },
        },
      },
      permissions: true,
    },
  })
}

// ---------------------------------------------------------------------------
// POST /api/schemas/:id/generate
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const body: unknown = await request.json()
    const result = GenerateRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 },
      )
    }

    const { targets } = result.data

    const schema = await fetchSchema(id)
    if (!schema) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    const artifacts: Array<{
      type: ArtifactType
      filePath: string
      content: string
      warnings: string[]
    }> = []

    for (const target of targets) {
      switch (target) {
        case 'SCHEMA_JSON': {
          artifacts.push({
            type: 'SCHEMA_JSON',
            filePath: `schema-v${schema.version}.json`,
            content: generateSchemaJson(schema),
            warnings: [],
          })
          break
        }

        case 'MARKDOWN_DOCS': {
          artifacts.push({
            type: 'MARKDOWN_DOCS',
            filePath: `schema-v${schema.version}.md`,
            content: generateMarkdownDocs(schema),
            warnings: [],
          })
          break
        }

        default: {
          // Targets not yet implemented — return a skeleton placeholder.
          artifacts.push({
            type: target,
            filePath: `${target.toLowerCase().replace(/_/g, '-')}-v${schema.version}.txt`,
            content: `# ${target}\n\nGeneration for this artifact type is not yet implemented.\n`,
            warnings: [`${target} generator is not yet implemented`],
          })
          break
        }
      }
    }

    return NextResponse.json({ schemaId: id, artifacts })
  } catch (error) {
    console.error('[POST /api/schemas/:id/generate]', error)
    return NextResponse.json(
      { error: 'Generation failed' },
      { status: 500 },
    )
  }
}
