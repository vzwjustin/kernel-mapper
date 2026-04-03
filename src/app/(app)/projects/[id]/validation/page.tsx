'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  Play,
  Loader2,
  ShieldCheck,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ValidationFinding, Severity, ValidationGroup } from '@/types/domain'

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

interface FindingsResponse {
  schemaId: string
  findings: ValidationFinding[]
}

async function fetchFindings(projectId: string): Promise<FindingsResponse | null> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (!res.ok) throw new Error('Failed to load project')
  const json = await res.json() as { schemas?: Array<{ id: string }> }
  const schemaId = json.schemas?.[0]?.id
  if (!schemaId) return null

  const findingsRes = await fetch(`/api/schemas/${schemaId}/findings`)
  if (!findingsRes.ok) return { schemaId, findings: [] }
  const findingsJson = await findingsRes.json() as { data?: ValidationFinding[] }
  return { schemaId, findings: findingsJson.data ?? [] }
}

async function runValidation(schemaId: string): Promise<ValidationFinding[]> {
  const res = await fetch(`/api/schemas/${schemaId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persist: true }),
  })
  if (!res.ok) throw new Error('Validation failed')
  const json = await res.json() as { data?: { findings: ValidationFinding[] } }
  return json.data?.findings ?? []
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityIcon(severity: Severity) {
  if (severity === 'ERROR') return <XCircle className="size-3.5 text-red-400 shrink-0" />
  if (severity === 'WARNING') return <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
  return <Info className="size-3.5 text-blue-400 shrink-0" />
}

function severityBadgeClass(severity: Severity): string {
  if (severity === 'ERROR') return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (severity === 'WARNING') return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
  return 'bg-blue-500/15 text-blue-400 border-blue-500/25'
}

// ---------------------------------------------------------------------------
// Group display names
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<ValidationGroup, string> = {
  SCHEMA_VALIDITY: 'Schema Validity',
  ABI_SAFETY: 'ABI Safety',
  WIRING_COMPLETENESS: 'Wiring Completeness',
  SECURITY: 'Security',
  DEVELOPER_QUALITY: 'Developer Quality',
}

// ---------------------------------------------------------------------------
// Finding card
// ---------------------------------------------------------------------------

function FindingCard({ finding }: { finding: ValidationFinding }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/10 p-3">
      <div className="flex items-start gap-2">
        {severityIcon(finding.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-medium text-foreground">{finding.code}</span>
            <Badge className={`text-xs ${severityBadgeClass(finding.severity)}`}>
              {finding.severity}
            </Badge>
            <Badge className="text-xs bg-zinc-500/15 text-zinc-400 border-zinc-500/25">
              {finding.confidence}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{finding.explanation}</p>
        </div>
      </div>

      {finding.suggestedFix && (
        <div className="rounded bg-muted/20 border border-border/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Suggested fix</p>
          <p className="text-xs text-foreground leading-relaxed">{finding.suggestedFix}</p>
        </div>
      )}

      {finding.impactedNodeIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {finding.impactedNodeIds.map((nodeId) => (
            <Badge
              key={nodeId}
              className="text-xs bg-zinc-500/10 text-zinc-500 border-zinc-500/20 font-mono"
            >
              {nodeId}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type SeverityFilter = 'ALL' | Severity

export default function ValidationPage() {
  const params = useParams()
  const projectId = params.id as string
  const queryClient = useQueryClient()

  const [severityFilter, setSeverityFilter] = React.useState<SeverityFilter>('ALL')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['findings', projectId],
    queryFn: () => fetchFindings(projectId),
    enabled: !!projectId,
  })

  const validateMutation = useMutation({
    mutationFn: () => runValidation(data!.schemaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['findings', projectId] })
    },
  })

  const findings = data?.findings ?? []

  const filtered = React.useMemo(() => {
    if (severityFilter === 'ALL') return findings
    return findings.filter((f) => f.severity === severityFilter)
  }, [findings, severityFilter])

  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length
  const infoCount = findings.filter((f) => f.severity === 'INFO').length
  const totalCount = findings.length
  const passedPercent = totalCount === 0 ? 100 : Math.round(((totalCount - errorCount) / totalCount) * 100)

  // Group filtered findings
  const grouped = React.useMemo(() => {
    const map = new Map<ValidationGroup, ValidationFinding[]>()
    for (const finding of filtered) {
      if (!map.has(finding.group)) map.set(finding.group, [])
      map.get(finding.group)!.push(finding)
    }
    return map
  }, [filtered])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <AlertTriangle className="size-8 text-amber-400" />
        <p className="text-sm text-muted-foreground">Failed to load validation data.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className="shrink-0 flex flex-col gap-3 px-6 py-4 border-b border-border/50 bg-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <XCircle className="size-3.5 text-red-400" />
              <span className="text-sm font-medium text-foreground">{errorCount}</span>
              <span className="text-xs text-muted-foreground">error{errorCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-400" />
              <span className="text-sm font-medium text-foreground">{warningCount}</span>
              <span className="text-xs text-muted-foreground">warning{warningCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="size-3.5 text-blue-400" />
              <span className="text-sm font-medium text-foreground">{infoCount}</span>
              <span className="text-xs text-muted-foreground">info</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {errorCount === 0 && findings.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                All clear
              </div>
            )}
            <Button
              size="sm"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending || !data?.schemaId}
            >
              {validateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Run Validation
            </Button>
          </div>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <Progress value={passedPercent} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground shrink-0">{passedPercent}% pass</span>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-b border-border/50 bg-background/50">
        <Filter className="size-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Severity:</span>
        {(['ALL', 'ERROR', 'WARNING', 'INFO'] as SeverityFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium transition-colors',
              severityFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Findings */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0 px-6 py-4 max-w-4xl">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ShieldCheck className="size-10 text-muted-foreground/40" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {findings.length === 0 ? 'No validation results yet' : 'No findings match the filter'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {findings.length === 0
                    ? 'Click "Run Validation" to check the schema.'
                    : 'Try changing the severity filter.'}
                </p>
              </div>
            </div>
          ) : (
            <Accordion multiple defaultValue={Array.from(grouped.keys())}>
              {Array.from(grouped.entries()).map(([group, groupFindings]) => (
                <AccordionItem key={group} value={group} className="border-border/40">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <span>{GROUP_LABELS[group]}</span>
                      <Badge className="text-xs bg-zinc-500/15 text-zinc-400 border-zinc-500/25">
                        {groupFindings.length}
                      </Badge>
                      {groupFindings.some((f) => f.severity === 'ERROR') && (
                        <Badge className="text-xs bg-red-500/15 text-red-400 border-red-500/25">
                          {groupFindings.filter((f) => f.severity === 'ERROR').length} error{groupFindings.filter((f) => f.severity === 'ERROR').length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2 pb-2">
                      {groupFindings.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </ScrollArea>

      {validateMutation.isError && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-t border-border/50 bg-red-500/5">
          <AlertTriangle className="size-3.5 text-red-400" />
          <p className="text-xs text-red-400">Validation request failed. Check your connection.</p>
        </div>
      )}
    </div>
  )
}
