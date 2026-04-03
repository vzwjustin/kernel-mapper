'use client'

import * as React from 'react'
import {
  Terminal,
  Activity,
  AlertTriangle,
  FileDiff,
  Circle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useUiStore, type BottomPanelTab } from '@/stores/ui-store'

// ---------------------------------------------------------------------------
// Log level helpers
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success'

function LogLine({ level, time, message }: { level: LogLevel; time: string; message: string }) {
  const color =
    level === 'error' ? 'text-red-400' :
    level === 'warn' ? 'text-amber-400' :
    level === 'success' ? 'text-emerald-400' :
    level === 'debug' ? 'text-muted-foreground' :
    'text-foreground/70'

  const prefix =
    level === 'error' ? '[ERR]' :
    level === 'warn' ? '[WRN]' :
    level === 'success' ? '[OK] ' :
    level === 'debug' ? '[DBG]' :
    '[INF]'

  return (
    <div className="flex gap-2 px-3 py-0.5 hover:bg-muted/20 font-mono text-xs leading-5 group">
      <span className="shrink-0 text-muted-foreground/60 tabular-nums">{time}</span>
      <span className={`shrink-0 ${color}`}>{prefix}</span>
      <span className={`${color} break-all`}>{message}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Logs tab
// ---------------------------------------------------------------------------

function LogsTab() {
  const entries: { level: LogLevel; time: string; message: string }[] = [
    { level: 'info', time: '10:23:41', message: 'KernelCanvas initialized' },
    { level: 'info', time: '10:23:41', message: 'Loading project: kernel-api-schema' },
    { level: 'success', time: '10:23:42', message: 'Schema loaded — 3 commands, 2 events, 2 types' },
    { level: 'info', time: '10:23:42', message: 'Running validation pass...' },
    { level: 'warn', time: '10:23:42', message: 'Event ConfigParsed has no registered consumers' },
    { level: 'error', time: '10:23:42', message: 'Command ReadKernelConfig: return type not declared' },
    { level: 'info', time: '10:23:43', message: 'Codegen: generating Rust types...' },
    { level: 'success', time: '10:23:43', message: 'Codegen complete — 4 artifacts written' },
    { level: 'debug', time: '10:23:43', message: 'Canvas layout computed: 8 nodes, 6 edges' },
  ]

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col py-1">
        {entries.map((e, i) => (
          <LogLine key={i} {...e} />
        ))}
        <div className="px-3 py-2 text-xs text-muted-foreground">
          — Logs panel will stream real-time application and schema processing output —
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Trace tab
// ---------------------------------------------------------------------------

type TraceStatus = 'pending' | 'running' | 'done' | 'error'

function TraceStatusIcon({ status }: { status: TraceStatus }) {
  if (status === 'done') return <CheckCircle className="size-3.5 text-emerald-400 shrink-0" />
  if (status === 'error') return <XCircle className="size-3.5 text-red-400 shrink-0" />
  if (status === 'running') return <Circle className="size-3.5 text-blue-400 shrink-0 animate-pulse" />
  return <Clock className="size-3.5 text-muted-foreground shrink-0" />
}

function TraceStep({
  tool,
  input,
  output,
  duration,
  status,
}: {
  tool: string
  input: string
  output?: string
  duration?: string
  status: TraceStatus
}) {
  return (
    <div className="flex gap-2 px-3 py-1.5 hover:bg-muted/20 border-b border-border/30 last:border-0">
      <TraceStatusIcon status={status} />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-foreground/90">{tool}</span>
          {duration && (
            <span className="text-[10px] text-muted-foreground ml-auto">{duration}</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground truncate">in: {input}</span>
        {output && (
          <span className="font-mono text-[10px] text-emerald-400/70 truncate">out: {output}</span>
        )}
      </div>
    </div>
  )
}

function TraceTab() {
  const steps: Parameters<typeof TraceStep>[0][] = [
    { tool: 'schema.validate', input: 'kernel-api-schema@v0.1.0', output: '1 error, 1 warning', duration: '12ms', status: 'done' },
    { tool: 'codegen.rust', input: 'commands[ReadKernelConfig,BuildModule,InspectSymbol]', output: 'kernel_api.rs (142 lines)', duration: '38ms', status: 'done' },
    { tool: 'codegen.json-schema', input: 'schema@v0.1.0', output: 'schema.json (2.1KB)', duration: '9ms', status: 'done' },
    { tool: 'codegen.openapi', input: 'schema@v0.1.0', output: 'openapi.yaml (warning: missing servers)', duration: '14ms', status: 'error' },
    { tool: 'ai.suggest', input: 'node:ReadKernelConfig', output: '3 suggestions', duration: '420ms', status: 'done' },
  ]

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col py-1">
        {steps.map((s, i) => (
          <TraceStep key={i} {...s} />
        ))}
        <div className="px-3 py-2 text-xs text-muted-foreground">
          — Trace panel will record all AI tool calls and codegen operations with timing —
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Warnings tab
// ---------------------------------------------------------------------------

function WarningsTab() {
  const warnings = [
    { code: 'W001', message: 'Event ConfigParsed has no registered consumers', severity: 'warning' as const, file: 'events.yaml', line: 4 },
    { code: 'W002', message: 'Field arch is optional but not documented', severity: 'warning' as const, file: 'commands.yaml', line: 18 },
    { code: 'E001', message: 'Command ReadKernelConfig: return type not declared', severity: 'error' as const, file: 'commands.yaml', line: 12 },
    { code: 'I001', message: 'Type KernelVersion referenced in 3 commands', severity: 'info' as const, file: 'types.yaml', line: 1 },
  ]

  const colors = {
    error: 'text-red-400 bg-red-500/8 border-red-500/20',
    warning: 'text-amber-400 bg-amber-500/8 border-amber-500/20',
    info: 'text-blue-400 bg-blue-500/8 border-blue-500/20',
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-2">
        {warnings.map((w) => (
          <div
            key={w.code}
            className={`flex items-start gap-2 rounded border px-2.5 py-1.5 ${colors[w.severity]}`}
          >
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-semibold">{w.code}</span>
                <span className="text-xs leading-snug">{w.message}</span>
              </div>
              <span className="font-mono text-[10px] opacity-70">
                {w.file}:{w.line}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-1 rounded-lg border border-dashed border-border/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Warnings panel aggregates all validation findings for quick triage.
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Diff tab
// ---------------------------------------------------------------------------

function DiffTab() {
  const changes = [
    { type: 'added' as const, symbol: 'Command ReadKernelConfig.include_modules', detail: 'new field (bool, optional)' },
    { type: 'modified' as const, symbol: 'Type KernelVersion.patch', detail: 'type changed: u8 → u16' },
    { type: 'removed' as const, symbol: 'Event ModuleUnloaded', detail: 'entity removed' },
  ]

  const typeStyle = {
    added: 'text-emerald-400 bg-emerald-500/10',
    modified: 'text-amber-400 bg-amber-500/10',
    removed: 'text-red-400 bg-red-500/10',
  }

  const typeLabel = {
    added: '+',
    modified: '~',
    removed: '−',
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-2">
        <div className="flex items-center gap-2 px-1 pb-1">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <span className="text-emerald-400">+1</span>
            <span className="text-amber-400">~1</span>
            <span className="text-red-400">−1</span>
          </Badge>
          <span className="text-xs text-muted-foreground">since last save</span>
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden font-mono text-xs">
          {changes.map((c, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-2.5 py-1.5 border-b border-border/30 last:border-0 ${typeStyle[c.type]}`}
            >
              <span className="shrink-0 font-bold text-sm leading-4">{typeLabel[c.type]}</span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-medium break-all">{c.symbol}</span>
                <span className="text-[10px] opacity-70">{c.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border border-dashed border-border/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Diff panel will summarize schema changes since the last committed snapshot.
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Bottom panel shell
// ---------------------------------------------------------------------------

const TAB_CONFIG: { value: BottomPanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
  { value: 'logs', label: 'Logs', icon: <Terminal className="size-3.5" /> },
  { value: 'trace', label: 'Trace', icon: <Activity className="size-3.5" /> },
  { value: 'warnings', label: 'Warnings', icon: <AlertTriangle className="size-3.5" />, badge: 3 },
  { value: 'diff', label: 'Diff', icon: <FileDiff className="size-3.5" />, badge: 3 },
]

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab } = useUiStore()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      <Tabs
        value={bottomPanelTab}
        onValueChange={(v) => setBottomPanelTab(v as BottomPanelTab)}
        className="flex h-full flex-col gap-0"
      >
        <div className="border-b border-border/50 px-2 pt-1.5 flex-shrink-0">
          <TabsList variant="line" className="gap-1">
            {TAB_CONFIG.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5 text-xs px-2 py-1"
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-3.5 px-1 text-[10px] min-w-0"
                  >
                    {tab.badge}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="logs" keepMounted={false} className="h-full">
            <LogsTab />
          </TabsContent>
          <TabsContent value="trace" keepMounted={false} className="h-full">
            <TraceTab />
          </TabsContent>
          <TabsContent value="warnings" keepMounted={false} className="h-full">
            <WarningsTab />
          </TabsContent>
          <TabsContent value="diff" keepMounted={false} className="h-full">
            <DiffTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
