'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  BookOpen,
  FolderOpen,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerationStats {
  commands: number
  events: number
  types: number
  policies: number
}

export interface GenerationPreviewProps {
  /** True while the AI generation request is in flight */
  isGenerating: boolean
  /** Streamed text chunks from the AI response */
  streamedText: string
  /** Parsed stats once generation finishes (null while streaming) */
  stats: GenerationStats | null
  /** Error message if generation failed */
  error: string | null
  /** Called when user clicks "Open in Editor" */
  onOpenEditor: () => void
  /** Called when user clicks "Regenerate" */
  onRegenerate: () => void
}

// ---------------------------------------------------------------------------
// Streaming text cursor blink
// ---------------------------------------------------------------------------

function BlinkingCursor() {
  return (
    <motion.span
      className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-text-bottom"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Skeleton lines (placeholder while warming up)
// ---------------------------------------------------------------------------

function SkeletonLines() {
  return (
    <div className="flex flex-col gap-2 pt-1">
      {[100, 80, 92, 65, 88].map((w, i) => (
        <motion.div
          key={i}
          className="h-3 rounded-full bg-muted"
          style={{ width: `${w}%` }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.4, delay: i * 0.12, repeat: Infinity }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat badge
// ---------------------------------------------------------------------------

function StatChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted px-4 py-2.5">
      <span className="text-xl font-bold tabular-nums text-foreground">
        {count}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GenerationPreview({
  isGenerating,
  streamedText,
  stats,
  error,
  onOpenEditor,
  onRegenerate,
}: GenerationPreviewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as new text streams in
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [streamedText])

  const isComplete = !isGenerating && !error && stats !== null
  const hasText = streamedText.length > 0
  const isWarmingUp = isGenerating && !hasText

  return (
    <div className="flex flex-col gap-4">
      {/* ── Streaming / result panel ── */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border transition-colors duration-300',
          error
            ? 'border-destructive/40 bg-destructive/5'
            : isComplete
            ? 'border-primary/30 bg-primary/5'
            : 'border-border bg-card'
        )}
      >
        {/* Status bar */}
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
          <AnimatePresence mode="wait">
            {isGenerating && (
              <motion.span
                key="generating"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Generating schema…
              </motion.span>
            )}
            {isComplete && (
              <motion.span
                key="complete"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary"
              >
                <CheckCircle2 className="size-3.5" />
                Generation complete
              </motion.span>
            )}
            {error && (
              <motion.span
                key="error"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="flex items-center gap-1.5 text-xs font-medium text-destructive"
              >
                <AlertCircle className="size-3.5" />
                Generation failed
              </motion.span>
            )}
          </AnimatePresence>

          <div className="ml-auto flex items-center gap-1.5">
            {isGenerating && (
              <Badge variant="secondary" className="text-xs">
                streaming
              </Badge>
            )}
            {isComplete && (
              <Badge variant="default" className="text-xs">
                ready
              </Badge>
            )}
          </div>
        </div>

        {/* Content area */}
        <div
          ref={scrollRef}
          className="max-h-72 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed text-foreground/85 scrollbar-thin"
        >
          {isWarmingUp && <SkeletonLines />}

          {hasText && (
            <pre className="whitespace-pre-wrap break-words">
              {streamedText}
              {isGenerating && <BlinkingCursor />}
            </pre>
          )}

          {error && !hasText && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!isGenerating && !hasText && !error && (
            <p className="text-sm text-muted-foreground italic">
              AI output will appear here…
            </p>
          )}
        </div>
      </div>

      {/* ── Stats (shown after generation) ── */}
      <AnimatePresence>
        {isComplete && stats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Schema summary
            </p>
            <div className="grid grid-cols-4 gap-2">
              <StatChip label="Commands" count={stats.commands} />
              <StatChip label="Events" count={stats.events} />
              <StatChip label="Types" count={stats.types} />
              <StatChip label="Policies" count={stats.policies} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error detail ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
          >
            <span className="font-medium">Error: </span>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action buttons (shown after generation) ── */}
      <AnimatePresence>
        {(isComplete || error) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex items-center gap-2"
          >
            {isComplete && (
              <Button
                size="default"
                className="gap-2"
                onClick={onOpenEditor}
              >
                <FolderOpen className="size-4" />
                Open in Editor
              </Button>
            )}
            <Button
              variant="outline"
              size="default"
              className="gap-2"
              onClick={onRegenerate}
              disabled={isGenerating}
            >
              <RefreshCw className="size-4" />
              Regenerate
            </Button>

            {isComplete && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileCode2 className="size-3.5" />
                <span>schema ready</span>
                <BookOpen className="ml-1.5 size-3.5" />
                <span>docs included</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
