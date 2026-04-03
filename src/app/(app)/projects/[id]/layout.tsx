'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/domain'

// ---------------------------------------------------------------------------
// Nav tabs config
// ---------------------------------------------------------------------------

const TABS = [
  { label: 'Overview', segment: '' },
  { label: 'Graph', segment: 'graph' },
  { label: 'Schema', segment: 'schema' },
  { label: 'Artifacts', segment: 'artifacts' },
  { label: 'Validation', segment: 'validation' },
  { label: 'Import', segment: 'import' },
] as const

// ---------------------------------------------------------------------------
// Project name fetch
// ---------------------------------------------------------------------------

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`)
  if (!res.ok) throw new Error('Failed to load project')
  const json = await res.json() as { project: Project } | Project
  // Route may return { project } or the project directly
  return ('project' in json ? json.project : json) as Project
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const id = params.id as string

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  })

  const projectName = project?.name ?? 'Loading…'

  // Determine active segment by checking pathname suffix
  const activeSegment = React.useMemo(() => {
    const base = `/projects/${id}`
    const rest = pathname.slice(base.length)
    // rest is either '' or '/<segment>'
    return rest.replace(/^\//, '')
  }, [pathname, id])

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb + tab bar */}
      <div className="flex flex-col border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs text-muted-foreground">
          <Activity className="size-3 text-primary" />
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-foreground font-medium truncate max-w-48">{projectName}</span>
        </div>

        {/* Tabs */}
        <nav className="flex items-end gap-0 px-4" aria-label="Project navigation">
          {TABS.map(({ label, segment }) => {
            const href = segment ? `/projects/${id}/${segment}` : `/projects/${id}`
            const isActive = activeSegment === segment

            return (
              <Link
                key={segment}
                href={href}
                className={cn(
                  'relative px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <Separator className="shrink-0" />

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
