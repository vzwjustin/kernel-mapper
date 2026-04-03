'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import type { WarningIssueNodeData } from '@/types/graph'

function severityColors(severity: string) {
  switch (severity) {
    case 'ERROR':   return { badge: 'bg-red-500/20 text-red-300 border-red-500/40', icon: 'text-red-400' }
    case 'WARNING': return { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', icon: 'text-yellow-400' }
    default:        return { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: 'text-blue-400' }
  }
}

function WarningNodeComponent({ data, selected }: NodeProps<Node<WarningIssueNodeData>>) {
  const colors = severityColors(data.severity)

  return (
    <div
      className={[
        'min-w-[200px] rounded-lg bg-yellow-950/60',
        'border transition-all duration-150 shadow-md',
        selected
          ? 'border-yellow-300 ring-2 ring-yellow-300/30'
          : 'border-yellow-600/60 hover:border-yellow-400/80',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-yellow-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-yellow-800/40">
        <AlertTriangle className={['w-4 h-4 shrink-0', colors.icon].join(' ')} />
        <span className="text-sm font-semibold text-white truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className={['text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide', colors.badge].join(' ')}>
            {data.severity}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{data.code}</span>
        </div>
        {data.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2">{data.description}</p>
        )}
      </div>
    </div>
  )
}

export const WarningNode = memo(WarningNodeComponent)
