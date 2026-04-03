import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateSchemaSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  // transport: GENERIC_NETLINK | IOCTL | CHAR_DEVICE
  transport: z.enum(['GENERIC_NETLINK', 'IOCTL', 'CHAR_DEVICE']),
  namespace: z.string().optional().nullable(),
  family: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  compatibilityPolicy: z.string().optional().nullable(),
  permissionsModel: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // status: DRAFT | PUBLISHED | DEPRECATED
  status: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED']).optional(),
})

// ---------------------------------------------------------------------------
// POST /api/schemas
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const result = CreateSchemaSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 },
      )
    }

    const data = result.data

    // Verify the project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Determine next version number for this project
    const lastSchema = await prisma.apiSchema.findFirst({
      where: { projectId: data.projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (lastSchema?.version ?? 0) + 1

    const schema = await prisma.apiSchema.create({
      data: {
        projectId: data.projectId,
        version: nextVersion,
        transport: data.transport,
        namespace: data.namespace ?? null,
        family: data.family ?? null,
        summary: data.summary ?? null,
        compatibilityPolicy: data.compatibilityPolicy ?? null,
        permissionsModel: data.permissionsModel ?? null,
        notes: data.notes ?? null,
        status: data.status ?? 'DRAFT',
      },
    })

    return NextResponse.json(schema, { status: 201 })
  } catch (error) {
    console.error('[POST /api/schemas]', error)
    return NextResponse.json(
      { error: 'Failed to create schema' },
      { status: 500 },
    )
  }
}
