'use client'

import * as React from 'react'
import { Settings, Save, Undo2, Redo2, Sun, Moon, Activity, Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useUiStore } from '@/stores/ui-store'

type ValidationStatus = 'valid' | 'warnings' | 'errors'

function ValidationBadge({ status }: { status: ValidationStatus }) {
  if (status === 'valid') {
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20">
        <Shield className="size-3" />
        Valid
      </Badge>
    )
  }
  if (status === 'warnings') {
    return (
      <Badge className="gap-1 bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20">
        <AlertTriangle className="size-3" />
        Warnings
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/20">
      <Activity className="size-3" />
      Errors
    </Badge>
  )
}

export function Header() {
  const { theme, toggleTheme } = useUiStore()

  // Placeholder values — will be wired to project store
  const projectName = 'No Project'
  const schemaVersion = 'v0.1.0'
  const validationStatus: ValidationStatus = 'valid'

  return (
    <TooltipProvider delay={400}>
      <header className="flex h-12 items-center gap-2 border-b border-border/50 bg-background/95 px-3 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 items-center justify-center rounded bg-primary/90 shrink-0">
            <Activity className="size-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            KernelCanvas
          </span>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Project info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="truncate text-sm text-muted-foreground max-w-48">
            {projectName}
          </span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {schemaVersion}
          </Badge>
          <ValidationBadge status={validationStatus} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Save project">
                  <Save className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Save project (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Undo">
                  <Undo2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Redo">
                  <Redo2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? (
                    <Sun className="size-3.5" />
                  ) : (
                    <Moon className="size-3.5" />
                  )}
                </Button>
              }
            />
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Settings">
                  <Settings className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  )
}
