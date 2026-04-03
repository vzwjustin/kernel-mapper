'use client'

import type { DragEvent } from 'react'
import { Settings, Radio, Terminal, Zap, Database, Hash, Shield, AlertTriangle } from 'lucide-react'

interface PaletteItem {
  type: string
  label: string
  icon: React.ReactNode
  colorClass: string
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'apiRoot',
    label: 'API Root',
    icon: <Settings className="w-4 h-4" />,
    colorClass: 'text-violet-400 border-violet-600/50 hover:border-violet-400/80 hover:bg-violet-900/30',
  },
  {
    type: 'transport',
    label: 'Transport',
    icon: <Radio className="w-4 h-4" />,
    colorClass: 'text-cyan-400 border-cyan-600/50 hover:border-cyan-400/80 hover:bg-cyan-900/30',
  },
  {
    type: 'command',
    label: 'Command',
    icon: <Terminal className="w-4 h-4" />,
    colorClass: 'text-blue-400 border-blue-600/50 hover:border-blue-400/80 hover:bg-blue-900/30',
  },
  {
    type: 'event',
    label: 'Event',
    icon: <Zap className="w-4 h-4" />,
    colorClass: 'text-purple-400 border-purple-600/50 hover:border-purple-400/80 hover:bg-purple-900/30',
  },
  {
    type: 'struct',
    label: 'Struct',
    icon: <Database className="w-4 h-4" />,
    colorClass: 'text-green-400 border-green-600/50 hover:border-green-400/80 hover:bg-green-900/30',
  },
  {
    type: 'enum',
    label: 'Enum / Flags',
    icon: <Hash className="w-4 h-4" />,
    colorClass: 'text-orange-400 border-orange-600/50 hover:border-orange-400/80 hover:bg-orange-900/30',
  },
  {
    type: 'permission',
    label: 'Permission',
    icon: <Shield className="w-4 h-4" />,
    colorClass: 'text-red-400 border-red-600/50 hover:border-red-400/80 hover:bg-red-900/30',
  },
  {
    type: 'warning',
    label: 'Warning',
    icon: <AlertTriangle className="w-4 h-4" />,
    colorClass: 'text-yellow-400 border-yellow-600/50 hover:border-yellow-400/80 hover:bg-yellow-900/30',
  },
]

function onDragStart(event: DragEvent<HTMLDivElement>, nodeType: string) {
  event.dataTransfer.setData('application/kernelcanvas-node-type', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}

export function NodePalette() {
  return (
    <div className="flex flex-col gap-1 p-2 w-44 bg-slate-900/80 border-r border-slate-700/60 h-full overflow-y-auto">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 mb-1">
        Node Types
      </p>
      {PALETTE_ITEMS.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => onDragStart(e, item.type)}
          className={[
            'flex items-center gap-2 px-2 py-2 rounded-md border bg-slate-800/60',
            'cursor-grab active:cursor-grabbing select-none transition-all duration-100',
            item.colorClass,
          ].join(' ')}
        >
          <span className="shrink-0">{item.icon}</span>
          <span className="text-[12px] font-medium text-slate-200">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
