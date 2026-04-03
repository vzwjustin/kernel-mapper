import * as React from 'react'
import { cn } from '@/lib/utils'

export interface WizardStepProps {
  title: string
  description: string
  children: React.ReactNode
  stepNumber: number
  totalSteps: number
  className?: string
}

export function WizardStep({
  title,
  description,
  children,
  stepNumber,
  totalSteps,
  className,
}: WizardStepProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Step header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary tabular-nums">
            {stepNumber}
          </span>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            Step {stepNumber} of {totalSteps}
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {/* Step content */}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}
