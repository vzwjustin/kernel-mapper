'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  Clock,
  Layers,
  FolderOpen,
  AlertTriangle,
  Terminal,
  Zap,
  ShieldCheck,
  Network,
  ArrowRight,
  Sparkles,
  FileCode,
  Activity,
} from 'lucide-react'
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
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="bg-card/60 border-border/40 backdrop-blur-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex items-center justify-center size-11 rounded-xl ${color}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function ProjectCardSkeleton() {
  return (
    <Card className="bg-card/60 border-border/40 animate-pulse">
      <CardHeader className="gap-2">
        <div className="h-5 w-36 rounded-md bg-muted/50" />
        <div className="h-3 w-52 rounded bg-muted/30" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="h-3 w-20 rounded bg-muted/30" />
          <div className="h-3 w-16 rounded bg-muted/30" />
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

  const statusColor: Record<string, string> = {
    PUBLISHED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    DEPRECATED: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    DRAFT: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  }

  const transportIcon: Record<string, React.ElementType> = {
    GENERIC_NETLINK: Network,
    IOCTL: Terminal,
    CHAR_DEVICE: FileCode,
  }
  const TransportIcon = latestSchema ? (transportIcon[latestSchema.transport] ?? Network) : Network

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="bg-card/60 border-border/40 transition-all duration-200 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 border border-primary/20">
                <TransportIcon className="size-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold leading-tight text-foreground">
                {project.name}
              </CardTitle>
            </div>
            {latestSchema && (
              <Badge className={`shrink-0 text-[10px] px-1.5 py-0 ${statusColor[latestSchema.status] ?? statusColor.DRAFT}`}>
                {latestSchema.status}
              </Badge>
            )}
          </div>
          {project.description && (
            <CardDescription className="text-xs line-clamp-2 mt-1.5">
              {project.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="size-3 text-blue-400/70" />
                {schemaCount} schema{schemaCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3 text-violet-400/70" />
                {updatedAt}
              </span>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-200 -translate-x-1 group-hover:translate-x-0" />
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
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-center size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-primary/20">
          <FolderOpen className="size-9 text-primary" />
        </div>
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <p className="text-lg font-semibold text-foreground">No projects yet</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Create your first project to start designing a Linux kernel API with visual tools and AI assistance.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/projects/new">
          <Button className="gap-2">
            <Sparkles className="size-4" />
            Create from Prompt
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

function QuickActions() {
  const actions = [
    {
      title: 'Create from Prompt',
      desc: 'Describe your API in plain English',
      href: '/projects/new',
      icon: Sparkles,
      color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    },
    {
      title: 'Import Codebase',
      desc: 'Reverse-engineer an existing API',
      href: '/projects/new',
      icon: FileCode,
      color: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    },
    {
      title: 'Browse Templates',
      desc: 'Start from a netlink template',
      href: '/projects/new',
      icon: Network,
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((a) => (
        <Link key={a.title} href={a.href}>
          <Card className="bg-card/40 border-border/30 hover:border-border/60 hover:bg-card/60 transition-all duration-200 cursor-pointer group">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex items-center justify-center size-9 rounded-lg border ${a.color}`}>
                <a.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex items-center justify-center size-12 rounded-xl bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
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

  const projects = data?.projects ?? []
  const filtered = React.useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    )
  }, [projects, search])

  const totalSchemas = projects.reduce((acc, p) => acc + (p.schemas?.length ?? 0), 0)
  const publishedCount = projects.filter((p) => p.schemas?.[0]?.status === 'PUBLISHED').length

  return (
    <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your Linux kernel API projects
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="size-4" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={projects.length}
          icon={FolderOpen}
          color="bg-blue-500/10 text-blue-400 border border-blue-500/20"
        />
        <StatCard
          label="Schema Versions"
          value={totalSchemas}
          icon={Layers}
          color="bg-violet-500/10 text-violet-400 border border-violet-500/20"
        />
        <StatCard
          label="Published"
          value={publishedCount}
          icon={ShieldCheck}
          color="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        />
        <StatCard
          label="Validation Score"
          value={projects.length > 0 ? '—' : '—'}
          icon={Activity}
          color="bg-amber-500/10 text-amber-400 border border-amber-500/20"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
        <QuickActions />
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Projects {!isLoading && `(${filtered.length})`}
          </h2>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-card/40 border-border/40"
            />
          </div>
        </div>

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
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No projects match &ldquo;{search}&rdquo;
              </p>
            </div>
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
    </div>
  )
}
