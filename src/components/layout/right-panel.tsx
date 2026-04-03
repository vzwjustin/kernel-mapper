'use client'

import * as React from 'react'
import {
  Settings,
  Sparkles,
  FileCode,
  Send,
  Copy,
  RotateCcw,
  ChevronRight,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useUiStore, type RightPanelTab } from '@/stores/ui-store'

// ---------------------------------------------------------------------------
// Properties tab
// ---------------------------------------------------------------------------

function PropertyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm text-foreground/80 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function PropertiesTab() {
  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Placeholder selected node */}
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded bg-violet-500/20 shrink-0">
          <ChevronRight className="size-3.5 text-violet-400" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">ReadKernelConfig</span>
          <span className="text-[10px] text-muted-foreground">Command</span>
        </div>
        <Badge className="ml-auto shrink-0 bg-violet-500/15 text-violet-400 border-violet-500/25 text-[10px]">
          CMD
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <PropertyRow label="Name" value="ReadKernelConfig" />
        <PropertyRow label="Version" value="1.0.0" mono />
        <PropertyRow label="Namespace" value="kernel.config" mono />
        <PropertyRow label="Description" value="Reads the active kernel configuration from the build directory." />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Fields (3)
        </span>
        <div className="flex flex-col gap-1">
          {[
            { name: 'kernel_path', type: 'string', required: true },
            { name: 'arch', type: 'string', required: false },
            { name: 'include_modules', type: 'bool', required: false },
          ].map((field) => (
            <div
              key={field.name}
              className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5"
            >
              <span className="font-mono text-xs text-foreground/80 flex-1 truncate">
                {field.name}
              </span>
              <span className="font-mono text-[10px] text-cyan-400">{field.type}</span>
              {field.required && (
                <span className="text-[10px] text-amber-400">req</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border/60 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Properties panel will show the editable form for the selected schema node.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI suggestions tab
// ---------------------------------------------------------------------------

function AiTab() {
  const [prompt, setPrompt] = React.useState('')

  const suggestions = [
    {
      id: '1',
      title: 'Add error return type',
      description: 'ReadKernelConfig should declare its error variants — consider adding a ConfigError type.',
      confidence: 'high',
    },
    {
      id: '2',
      title: 'Extract shared path type',
      description: 'kernel_path appears in 4 commands. Extract to a KernelPath value type for consistency.',
      confidence: 'medium',
    },
    {
      id: '3',
      title: 'Add idempotency marker',
      description: 'ReadKernelConfig is a read-only operation. Mark it as idempotent in the schema metadata.',
      confidence: 'medium',
    },
  ]

  const confidenceColor = (c: string) =>
    c === 'high' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    'text-amber-400 bg-amber-500/10 border-amber-500/20'

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2 pb-1">
            <Sparkles className="size-3.5 text-violet-400" />
            <span className="text-xs font-medium text-muted-foreground">
              AI Suggestions
            </span>
            <Badge variant="outline" className="ml-auto text-[10px] px-1.5">
              {suggestions.length}
            </Badge>
          </div>

          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/40 p-3 hover:bg-card/60 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 text-sm font-medium text-foreground/90 leading-snug">
                  {s.title}
                </span>
                <Badge
                  className={`shrink-0 text-[10px] px-1.5 border ${confidenceColor(s.confidence)}`}
                >
                  {s.confidence}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {s.description}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="xs" className="flex-1 text-xs">
                  Apply
                </Button>
                <Button variant="ghost" size="xs" className="text-xs">
                  Dismiss
                </Button>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-dashed border-border/60 p-3 text-center mt-2">
            <p className="text-xs text-muted-foreground">
              AI panel will show context-aware suggestions for the current selection and schema state.
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Prompt input */}
      <div className="border-t border-border/50 p-2">
        <div className="flex gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI about this schema…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          <Button variant="ghost" size="icon-xs" aria-label="Send" disabled={!prompt.trim()}>
            <Send className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview tab
// ---------------------------------------------------------------------------

const PREVIEW_CODE = `// Generated from ReadKernelConfig v1.0.0
// KernelCanvas schema codegen — Rust

use std::path::PathBuf;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReadKernelConfig {
    /// Path to the kernel build directory
    pub kernel_path: String,

    /// Target architecture (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arch: Option<String>,

    /// Include module configuration
    #[serde(default)]
    pub include_modules: bool,
}

impl ReadKernelConfig {
    pub fn new(kernel_path: impl Into<String>) -> Self {
        Self {
            kernel_path: kernel_path.into(),
            arch: None,
            include_modules: false,
        }
    }
}`

function PreviewTab() {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(PREVIEW_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-1.5">
        <span className="flex-1 text-xs text-muted-foreground font-mono">
          ReadKernelConfig.rs
        </span>
        <Button variant="ghost" size="icon-xs" aria-label="Regenerate">
          <RotateCcw className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Copy"
          onClick={handleCopy}
        >
          <Copy className="size-3" />
        </Button>
        {copied && (
          <span className="text-[10px] text-emerald-400">Copied!</span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <pre className="p-3 text-[11px] leading-relaxed font-mono text-foreground/80 whitespace-pre-wrap">
          {PREVIEW_CODE}
        </pre>
        <div className="mx-3 mb-3 rounded-lg border border-dashed border-border/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Preview panel will show real-time generated code for the selected schema entity.
          </p>
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right panel shell
// ---------------------------------------------------------------------------

const TAB_CONFIG: { value: RightPanelTab; label: string; icon: React.ReactNode }[] = [
  { value: 'properties', label: 'Properties', icon: <Settings className="size-3.5" /> },
  { value: 'ai', label: 'AI', icon: <Sparkles className="size-3.5" /> },
  { value: 'preview', label: 'Preview', icon: <FileCode className="size-3.5" /> },
]

export function RightPanel() {
  const { rightPanelTab, setRightPanelTab } = useUiStore()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      <Tabs
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as RightPanelTab)}
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

        <div className="flex-1 overflow-hidden">
          <TabsContent value="properties" keepMounted={false} className="h-full">
            <ScrollArea className="h-full">
              <PropertiesTab />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="ai" keepMounted={false} className="h-full">
            <AiTab />
          </TabsContent>
          <TabsContent value="preview" keepMounted={false} className="h-full">
            <PreviewTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
