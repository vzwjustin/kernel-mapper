'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Download, Loader2, RefreshCw, FileCode2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeneratedArtifact, ArtifactType } from '@/types/domain'

// ---------------------------------------------------------------------------
// Dynamic Monaco
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

async function fetchArtifacts(projectId: string): Promise<GeneratedArtifact[]> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (!res.ok) throw new Error('Failed to load project')
  const json = await res.json() as { schemas?: Array<{ id: string; artifacts?: GeneratedArtifact[] }> }
  const schemas = json.schemas ?? []
  if (schemas.length === 0) return []
  // Get artifacts from latest schema
  return schemas[0]?.artifacts ?? []
}

async function fetchSchemaId(projectId: string): Promise<string | null> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (!res.ok) return null
  const json = await res.json() as { schemas?: Array<{ id: string }> }
  return json.schemas?.[0]?.id ?? null
}

async function regenerateAll(schemaId: string): Promise<void> {
  const res = await fetch(`/api/schemas/${schemaId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('Regeneration failed')
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

const ARTIFACT_GROUPS: Record<string, ArtifactType[]> = {
  'Schema': ['SCHEMA_JSON', 'SCHEMA_YAML'],
  'Documentation': ['MARKDOWN_DOCS'],
  'Bindings': ['TS_CLIENT', 'C_UAPI_HEADER'],
  'Kernel': ['KERNEL_SCAFFOLD'],
  'Developer': ['EXAMPLE_CLI', 'TEST_SCAFFOLD'],
  'Reports': ['VALIDATION_REPORT', 'DIFF_SUMMARY'],
}

function getGroupForType(type: ArtifactType): string {
  for (const [group, types] of Object.entries(ARTIFACT_GROUPS)) {
    if ((types as string[]).includes(type)) return group
  }
  return 'Other'
}

function getLanguageForArtifact(artifact: GeneratedArtifact): string {
  if (artifact.type === 'SCHEMA_JSON' || artifact.type === 'VALIDATION_REPORT' || artifact.type === 'DIFF_SUMMARY') return 'json'
  if (artifact.type === 'SCHEMA_YAML') return 'yaml'
  if (artifact.type === 'TS_CLIENT') return 'typescript'
  if (artifact.type === 'C_UAPI_HEADER' || artifact.type === 'KERNEL_SCAFFOLD') return 'c'
  if (artifact.type === 'MARKDOWN_DOCS' || artifact.type === 'EXAMPLE_CLI' || artifact.type === 'TEST_SCAFFOLD') return 'markdown'
  return 'plaintext'
}

function artifactLabel(type: ArtifactType): string {
  const labels: Record<ArtifactType, string> = {
    SCHEMA_JSON: 'Schema JSON',
    SCHEMA_YAML: 'Schema YAML',
    MARKDOWN_DOCS: 'Markdown Docs',
    TS_CLIENT: 'TypeScript Client',
    C_UAPI_HEADER: 'C UAPI Header',
    KERNEL_SCAFFOLD: 'Kernel Scaffold',
    EXAMPLE_CLI: 'Example CLI',
    TEST_SCAFFOLD: 'Test Scaffold',
    VALIDATION_REPORT: 'Validation Report',
    DIFF_SUMMARY: 'Diff Summary',
  }
  return labels[type] ?? type
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArtifactsPage() {
  const params = useParams()
  const projectId = params.id as string
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const { data: artifacts = [], isLoading, isError } = useQuery({
    queryKey: ['artifacts', projectId],
    queryFn: () => fetchArtifacts(projectId),
    enabled: !!projectId,
  })

  const { data: schemaId } = useQuery({
    queryKey: ['schema-id', projectId],
    queryFn: () => fetchSchemaId(projectId),
    enabled: !!projectId,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateAll(schemaId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['artifacts', projectId] })
    },
  })

  const selected = artifacts.find((a) => a.id === selectedId) ?? artifacts[0] ?? null

  // Group artifacts
  const grouped = React.useMemo(() => {
    const map = new Map<string, GeneratedArtifact[]>()
    for (const artifact of artifacts) {
      const group = getGroupForType(artifact.type)
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(artifact)
    }
    return map
  }, [artifacts])

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
        <p className="text-sm text-muted-foreground">Failed to load artifacts.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-border/50 flex flex-col bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Artifacts
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending || !schemaId}
            title="Regenerate all"
          >
            <RefreshCw className={cn('size-3.5', regenerateMutation.isPending && 'animate-spin')} />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {artifacts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
              <FileCode2 className="size-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No artifacts yet. Generate from the Schema tab.</p>
            </div>
          ) : (
            <div className="flex flex-col py-2">
              {Array.from(grouped.entries()).map(([group, items]) => (
                <div key={group}>
                  <p className="px-4 py-1.5 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                    {group}
                  </p>
                  {items.map((artifact) => (
                    <button
                      key={artifact.id}
                      onClick={() => setSelectedId(artifact.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-2 text-left text-xs transition-colors',
                        (selected?.id === artifact.id)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                      )}
                    >
                      <ChevronRight className="size-3 shrink-0" />
                      <span className="truncate">{artifactLabel(artifact.type)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {regenerateMutation.isError && (
          <p className="px-4 py-2 text-xs text-red-400 border-t border-border/50 shrink-0">
            Regeneration failed.
          </p>
        )}
        {regenerateMutation.isSuccess && (
          <p className="px-4 py-2 text-xs text-emerald-400 border-t border-border/50 shrink-0">
            Artifacts regenerated.
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            {/* Artifact header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0 bg-card">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{artifactLabel(selected.type)}</p>
                <p className="text-xs text-muted-foreground font-mono">{selected.filePath}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="text-xs bg-zinc-500/15 text-zinc-400 border-zinc-500/25">
                  v{selected.schemaVersion}
                </Badge>
                {selected.warnings.length > 0 && (
                  <Badge className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/25">
                    {selected.warnings.length} warning{selected.warnings.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                <a
                  href={`data:text/plain,${encodeURIComponent(selected.content)}`}
                  download={selected.filePath.split('/').pop() ?? 'artifact'}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[min(var(--radius-md),12px)] text-[0.8rem] border border-border bg-background hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Download className="size-3.5" />
                  Download
                </a>
              </div>
            </div>

            {/* Warnings */}
            {selected.warnings.length > 0 && (
              <div className="flex flex-col gap-1 px-4 py-2 border-b border-border/50 bg-amber-500/5 shrink-0">
                {selected.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">
                    <AlertTriangle className="size-3 inline mr-1" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            <Separator className="shrink-0" />

            {/* Monaco viewer */}
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={getLanguageForArtifact(selected)}
                value={selected.content}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Select an artifact to view its content.</p>
          </div>
        )}
      </div>
    </div>
  )
}
