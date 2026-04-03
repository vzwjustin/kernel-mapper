'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Clock, Layers, FolderOpen, AlertTriangle } from 'lucide-react'
import type { Project } from '@/types/domain'

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

interface ProjectsResponse {
  projects: Project[]
  total: number
  page: number
  limit: number
}

async function fetchProjects(): Promise<ProjectsResponse> {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error('Failed to load projects')
  return res.json() as Promise<ProjectsResponse>
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function ProjectCardSkeleton() {
  return (
    <Card className="bg-card border-border/50 animate-pulse">
      <CardHeader className="gap-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-3 w-48 rounded bg-muted/70" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="h-3 w-20 rounded bg-muted/50" />
          <div className="h-3 w-16 rounded bg-muted/50" />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Individual project card
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: Project }) {
  const schemaCount = project.schemas?.length ?? 0
  const latestSchema = project.schemas?.[0]
  const updatedAt = new Date(project.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const statusVariant = (status: string | undefined) => {
    if (status === 'PUBLISHED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
    if (status === 'DEPRECATED') return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
    return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
  }

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="bg-card border-border/50 transition-colors hover:border-border group-hover:bg-muted/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-tight">{project.name}</CardTitle>
            {latestSchema && (
              <Badge className={`shrink-0 text-xs ${statusVariant(latestSchema.status)}`}>
                {latestSchema.status}
              </Badge>
            )}
          </div>
          {project.description && (
            <CardDescription className="text-xs line-clamp-2">{project.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="size-3" />
              {schemaCount} schema{schemaCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {updatedAt}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex items-center justify-center size-14 rounded-xl bg-muted border border-border/50">
        <FolderOpen className="size-7 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">No projects yet</p>
        <p className="text-xs text-muted-foreground">Create your first project to get started designing a Linux kernel API.</p>
      </div>
      <Link href="/projects/new"><Button size="sm"><Plus className="size-3.5" />Create your first project</Button></Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <AlertTriangle className="size-8 text-amber-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [search, setSearch] = React.useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const filtered = React.useMemo(() => {
    if (!data?.projects) return []
    if (!search.trim()) return data.projects
    const q = search.toLowerCase()
    return data.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    )
  }, [data?.projects, search])

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <Link href="/projects/new"><Button size="sm"><Plus className="size-3.5" />New Project</Button></Link>
      </div>

      <Separator />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Content */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState message={(error as Error).message ?? 'Failed to load projects'} />
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        search.trim() ? (
          <p className="text-sm text-muted-foreground">No projects match &ldquo;{search}&rdquo;.</p>
        ) : (
          <EmptyState />
        )
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
