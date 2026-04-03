'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with React Flow
const GraphCanvas = dynamic(
  () => import('@/components/graph/graph-canvas').then((mod) => ({ default: mod.GraphCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading editor...</p>
      </div>
    ),
  },
)

export default function GraphEditorPage() {
  return (
    <div className="h-[calc(100vh-3rem)]">
      <GraphCanvas />
    </div>
  )
}
