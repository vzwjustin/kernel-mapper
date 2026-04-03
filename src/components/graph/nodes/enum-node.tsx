'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Hash } from 'lucide-react'
import type { EnumFlagsNodeData } from '@/types/graph'

function EnumNodeComponent({ data, selected }: NodeProps<Node<EnumFlagsNodeData>>) {
  return (
    <div
      className={[
        'min-w-[160px] rounded-lg bg-orange-950/80',
        'border transition-all duration-150 shadow-md',
        selected
          ? 'border-orange-300 ring-2 ring-orange-300/30'
          : 'border-orange-600/60 hover:border-orange-400/80',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-orange-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-orange-800/40">
        <Hash className="w-4 h-4 shrink-0 text-orange-400" />
        <span className="text-sm font-semibold text-white truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2 flex items-center gap-1.5">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-300 border-orange-500/40">
          {data.kind}
        </span>
        <span className="text-[11px] text-slate-400">{data.variantCount} variants</span>
      </div>
    </div>
  )
}

export const EnumNode = memo(EnumNodeComponent)
