'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Zap } from 'lucide-react'
import type { EventNodeData } from '@/types/graph'

function subscriptionLabel(model: string): string {
  switch (model) {
    case 'MULTICAST': return 'Multicast'
    case 'UNICAST':   return 'Unicast'
    default:          return model
  }
}

function EventNodeComponent({ data, selected }: NodeProps<Node<EventNodeData>>) {
  return (
    <div
      className={[
        'min-w-[180px] rounded-lg bg-purple-950/80',
        'border transition-all duration-150 shadow-md',
        selected
          ? 'border-purple-300 ring-2 ring-purple-300/30'
          : 'border-purple-600/60 hover:border-purple-400/80',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-purple-800/40">
        <Zap className="w-4 h-4 shrink-0 text-purple-400" />
        <span className="text-sm font-semibold text-white truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-300 border-purple-500/40">
          {subscriptionLabel(data.subscriptionModel)}
        </span>
        {data.filteringSupport && (
          <p className="text-[11px] text-purple-400/70">Filtering supported</p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-slate-900"
      />
    </div>
  )
}

export const EventNode = memo(EventNodeComponent)
