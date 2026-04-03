'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Play, Download, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import type { ApiSchema, ValidationReport } from '@/types/domain'

// ---------------------------------------------------------------------------
// Dynamic Monaco import (SSR-safe)
// ---------------------------------------------------------------------------

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-muted/20">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  ),
})

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

interface SchemaDetail extends ApiSchema {
  commands: ApiSchema['commands']
  events: ApiSchema['events']
  typeDefs: ApiSchema['typeDefs']
}

async function fetchSchema(projectId: string): Promise<SchemaDetail> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (!res.ok) throw new Error('Failed to load schema')
  const json = await res.json() as { schemas?: SchemaDetail[] } & Record<string, unknown>
  const schemas = json.schemas ?? []
  if (!Array.isArray(schemas) || schemas.length === 0) {
    throw new Error('No schemas found for this project')
  }
  return schemas[0] as SchemaDetail
}

async function runValidation(schemaId: string): Promise<ValidationReport> {
  const res = await fetch(`/api/schemas/${schemaId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persist: true }),
  })
  if (!res.ok) throw new Error('Validation failed')
  const json = await res.json() as { data: ValidationReport }
  return json.data
}

async function generateArtifacts(schemaId: string): Promise<void> {
  const res = await fetch(`/api/schemas/${schemaId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('Generation failed')
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'PUBLISHED'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
      : status === 'DEPRECATED'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
        : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
  return <Badge className={`text-xs ${cls}`}>{status}</Badge>
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchemaEditorPage() {
  const params = useParams()
  const projectId = params.id as string
  const queryClient = useQueryClient()

  const { data: schema, isLoading, isError } = useQuery({
    queryKey: ['project-schema', projectId],
    queryFn: () => fetchSchema(projectId),
    enabled: !!projectId,
  })

  const validateMutation = useMutation({
    mutationFn: () => runValidation(schema!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-schema', projectId] })
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => generateArtifacts(schema!.id),
  })

  const schemaJson = React.useMemo(() => {
    if (!schema) return ''
    return JSON.stringify(schema, null, 2)
  }, [schema])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !schema) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <AlertTriangle className="size-8 text-amber-400" />
        <p className="text-sm text-muted-foreground">Failed to load schema.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Monaco editor — main area */}
      <div className="flex-1 min-w-0">
        <MonacoEditor
          height="100%"
          defaultLanguage="json"
          value={schemaJson}
          theme="vs-dark"
          options={{
            readOnly: false,
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
          }}
        />
      </div>

      {/* Side panel */}
      <div className="w-72 shrink-0 border-l border-border/50 flex flex-col bg-card">
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-5 p-4">
            {/* Metadata */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Metadata
              </h3>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <StatusBadge status={schema.status} />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Transport</Label>
                  <p className="text-xs font-mono text-foreground">{schema.transport}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Namespace</Label>
                  <p className="text-xs font-mono text-foreground">{schema.namespace || '—'}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Version</Label>
                  <p className="text-xs font-mono text-foreground">{schema.version}</p>
                </div>

                {schema.summary && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Summary</Label>
                    <p className="text-xs text-foreground leading-relaxed">{schema.summary}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Validation status */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Validation
              </h3>

              {validateMutation.isSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400">
                    {validateMutation.data?.passed ? 'All checks passed' : `${validateMutation.data?.counts.errors ?? 0} error(s) found`}
                  </p>
                </div>
              )}

              {validateMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">Validation request failed</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="shrink-0 flex flex-col gap-2 border-t border-border/50 p-4">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Validate
          </Button>

          <Button
            size="sm"
            className="w-full justify-start"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Generate
          </Button>

          {generateMutation.isSuccess && (
            <p className="text-xs text-emerald-400 text-center">Artifacts generated.</p>
          )}
          {generateMutation.isError && (
            <p className="text-xs text-red-400 text-center">Generation failed.</p>
          )}

          <a
            href={`data:application/json,${encodeURIComponent(schemaJson)}`}
            download={`schema-${schema.version}.json`}
            className="inline-flex items-center gap-1.5 w-full px-2.5 h-7 rounded-[min(var(--radius-md),12px)] text-[0.8rem] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="size-3.5" />
            Download JSON
          </a>
        </div>
      </div>
    </div>
  )
}
