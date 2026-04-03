'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Radio } from 'lucide-react'
import type { TransportNodeData } from '@/types/graph'

function kindLabel(kind: string): string {
  switch (kind) {
    case 'GENERIC_NETLINK': return 'Generic Netlink'
    case 'IOCTL':           return 'ioctl'
    case 'CHAR_DEVICE':     return 'Char Device'
    default:                return kind
  }
}

function TransportNodeComponent({ data, selected }: NodeProps<Node<TransportNodeData>>) {
  return (
    <div
      className={[
        'min-w-[180px] rounded-lg bg-cyan-950/80',
        'border transition-all duration-150 shadow-md',
        selected
          ? 'border-cyan-300 ring-2 ring-cyan-300/30'
          : 'border-cyan-600/60 hover:border-cyan-400/80',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-cyan-800/40">
        <Radio className="w-4 h-4 shrink-0 text-cyan-400" />
        <span className="text-sm font-semibold text-white truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2 space-y-1">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
          {kindLabel(data.transportKind)}
        </span>
        {data.family && (
          <p className="text-[11px] text-slate-400 truncate">{data.family}</p>
        )}
        {data.devicePath && (
          <p className="text-[11px] text-slate-500 truncate font-mono">{data.devicePath}</p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-slate-900"
      />
    </div>
  )
}

export const TransportNode = memo(TransportNodeComponent)
