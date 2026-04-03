import * as React from 'react'
import { cn } from '@/lib/utils'

export interface OptionCardProps {
  title: string
  description: string
  icon: React.ReactNode
  selected: boolean
  onClick: () => void
  className?: string
}

export function OptionCard({
  title,
  description,
  icon,
  selected,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
          : 'border-border bg-card hover:border-border/80 hover:bg-muted/40',
        className
      )}
      aria-pressed={selected}
    >
      {/* Selection indicator dot */}
      <span
        className={cn(
          'absolute top-3 right-3 size-2 rounded-full transition-all duration-150',
          selected ? 'bg-primary scale-100' : 'bg-muted-foreground/30 scale-75'
        )}
      />

      {/* Icon */}
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
          selected
            ? 'bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
        )}
      >
        {icon}
      </span>

      {/* Text */}
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            'text-sm font-medium leading-snug transition-colors duration-150',
            selected ? 'text-foreground' : 'text-foreground/90'
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
