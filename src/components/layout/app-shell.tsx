'use client'

import * as React from 'react'
import { PanelLeft, PanelRight, PanelBottom } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useUiStore } from '@/stores/ui-store'
import { Header } from './header'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { BottomPanel } from './bottom-panel'

// ---------------------------------------------------------------------------
// Panel toggle button — floats at the edge of a collapsed panel
// ---------------------------------------------------------------------------

function PanelToggle({
  side,
  onToggle,
  label,
}: {
  side: 'left' | 'right' | 'bottom'
  onToggle: () => void
  label: string
}) {
  const Icon =
    side === 'left' ? PanelLeft :
    side === 'right' ? PanelRight :
    PanelBottom

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggle}
            aria-label={label}
            className="shrink-0"
          >
            <Icon className="size-3.5" />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Resize handle — visual separator with hover affordance
// ---------------------------------------------------------------------------

function ResizeHandle({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  if (orientation === 'vertical') {
    return (
      <div className="w-px bg-border/50 hover:bg-border transition-colors cursor-col-resize shrink-0" />
    )
  }
  return (
    <div className="h-px bg-border/50 hover:bg-border transition-colors cursor-row-resize shrink-0" />
  )
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    leftPanelOpen,
    rightPanelOpen,
    bottomPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
  } = useUiStore()

  return (
    <TooltipProvider delay={400}>
      {/*
        Full-viewport grid:
          row 1: header (h-12)
          row 2: main work area (flex-1)
          row 3: bottom panel (h-48, collapsible)
      */}
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        {/* ── Header ── */}
        <Header />

        {/* ── Main work area ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left sidebar ── */}
          <aside
            className={`flex flex-col overflow-hidden border-r border-border/50 bg-background/80 transition-all duration-200 shrink-0 ${
              leftPanelOpen ? 'w-72' : 'w-0'
            }`}
            aria-label="Left panel"
          >
            {leftPanelOpen && <LeftPanel />}
          </aside>

          {/* ── Left collapse toggle (shown when panel is closed) ── */}
          {!leftPanelOpen && (
            <div className="flex flex-col items-center border-r border-border/50 bg-background/50 px-1 py-2">
              <PanelToggle
                side="left"
                onToggle={toggleLeftPanel}
                label="Open left panel"
              />
            </div>
          )}

          {/* ── Center content ── */}
          <main className="relative flex flex-1 flex-col overflow-hidden">
            {/* Toolbar strip with panel toggles */}
            <div className="flex items-center gap-1 border-b border-border/30 bg-background/60 px-2 py-1 shrink-0">
              {leftPanelOpen && (
                <PanelToggle
                  side="left"
                  onToggle={toggleLeftPanel}
                  label="Close left panel"
                />
              )}
              <div className="flex-1" />
              <PanelToggle
                side="bottom"
                onToggle={toggleBottomPanel}
                label={bottomPanelOpen ? 'Close bottom panel' : 'Open bottom panel'}
              />
              {rightPanelOpen && (
                <PanelToggle
                  side="right"
                  onToggle={toggleRightPanel}
                  label="Close right panel"
                />
              )}
            </div>

            {/* Main canvas / page content */}
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>

          {/* ── Right collapse toggle (shown when panel is closed) ── */}
          {!rightPanelOpen && (
            <div className="flex flex-col items-center border-l border-border/50 bg-background/50 px-1 py-2">
              <PanelToggle
                side="right"
                onToggle={toggleRightPanel}
                label="Open right panel"
              />
            </div>
          )}

          {/* ── Right sidebar ── */}
          <aside
            className={`flex flex-col overflow-hidden border-l border-border/50 bg-background/80 transition-all duration-200 shrink-0 ${
              rightPanelOpen ? 'w-80' : 'w-0'
            }`}
            aria-label="Right panel"
          >
            {rightPanelOpen && <RightPanel />}
          </aside>
        </div>

        {/* ── Bottom panel ── */}
        {bottomPanelOpen && (
          <>
            <ResizeHandle orientation="horizontal" />
            <section
              className="h-48 shrink-0 overflow-hidden bg-background/80"
              aria-label="Bottom panel"
            >
              <BottomPanel />
            </section>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
