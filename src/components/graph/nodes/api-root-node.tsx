'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Settings } from 'lucide-react'
import type { ApiRootNodeData } from '@/types/graph'

function statusColors(status: string): string {
  switch (status) {
    case 'PUBLISHED':   return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    case 'DEPRECATED':  return 'bg-red-500/20 text-red-300 border-red-500/40'
    default:            return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  }
}

function transportLabel(transport: string): string {
  switch (transport) {
    case 'GENERIC_NETLINK': return 'Generic Netlink'
    case 'IOCTL':           return 'ioctl'
    case 'CHAR_DEVICE':     return 'Char Device'
    default:                return transport
  }
}

function ApiRootNodeComponent({ data, selected }: NodeProps<Node<ApiRootNodeData>>) {
  const title = data.family ?? data.namespace ?? data.label

  return (
    <div
      className={[
        'min-w-[200px] rounded-xl bg-gradient-to-br from-slate-800 to-slate-900',
        'border-2 transition-all duration-150 shadow-lg',
        selected
          ? 'border-violet-400 ring-2 ring-violet-400/30'
          : 'border-violet-600/60 hover:border-violet-400/80',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-700/60">
        <Settings className="w-4 h-4 shrink-0 text-violet-400" />
        <span className="text-sm font-bold text-white truncate">{title}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-violet-500/20 text-violet-300 border-violet-500/40">
            {transportLabel(data.transport)}
          </span>
          <span className="text-[10px] text-slate-400">v{data.version}</span>
        </div>
        <span
          className={[
            'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide',
            statusColors(data.status),
          ].join(' ')}
        >
          {data.status}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-slate-900"
      />
    </div>
  )
}

export const ApiRootNode = memo(ApiRootNodeComponent)
