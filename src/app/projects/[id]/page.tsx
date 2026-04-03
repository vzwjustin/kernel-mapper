'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Terminal,
  Radio,
  Box,
  Clock,
  Bot,
  AlertTriangle,
} from 'lucide-react'
import type { Project, ApiSchema, AiInteraction } from '@/types/domain'

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

interface ProjectDetail extends Project {
  schemas: ApiSchema[]
  aiInteractions?: AiInteraction[]
}

async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${id}`)
  if (!res.ok) throw new Error('Failed to load project')
  return res.json() as Promise<ProjectDetail>
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusStyle(status: string) {
  if (status === 'PUBLISHED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
  if (status === 'DEPRECATED') return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
  return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectOverviewPage() {
  const params = useParams()
  const id = params.id as string

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProjectDetail(id),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <AlertTriangle className="size-8 text-amber-400" />
        <p className="text-sm text-muted-foreground">Failed to load project.</p>
      </div>
    )
  }

  const schemas = data.schemas ?? []
  const interactions = data.aiInteractions ?? []

  // Quick stats across all schemas
  const commandCount = schemas.reduce((n, s) => n + (s.commands?.length ?? 0), 0)
  const eventCount = schemas.reduce((n, s) => n + (s.events?.length ?? 0), 0)
  const typeCount = schemas.reduce((n, s) => n + (s.typeDefs?.length ?? 0), 0)

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
        {/* Project header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
          {data.description && (
            <p className="text-sm text-muted-foreground">{data.description}</p>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Terminal className="size-3" /> Commands
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{commandCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Radio className="size-3" /> Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{eventCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Box className="size-3" /> Types
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{typeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Schema versions */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Schema Versions</h2>
            <Link href={`/projects/${id}/schema`}><Button size="sm"><Plus className="size-3.5" />New Schema Version</Button></Link>
          </div>
          <Separator />
          {schemas.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No schema versions yet.{' '}
              <Link href={`/projects/${id}/schema`} className="text-primary hover:underline">
                Create the first one.
              </Link>
            </p>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Version</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Transport</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {schemas.map((schema) => (
                    <tr
                      key={schema.id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2 font-mono">{schema.version}</td>
                      <td className="px-4 py-2">
                        <Badge className={`text-xs ${statusStyle(schema.status)}`}>
                          {schema.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{schema.transport}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(schema.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/projects/${id}/schema`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent AI interactions */}
        {interactions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Recent AI Interactions</h2>
            <Separator />
            <div className="flex flex-col gap-2">
              {interactions.slice(0, 5).map((interaction) => (
                <div
                  key={interaction.id}
                  className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/10 px-3 py-2"
                >
                  <Bot className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{interaction.prompt}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{interaction.mode}</span>
                      <span>·</span>
                      <Clock className="size-3" />
                      <span>{new Date(interaction.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
