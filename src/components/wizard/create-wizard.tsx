'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network,
  Activity,
  Cpu,
  Radio,
  Pencil,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Shuffle,
  Layers,
  Lock,
  Globe,
  Boxes,
  FlaskConical,
  Building2,
  CheckCircle2,
  FileCode2,
  FileText,
  FolderKanban,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { WizardStep } from './wizard-step'
import { OptionCard } from './option-card'
import { GenerationPreview } from './generation-preview'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 7

const API_TYPE_OPTIONS = [
  {
    id: 'networking',
    title: 'Networking control plane',
    description: 'Netlink-based interfaces for managing network devices, routes, bridges, or protocols.',
    icon: <Network className="size-5" />,
  },
  {
    id: 'telemetry',
    title: 'Telemetry / stats API',
    description: 'APIs for monitoring counters, gauges, histograms, or diagnostic data from the kernel.',
    icon: <Activity className="size-5" />,
  },
  {
    id: 'driver',
    title: 'Driver / device control API',
    description: 'Character device or ioctl-based interfaces for managing hardware or virtual devices.',
    icon: <Cpu className="size-5" />,
  },
  {
    id: 'event',
    title: 'Event stream API',
    description: 'Push-based notification or tracing interfaces using perf, ftrace, or netlink multicast.',
    icon: <Radio className="size-5" />,
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Define your own API category using a free-form description below.',
    icon: <Pencil className="size-5" />,
  },
] as const

const INTERACTION_OPTIONS = [
  {
    id: 'request-response',
    title: 'Request / response',
    description: 'Synchronous command-response semantics — caller sends a request and waits for an acknowledgement or result.',
    icon: <MessageSquare className="size-5" />,
  },
  {
    id: 'events',
    title: 'Events / notifications',
    description: 'Kernel pushes unsolicited notifications to userspace when interesting conditions occur.',
    icon: <Activity className="size-5" />,
  },
  {
    id: 'streaming',
    title: 'Streaming',
    description: 'Continuous high-throughput data path — ring buffers, mmap, or read-loop interfaces.',
    icon: <Radio className="size-5" />,
  },
  {
    id: 'mixed',
    title: 'Mixed',
    description: 'Combines multiple interaction patterns — e.g., config commands plus async event notifications.',
    icon: <Shuffle className="size-5" />,
  },
] as const

const PRIVILEGE_OPTIONS = [
  {
    id: 'admin',
    title: 'Admin only (CAP_SYS_ADMIN)',
    description: 'All operations require CAP_SYS_ADMIN. Appropriate for system-wide configuration APIs.',
    icon: <Lock className="size-5" />,
  },
  {
    id: 'mixed',
    title: 'Mixed privileged / unprivileged',
    description: 'Some commands require elevated capabilities; others are safe for unprivileged users.',
    icon: <Layers className="size-5" />,
  },
  {
    id: 'namespace',
    title: 'Namespace aware',
    description: 'Privilege scoped to network or user namespaces — unprivileged inside a namespace is allowed.',
    icon: <Globe className="size-5" />,
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Describe your own capability requirements and access control model.',
    icon: <Boxes className="size-5" />,
  },
] as const

const STABILITY_OPTIONS = [
  {
    id: 'experimental',
    title: 'Experimental',
    description: 'No stability promises. Can change or be removed between kernel versions.',
    icon: <FlaskConical className="size-5" />,
  },
  {
    id: 'internal',
    title: 'Internal only',
    description: 'Stable within a kernel tree but not considered part of the public ABI.',
    icon: <Building2 className="size-5" />,
  },
  {
    id: 'stable',
    title: 'Stable userspace contract',
    description: 'Part of the public ABI — once merged, cannot break userspace.',
    icon: <CheckCircle2 className="size-5" />,
  },
] as const

const TARGET_OPTIONS = [
  {
    id: 'schema-only',
    title: 'Schema only',
    description: 'YAML / JSON schema definition for your API types, commands, and events.',
    icon: <FileCode2 className="size-5" />,
  },
  {
    id: 'schema-docs',
    title: 'Schema + docs',
    description: 'Schema plus generated RST / Markdown documentation.',
    icon: <FileText className="size-5" />,
  },
  {
    id: 'full-scaffold',
    title: 'Full scaffold',
    description: 'Schema, docs, C client library headers, and test stubs.',
    icon: <FolderKanban className="size-5" />,
  },
] as const

const PROMPT_SUGGESTIONS = [
  'I need a netlink interface for managing network bridge configurations, including adding/removing ports and setting STP parameters.',
  'Create an API for monitoring CPU temperature sensors and thermal throttling events across all CPU packages.',
  'Design a character device interface for controlling a PCIe FPGA accelerator with DMA buffer management.',
  'I want a perf-based streaming API that delivers per-socket TCP metrics with minimal overhead.',
]

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

interface WizardState {
  apiType: string
  customType: string
  description: string
  interactionStyle: string
  privilegeModel: string
  stability: string
  targets: Set<string>
}

const defaultState: WizardState = {
  apiType: '',
  customType: '',
  description: '',
  interactionStyle: '',
  privilegeModel: '',
  stability: '',
  targets: new Set(),
}

// ---------------------------------------------------------------------------
// Step slide animation variants
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 48 : -48,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -48 : 48,
    opacity: 0,
  }),
}

// ---------------------------------------------------------------------------
// Summary row helper
// ---------------------------------------------------------------------------

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-foreground leading-relaxed">{value || '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checkbox card (for multi-select targets)
// ---------------------------------------------------------------------------

function CheckboxCard({
  title,
  description,
  icon,
  checked,
  onChange,
}: {
  title: string
  description: string
  icon: React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'group relative flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked
          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
          : 'border-border bg-card hover:border-border/80 hover:bg-muted/40'
      )}
      aria-pressed={checked}
    >
      {/* Checkbox indicator */}
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150 mt-0.5',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-transparent'
        )}
      >
        {checked && <Check className="size-3" />}
      </span>

      {/* Icon */}
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
          checked
            ? 'bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
        )}
      >
        {icon}
      </span>

      {/* Text */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={cn(
            'text-sm font-medium leading-snug transition-colors duration-150',
            checked ? 'text-foreground' : 'text-foreground/90'
          )}
        >
          {title}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function CreateWizard() {
  const [step, setStep] = React.useState(1)
  const [direction, setDirection] = React.useState(1)
  const [state, setState] = React.useState<WizardState>(defaultState)

  // Generation state
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [streamedText, setStreamedText] = React.useState('')
  const [generationStats, setGenerationStats] = React.useState<{
    commands: number
    events: number
    types: number
    policies: number
  } | null>(null)
  const [generationError, setGenerationError] = React.useState<string | null>(null)
  const [hasGenerated, setHasGenerated] = React.useState(false)

  const progressPercent = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100)

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  function next() {
    if (step < TOTAL_STEPS) goTo(step + 1)
  }

  function back() {
    if (step > 1) goTo(step - 1)
  }

  function toggleTarget(id: string) {
    setState((prev) => {
      const next = new Set(prev.targets)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, targets: next }
    })
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!state.apiType
      case 2:
        return state.description.trim().length > 10
      case 3:
        return !!state.interactionStyle
      case 4:
        return !!state.privilegeModel
      case 5:
        return !!state.stability
      case 6:
        return state.targets.size > 0
      default:
        return true
    }
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setStreamedText('')
    setGenerationStats(null)
    setGenerationError(null)
    setHasGenerated(false)

    try {
      const body = {
        apiType: state.apiType === 'custom' ? state.customType : state.apiType,
        description: state.description,
        interactionStyle: state.interactionStyle,
        privilegeModel: state.privilegeModel,
        stability: state.stability,
        targets: Array.from(state.targets),
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || `Server error ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamedText(accumulated)
      }

      // Parse naive stats from generated text
      const cmdCount = (accumulated.match(/\bcommand\b/gi) ?? []).length
      const evtCount = (accumulated.match(/\bevent\b/gi) ?? []).length
      const typeCount = (accumulated.match(/\btype\b|\bstruct\b/gi) ?? []).length
      const polCount = (accumulated.match(/\bpolicy\b|\bcap_/gi) ?? []).length

      setGenerationStats({
        commands: Math.max(cmdCount, 1),
        events: Math.max(evtCount, 0),
        types: Math.max(Math.floor(typeCount / 2), 1),
        policies: Math.max(polCount, 1),
      })
      setHasGenerated(true)
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Unknown error during generation')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleRegenerate() {
    setStreamedText('')
    setGenerationStats(null)
    setGenerationError(null)
    setHasGenerated(false)
    handleGenerate()
  }

  function handleOpenEditor() {
    // Navigate to editor — extend when routing is wired
    window.location.href = '/editor'
  }

  // Resolve display labels for summary
  function getLabel(options: readonly { id: string; title: string }[], id: string) {
    return options.find((o) => o.id === id)?.title ?? id
  }

  const targetLabels = Array.from(state.targets)
    .map((id) => TARGET_OPTIONS.find((o) => o.id === id)?.title ?? id)
    .join(', ')

  return (
    <div className="flex flex-col gap-6">
      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </span>
          <Badge variant="outline" className="text-xs tabular-nums">
            {progressPercent}%
          </Badge>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-sm min-h-[400px]">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.32, 0, 0.67, 0] }}
          >
            {/* ── Step 1: API type ── */}
            {step === 1 && (
              <WizardStep
                title="What are you building?"
                description="Choose the broad category that best describes your Linux kernel API."
                stepNumber={1}
                totalSteps={TOTAL_STEPS}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {API_TYPE_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.id}
                      title={opt.title}
                      description={opt.description}
                      icon={opt.icon}
                      selected={state.apiType === opt.id}
                      onClick={() => setState((s) => ({ ...s, apiType: opt.id }))}
                    />
                  ))}
                </div>
                {state.apiType === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-1.5"
                  >
                    <Label htmlFor="custom-type">Custom API category</Label>
                    <Input
                      id="custom-type"
                      placeholder="e.g. Power management sysfs interface"
                      value={state.customType}
                      onChange={(e) =>
                        setState((s) => ({ ...s, customType: e.target.value }))
                      }
                    />
                  </motion.div>
                )}
              </WizardStep>
            )}

            {/* ── Step 2: Description ── */}
            {step === 2 && (
              <WizardStep
                title="Describe your API"
                description="Describe what you want to build in plain English. Be as specific as you like."
                stepNumber={2}
                totalSteps={TOTAL_STEPS}
              >
                <div className="flex flex-col gap-3">
                  <Textarea
                    placeholder="Describe your API here…"
                    className="min-h-36 resize-none text-sm"
                    value={state.description}
                    onChange={(e) =>
                      setState((s) => ({ ...s, description: e.target.value }))
                    }
                  />
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Prompt suggestions
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {PROMPT_SUGGESTIONS.map((suggestion, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setState((s) => ({ ...s, description: suggestion }))
                          }
                          className="group flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
                        >
                          <Sparkles className="mt-0.5 size-3 shrink-0 text-primary/60 group-hover:text-primary" />
                          <span className="leading-relaxed">{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </WizardStep>
            )}

            {/* ── Step 3: Interaction style ── */}
            {step === 3 && (
              <WizardStep
                title="Interaction style"
                description="How does userspace interact with your API at runtime?"
                stepNumber={3}
                totalSteps={TOTAL_STEPS}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {INTERACTION_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.id}
                      title={opt.title}
                      description={opt.description}
                      icon={opt.icon}
                      selected={state.interactionStyle === opt.id}
                      onClick={() =>
                        setState((s) => ({ ...s, interactionStyle: opt.id }))
                      }
                    />
                  ))}
                </div>
              </WizardStep>
            )}

            {/* ── Step 4: Privilege model ── */}
            {step === 4 && (
              <WizardStep
                title="Privilege model"
                description="What capability requirements does your API impose on callers?"
                stepNumber={4}
                totalSteps={TOTAL_STEPS}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PRIVILEGE_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.id}
                      title={opt.title}
                      description={opt.description}
                      icon={opt.icon}
                      selected={state.privilegeModel === opt.id}
                      onClick={() =>
                        setState((s) => ({ ...s, privilegeModel: opt.id }))
                      }
                    />
                  ))}
                </div>
              </WizardStep>
            )}

            {/* ── Step 5: Stability ── */}
            {step === 5 && (
              <WizardStep
                title="Stability expectations"
                description="What ABI stability level does this API need to provide?"
                stepNumber={5}
                totalSteps={TOTAL_STEPS}
              >
                <div className="grid grid-cols-1 gap-3">
                  {STABILITY_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.id}
                      title={opt.title}
                      description={opt.description}
                      icon={opt.icon}
                      selected={state.stability === opt.id}
                      onClick={() =>
                        setState((s) => ({ ...s, stability: opt.id }))
                      }
                    />
                  ))}
                </div>
              </WizardStep>
            )}

            {/* ── Step 6: Generation targets ── */}
            {step === 6 && (
              <WizardStep
                title="Generation targets"
                description="Select what you want the AI to produce. You can pick multiple."
                stepNumber={6}
                totalSteps={TOTAL_STEPS}
              >
                <div className="flex flex-col gap-3">
                  {TARGET_OPTIONS.map((opt) => (
                    <CheckboxCard
                      key={opt.id}
                      title={opt.title}
                      description={opt.description}
                      icon={opt.icon}
                      checked={state.targets.has(opt.id)}
                      onChange={() => toggleTarget(opt.id)}
                    />
                  ))}
                </div>
              </WizardStep>
            )}

            {/* ── Step 7: Review & Generate ── */}
            {step === 7 && (
              <WizardStep
                title="Review & Generate"
                description="Confirm your choices, then let the AI generate your kernel API schema."
                stepNumber={7}
                totalSteps={TOTAL_STEPS}
              >
                <div className="flex flex-col gap-5">
                  {/* Summary card */}
                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-1">
                    <SummaryRow
                      label="API type"
                      value={
                        state.apiType === 'custom'
                          ? state.customType || 'Custom'
                          : getLabel(API_TYPE_OPTIONS, state.apiType)
                      }
                    />
                    <SummaryRow
                      label="Description"
                      value={
                        state.description.length > 120
                          ? state.description.slice(0, 120) + '…'
                          : state.description
                      }
                    />
                    <SummaryRow
                      label="Interaction"
                      value={getLabel(INTERACTION_OPTIONS, state.interactionStyle)}
                    />
                    <SummaryRow
                      label="Privileges"
                      value={getLabel(PRIVILEGE_OPTIONS, state.privilegeModel)}
                    />
                    <SummaryRow
                      label="Stability"
                      value={getLabel(STABILITY_OPTIONS, state.stability)}
                    />
                    <SummaryRow label="Targets" value={targetLabels} />
                  </div>

                  {/* Generation preview */}
                  {(isGenerating || hasGenerated || generationError) && (
                    <GenerationPreview
                      isGenerating={isGenerating}
                      streamedText={streamedText}
                      stats={generationStats}
                      error={generationError}
                      onOpenEditor={handleOpenEditor}
                      onRegenerate={handleRegenerate}
                    />
                  )}

                  {/* Generate button (shown before first generation) */}
                  {!isGenerating && !hasGenerated && !generationError && (
                    <Button
                      size="lg"
                      className="gap-2 self-start"
                      onClick={handleGenerate}
                    >
                      <Sparkles className="size-4" />
                      Generate schema
                    </Button>
                  )}

                  {/* Regenerate button while generating */}
                  {isGenerating && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="size-4 animate-spin" />
                      Generating your kernel API schema…
                    </div>
                  )}
                </div>
              </WizardStep>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="default"
          onClick={back}
          disabled={step === 1}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button
            size="default"
            onClick={next}
            disabled={!canAdvance()}
            className="gap-2"
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            size="default"
            variant="outline"
            onClick={() => goTo(1)}
            disabled={isGenerating}
            className="gap-2"
          >
            Start over
          </Button>
        )}
      </div>
    </div>
  )
}
