import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  generatorVersion: z.string().optional(),
  targetKernelRange: z.string().optional(),
  targetUserspaceLanguages: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.project.count(),
    ])

    return NextResponse.json({ projects, total, page, limit })
  } catch (error) {
    console.error('[GET /api/projects]', error)
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const result = CreateProjectSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 },
      )
    }

    const data = result.data
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        generatorVersion: data.generatorVersion ?? null,
        targetKernelRange: data.targetKernelRange ?? null,
        targetUserspaceLanguages: data.targetUserspaceLanguages ?? null,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects]', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 },
    )
  }
}
