'use client'

import * as React from 'react'
import {
  Search,
  Plus,
  FolderOpen,
  FileCode,
  Shield,
  AlertTriangle,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useUiStore, type LeftPanelTab } from '@/stores/ui-store'

// ---------------------------------------------------------------------------
// Explorer tab
// ---------------------------------------------------------------------------

function ExplorerTab() {
  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Project
        </span>
        <Button variant="ghost" size="icon-xs" aria-label="Add file">
          <Plus className="size-3" />
        </Button>
      </div>

      {/* Placeholder tree nodes */}
      <div className="flex flex-col gap-0.5">
        <button className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors">
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          <FolderOpen className="size-3.5 shrink-0 text-amber-400" />
          <span className="truncate text-foreground/80">kernel-api-schema</span>
        </button>
        <div className="pl-5 flex flex-col gap-0.5">
          <button className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors">
            <FileCode className="size-3.5 shrink-0 text-blue-400" />
            <span className="truncate text-foreground/80">commands.yaml</span>
          </button>
          <button className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors">
            <FileCode className="size-3.5 shrink-0 text-blue-400" />
            <span className="truncate text-foreground/80">events.yaml</span>
          </button>
          <button className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors">
            <FileCode className="size-3.5 shrink-0 text-blue-400" />
            <span className="truncate text-foreground/80">types.yaml</span>
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-border/60 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Project explorer will show the file tree of the current schema project.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entities tab
// ---------------------------------------------------------------------------

type EntityKind = 'command' | 'event' | 'type'

function EntityRow({ label, kind, count }: { label: string; kind: EntityKind; count: number }) {
  const color =
    kind === 'command' ? 'text-violet-400' :
    kind === 'event' ? 'text-cyan-400' :
    'text-emerald-400'

  const kindLabel =
    kind === 'command' ? 'CMD' :
    kind === 'event' ? 'EVT' :
    'TYPE'

  return (
    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors group">
      <span className={`shrink-0 font-mono text-[10px] font-semibold ${color}`}>
        {kindLabel}
      </span>
      <span className="flex-1 truncate text-foreground/80 group-hover:text-foreground">
        {label}
      </span>
      <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0 h-4">
        {count}
      </Badge>
    </button>
  )
}

function EntitiesTab() {
  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <Search className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filter entities…</span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Commands
          </span>
        </div>
        <EntityRow label="ReadKernelConfig" kind="command" count={3} />
        <EntityRow label="BuildModule" kind="command" count={5} />
        <EntityRow label="InspectSymbol" kind="command" count={2} />

        <div className="px-2 py-1 mt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Events
          </span>
        </div>
        <EntityRow label="ConfigParsed" kind="event" count={4} />
        <EntityRow label="ModuleBuilt" kind="event" count={2} />

        <div className="px-2 py-1 mt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Types
          </span>
        </div>
        <EntityRow label="KernelVersion" kind="type" count={1} />
        <EntityRow label="SymbolEntry" kind="type" count={6} />
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-border/60 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Entities panel will list all schema commands, events, and types with their field counts.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Artifacts tab
// ---------------------------------------------------------------------------

function ArtifactsTab() {
  const artifacts = [
    { name: 'kernel_api.rs', kind: 'Rust', status: 'ok' },
    { name: 'schema.json', kind: 'JSON', status: 'ok' },
    { name: 'openapi.yaml', kind: 'YAML', status: 'warn' },
    { name: 'types.ts', kind: 'TypeScript', status: 'ok' },
  ]

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Generated
        </span>
        <Button variant="ghost" size="icon-xs" aria-label="Regenerate all">
          <Plus className="size-3" />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5">
        {artifacts.map((a) => (
          <button
            key={a.name}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors"
          >
            <FileCode className="size-3.5 shrink-0 text-blue-400" />
            <span className="flex-1 truncate text-foreground/80">{a.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{a.kind}</span>
            {a.status === 'warn' && (
              <AlertTriangle className="size-3 text-amber-400 shrink-0" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-border/60 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Artifacts panel will list all generated output files from the schema.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation tab
// ---------------------------------------------------------------------------

function ValidationTab() {
  const findings = [
    { level: 'error' as const, message: 'Command ReadKernelConfig missing return type', location: 'commands.yaml:12' },
    { level: 'warning' as const, message: 'Event ConfigParsed has no consumers', location: 'events.yaml:4' },
    { level: 'info' as const, message: 'Type KernelVersion used in 3 commands', location: 'types.yaml:1' },
  ]

  const levelIcon = (level: 'error' | 'warning' | 'info') => {
    if (level === 'error') return <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
    if (level === 'warning') return <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
    return <Shield className="size-3.5 text-blue-400 shrink-0" />
  }

  const levelColor = (level: 'error' | 'warning' | 'info') => {
    if (level === 'error') return 'border-l-red-500/50'
    if (level === 'warning') return 'border-l-amber-500/50'
    return 'border-l-blue-500/50'
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2 px-1 pb-1">
        <Badge className="gap-1 bg-red-500/15 text-red-400 border-red-500/25">
          1 error
        </Badge>
        <Badge className="gap-1 bg-amber-500/15 text-amber-400 border-amber-500/25">
          1 warning
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        {findings.map((f, i) => (
          <div
            key={i}
            className={`rounded-md border-l-2 bg-muted/30 px-2.5 py-2 ${levelColor(f.level)}`}
          >
            <div className="flex items-start gap-1.5">
              {levelIcon(f.level)}
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs text-foreground/80 leading-snug">{f.message}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{f.location}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-lg border border-dashed border-border/60 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Validation panel will show all schema validation findings with severity and location.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left panel shell
// ---------------------------------------------------------------------------

const TAB_CONFIG: { value: LeftPanelTab; label: string; icon: React.ReactNode }[] = [
  { value: 'explorer', label: 'Explorer', icon: <FolderOpen className="size-3.5" /> },
  { value: 'entities', label: 'Entities', icon: <Layers className="size-3.5" /> },
  { value: 'artifacts', label: 'Artifacts', icon: <FileCode className="size-3.5" /> },
  { value: 'validation', label: 'Validation', icon: <Shield className="size-3.5" /> },
]

export function LeftPanel() {
  const { leftPanelTab, setLeftPanelTab } = useUiStore()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      <Tabs
        value={leftPanelTab}
        onValueChange={(v) => setLeftPanelTab(v as LeftPanelTab)}
        className="flex h-full flex-col gap-0"
      >
        <div className="border-b border-border/50 px-2 pt-2">
          <TabsList variant="line" className="w-full gap-0">
            {TAB_CONFIG.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 gap-1 text-xs px-1 py-1.5"
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="explorer" keepMounted={false}>
            <ExplorerTab />
          </TabsContent>
          <TabsContent value="entities" keepMounted={false}>
            <EntitiesTab />
          </TabsContent>
          <TabsContent value="artifacts" keepMounted={false}>
            <ArtifactsTab />
          </TabsContent>
          <TabsContent value="validation" keepMounted={false}>
            <ValidationTab />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
