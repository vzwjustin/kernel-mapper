'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { FolderOpen, GitBranch, Search, FileCode, ArrowRight } from 'lucide-react'

interface DiscoveredSymbol {
  name: string
  kind: 'function' | 'struct' | 'enum' | 'define' | 'netlink_family' | 'ioctl'
  file: string
  line: number
  confidence: number
}

interface BoundaryCandidate {
  name: string
  type: 'command' | 'event' | 'type' | 'permission'
  source: string
  confidence: number
}

export default function ImportPage() {
  const [repoPath, setRepoPath] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [discoveredFiles, setDiscoveredFiles] = useState<string[]>([])
  const [symbols, setSymbols] = useState<DiscoveredSymbol[]>([])
  const [boundaries, setBoundaries] = useState<BoundaryCandidate[]>([])
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'results'>('input')

  const handleAnalyze = useCallback(async () => {
    if (!repoPath) return
    setAnalyzing(true)
    setPhase('analyzing')
    setProgress(0)
    for (const p of [20, 50, 75, 100]) {
      await new Promise(resolve => setTimeout(resolve, 800))
      setProgress(p)
    }
    setDiscoveredFiles(['include/uapi/linux/example.h', 'net/example/example_netlink.c', 'net/example/example_core.c', 'tools/testing/selftests/net/example_test.c'])
    setSymbols([
      { name: 'example_genl_family', kind: 'netlink_family', file: 'net/example/example_netlink.c', line: 42, confidence: 0.95 },
      { name: 'EXAMPLE_CMD_GET', kind: 'define', file: 'include/uapi/linux/example.h', line: 15, confidence: 0.9 },
      { name: 'EXAMPLE_CMD_SET', kind: 'define', file: 'include/uapi/linux/example.h', line: 16, confidence: 0.9 },
      { name: 'example_config', kind: 'struct', file: 'include/uapi/linux/example.h', line: 25, confidence: 0.85 },
    ])
    setBoundaries([
      { name: 'get_config', type: 'command', source: 'EXAMPLE_CMD_GET + example_nl_get_doit', confidence: 0.92 },
      { name: 'set_config', type: 'command', source: 'EXAMPLE_CMD_SET + example_nl_set_doit', confidence: 0.88 },
      { name: 'example_config', type: 'type', source: 'struct example_config (UAPI)', confidence: 0.85 },
      { name: 'config_change', type: 'event', source: 'EXAMPLE_MCGRP_CONFIG multicast', confidence: 0.72 },
    ])
    setAnalyzing(false)
    setPhase('results')
  }, [repoPath])

  const confidenceBadge = (c: number) => {
    if (c >= 0.85) return <Badge className="bg-green-500/20 text-green-400">High ({Math.round(c * 100)}%)</Badge>
    if (c >= 0.65) return <Badge className="bg-yellow-500/20 text-yellow-400">Medium ({Math.round(c * 100)}%)</Badge>
    return <Badge className="bg-red-500/20 text-red-400">Low ({Math.round(c * 100)}%)</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Import from Codebase</h2>
        <p className="text-sm text-zinc-400 mt-1">Point at an existing kernel source tree to reconstruct the API boundary surface</p>
      </div>
      {phase === 'input' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><FolderOpen className="h-5 w-5" />Local Path</CardTitle>
              <CardDescription>Path to a kernel source tree or subsystem directory</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Source Path</Label>
                <Input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="/path/to/linux/net/example" className="bg-zinc-800 border-zinc-700" />
              </div>
              <Button onClick={handleAnalyze} disabled={!repoPath || analyzing} className="w-full"><Search className="h-4 w-4 mr-2" />Analyze</Button>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><GitBranch className="h-5 w-5" />Git Repository</CardTitle>
              <CardDescription>Clone and analyze a remote repository</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Repository URL</Label>
                <Input placeholder="https://git.kernel.org/..." className="bg-zinc-800 border-zinc-700" disabled />
              </div>
              <Button disabled className="w-full">Coming Soon</Button>
            </CardContent>
          </Card>
        </div>
      )}
      {phase === 'analyzing' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-zinc-400">Analyzing codebase...</p>
              <Progress value={progress} className="max-w-md mx-auto" />
            </div>
          </CardContent>
        </Card>
      )}
      {phase === 'results' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[{ label: 'Files Discovered', value: discoveredFiles.length }, { label: 'Symbols Extracted', value: symbols.length }, { label: 'Boundary Candidates', value: boundaries.length }].map(s => (
              <Card key={s.label} className="bg-zinc-900 border-zinc-800">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <p className="text-sm text-zinc-400">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-white">Boundary Candidates</CardTitle><CardDescription>Reconstructed API surface with confidence scores</CardDescription></CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {boundaries.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">{b.type}</Badge>
                        <div><p className="text-sm font-medium text-white">{b.name}</p><p className="text-xs text-zinc-500">{b.source}</p></div>
                      </div>
                      {confidenceBadge(b.confidence)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-white">Extracted Symbols</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {symbols.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-zinc-800/30 text-sm">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-zinc-500" />
                        <span className="font-mono text-zinc-300">{s.name}</span>
                        <Badge variant="outline" className="text-xs">{s.kind}</Badge>
                      </div>
                      <span className="text-xs text-zinc-500">{s.file}:{s.line}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase('input')}>Start Over</Button>
            <Button><ArrowRight className="h-4 w-4 mr-2" />Import to Schema</Button>
          </div>
        </div>
      )}
    </div>
  )
}
