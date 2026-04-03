'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Terminal } from 'lucide-react'
import type { CommandNodeData } from '@/types/graph'

function styleLabel(style: string): string {
  switch (style) {
    case 'REQUEST_RESPONSE':  return 'Req/Resp'
    case 'STREAMING':         return 'Streaming'
    case 'FIRE_AND_FORGET':   return 'Fire & Forget'
    default:                  return style
  }
}

function CommandNodeComponent({ data, selected }: NodeProps<Node<CommandNodeData>>) {
  return (
    <div
      className={[
        'min-w-[200px] rounded-lg bg-blue-950/80',
        'border transition-all duration-150 shadow-md',
        selected
          ? 'border-blue-300 ring-2 ring-blue-300/30'
          : 'border-blue-600/60 hover:border-blue-400/80',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-blue-800/40">
        <Terminal className="w-4 h-4 shrink-0 text-blue-400" />
        <span className="text-sm font-semibold text-white truncate">{data.label}</span>
        {data.deprecated && (
          <span className="ml-auto text-[9px] font-semibold px-1 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 uppercase tracking-wide shrink-0">
            Deprecated
          </span>
        )}
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-blue-500/20 text-blue-300 border-blue-500/40">
          {styleLabel(data.interactionStyle)}
        </span>
        {data.privilegeRequirement && (
          <p className="text-[11px] text-slate-400 truncate">
            <span className="text-slate-500">Priv: </span>
            {data.privilegeRequirement}
          </p>
        )}
      </div>

      {/* Bottom-left: source to request type */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="request"
        style={{ left: '30%' }}
        className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-slate-900"
      />
      {/* Bottom-right: source to response type */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="response"
        style={{ left: '70%' }}
        className="!w-2.5 !h-2.5 !bg-blue-300 !border-2 !border-slate-900"
      />
    </div>
  )
}

export const CommandNode = memo(CommandNodeComponent)
