'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Database } from 'lucide-react'
import type { RequestStructNodeData, ResponseStructNodeData } from '@/types/graph'

type StructNodeData = RequestStructNodeData | ResponseStructNodeData

function StructNodeComponent({ data, selected }: NodeProps<Node<StructNodeData>>) {
  const isRequest = data.nodeType === 'REQUEST_STRUCT'
  const accent = isRequest
    ? { border: 'border-green-600/60 hover:border-green-400/80', ring: 'border-green-300 ring-2 ring-green-300/30', badge: 'bg-green-500/20 text-green-300 border-green-500/40', icon: 'text-green-400', bg: 'bg-green-950/80', divider: 'border-green-800/40' }
    : { border: 'border-teal-600/60 hover:border-teal-400/80', ring: 'border-teal-300 ring-2 ring-teal-300/30', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40', icon: 'text-teal-400', bg: 'bg-teal-950/80', divider: 'border-teal-800/40' }

  return (
    <div
      className={[
        'min-w-[180px] rounded-lg',
        accent.bg,
        'border transition-all duration-150 shadow-md',
        selected ? accent.ring : accent.border,
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-slate-900"
      />

      <div className={['flex items-center gap-2 px-3 pt-3 pb-2 border-b', accent.divider].join(' ')}>
        <Database className={['w-4 h-4 shrink-0', accent.icon].join(' ')} />
        <span className="text-sm font-semibold text-white truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className={['text-[10px] font-medium px-1.5 py-0.5 rounded border', accent.badge].join(' ')}>
            STRUCT
          </span>
          <span className="text-[11px] text-slate-400">{data.fieldCount} fields</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-slate-900"
      />
    </div>
  )
}

export const StructNode = memo(StructNodeComponent)
