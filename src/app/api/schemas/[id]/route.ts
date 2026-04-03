import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const UpdateSchemaSchema = z.object({
  transport: z.enum(['GENERIC_NETLINK', 'IOCTL', 'CHAR_DEVICE']).optional(),
  namespace: z.string().optional().nullable(),
  family: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  compatibilityPolicy: z.string().optional().nullable(),
  permissionsModel: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED']).optional(),
})

// ---------------------------------------------------------------------------
// Route params type
// ---------------------------------------------------------------------------

type RouteParams = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET /api/schemas/:id
// Returns the full schema with all nested relations.
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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
        generatedArtifacts: { orderBy: { createdAt: 'desc' } },
        validationFindings: { orderBy: { createdAt: 'desc' } },
        schemaVersions: { orderBy: { version: 'desc' } },
      },
    })

    if (!schema) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    return NextResponse.json(schema)
  } catch (error) {
    console.error('[GET /api/schemas/:id]', error)
    return NextResponse.json(
      { error: 'Failed to fetch schema' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/schemas/:id
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body: unknown = await request.json()
    const result = UpdateSchemaSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 },
      )
    }

    const existing = await prisma.apiSchema.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    const updated = await prisma.apiSchema.update({
      where: { id },
      data: result.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/schemas/:id]', error)
    return NextResponse.json(
      { error: 'Failed to update schema' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/schemas/:id
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const existing = await prisma.apiSchema.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    await prisma.apiSchema.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[DELETE /api/schemas/:id]', error)
    return NextResponse.json(
      { error: 'Failed to delete schema' },
      { status: 500 },
    )
  }
}
