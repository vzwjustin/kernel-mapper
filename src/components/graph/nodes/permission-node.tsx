'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Shield } from 'lucide-react'
import type { PermissionNodeData } from '@/types/graph'

function PermissionNodeComponent({ data, selected }: NodeProps<Node<PermissionNodeData>>) {
  return (
    <div
      className={[
        'min-w-[160px] rounded-lg bg-red-950/80',
        'border transition-all duration-150 shadow-md',
        selected
          ? 'border-red-300 ring-2 ring-red-300/30'
          : 'border-red-600/60 hover:border-red-400/80',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-red-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-red-800/40">
        <Shield className="w-4 h-4 shrink-0 text-red-400" />
        <span className="text-sm font-semibold text-white truncate">{data.capability}</span>
      </div>

      <div className="px-3 py-2">
        {data.namespaceAware && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-red-500/20 text-red-300 border-red-500/40">
            Namespace-aware
          </span>
        )}
      </div>
    </div>
  )
}

export const PermissionNode = memo(PermissionNodeComponent)
