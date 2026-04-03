import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSchema } from '@/lib/validation/engine'
import type { SchemaForValidation } from '@/lib/validation/types'

// ---------------------------------------------------------------------------
// Route params type
// ---------------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/schemas/:id/validate
// Runs the full validation engine against the schema and returns a
// ValidationReport. Does NOT persist findings to the DB — callers that want
// to store results should save ValidationFinding rows themselves.
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Fetch the schema with all relations required by the validators.
    const schema = await prisma.apiSchema.findUnique({
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

    if (!schema) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    // Transform the Prisma record into the shape expected by the validation engine.
    // Explicit parameter types on map callbacks are required because the Prisma
    // client types are only available after `prisma generate`; without them the
    // compiler falls back to `any`, which causes noImplicitAny errors.
    type PrismaCommand = (typeof schema.commands)[number]
    type PrismaEvent = (typeof schema.events)[number]
    type PrismaTd = (typeof schema.typeDefs)[number]
    type PrismaField = (typeof schema.typeDefs)[number]['fields'][number]
    type PrismaVariant = (typeof schema.typeDefs)[number]['enumVariants'][number]
    type PrismaPermission = (typeof schema.permissions)[number]

    const schemaForValidation: SchemaForValidation = {
      id: schema.id,
      version: schema.version,
      transport: schema.transport,
      namespace: schema.namespace ?? '',
      family: schema.family ?? '',
      commands: schema.commands.map((cmd: PrismaCommand) => ({
        id: cmd.id,
        name: cmd.name,
        requestTypeId: cmd.requestTypeId ?? null,
        responseTypeId: cmd.responseTypeId ?? null,
        interactionStyle: cmd.interactionStyle,
        privilegeRequirement: cmd.privilegeRequirement ?? null,
        idempotent: cmd.idempotent,
        deprecated: cmd.deprecated,
        replacementCommandId: cmd.replacementCommandId ?? null,
      })),
      events: schema.events.map((evt: PrismaEvent) => ({
        id: evt.id,
        name: evt.name,
        payloadTypeId: evt.payloadTypeId ?? null,
        subscriptionModel: evt.subscriptionModel,
        filteringSupported: evt.filteringSupport,
      })),
      typeDefs: schema.typeDefs.map((td: PrismaTd) => ({
        id: td.id,
        name: td.name,
        kind: td.kind,
        fields: td.fields.map((f: PrismaField) => ({
          id: f.id,
          name: f.name,
          fieldType: f.fieldType,
          optional: f.optional,
          reserved: f.reserved,
          arrayLength: null,
        })),
        variants: td.enumVariants.map((v: PrismaVariant) => ({
          id: v.id,
          name: v.name,
          value: v.value,
        })),
      })),
      permissions: schema.permissions.map((p: PrismaPermission) => ({
        id: p.id,
        capability: p.capability,
        namespaceAware: p.namespaceAware,
      })),
    }

    const report = validateSchema(schemaForValidation)

    return NextResponse.json(report)
  } catch (error) {
    console.error('[POST /api/schemas/:id/validate]', error)
    return NextResponse.json(
      { error: 'Validation run failed' },
      { status: 500 },
    )
  }
}
