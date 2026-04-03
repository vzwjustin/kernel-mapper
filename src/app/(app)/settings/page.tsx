'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Save, Eye, EyeOff, Cpu, Palette, Info } from 'lucide-react'

const TASK_MODELS = [
  { task: 'Build from Prompt', key: 'build', default: 'anthropic/claude-sonnet-4' },
  { task: 'Edit by Instruction', key: 'edit', default: 'anthropic/claude-sonnet-4' },
  { task: 'Explain Design', key: 'explain', default: 'anthropic/claude-sonnet-4' },
  { task: 'Audit Schema', key: 'audit', default: 'anthropic/claude-sonnet-4' },
  { task: 'Import & Reconstruct', key: 'import', default: 'anthropic/claude-sonnet-4' },
  { task: 'Repair Wiring', key: 'repair', default: 'anthropic/claude-sonnet-4' },
  { task: 'Micro Edits', key: 'micro_edit', default: 'anthropic/claude-haiku-4' },
  { task: 'Naming Suggestions', key: 'naming', default: 'anthropic/claude-haiku-4' },
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [modelConfig, setModelConfig] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('openrouter_api_key')
    if (stored) setApiKey(stored)
    const models = localStorage.getItem('model_config')
    if (models) setModelConfig(JSON.parse(models))
    const theme = localStorage.getItem('theme')
    setDarkMode(theme !== 'light')
  }, [])

  const handleSave = () => {
    localStorage.setItem('openrouter_api_key', apiKey)
    localStorage.setItem('model_config', JSON.stringify(modelConfig))
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure KernelCanvas preferences and AI provider</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Cpu className="h-5 w-5" />
            AI Provider
          </CardTitle>
          <CardDescription>Configure your OpenRouter API key for AI features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>OpenRouter API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="bg-zinc-800 border-zinc-700 font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Your API key is stored locally in your browser. It is never sent to our servers.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Model Configuration</CardTitle>
          <CardDescription>Configure which model to use for each AI task</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TASK_MODELS.map((tm) => (
              <div key={tm.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-300">{tm.task}</p>
                  <p className="text-xs text-zinc-500">Default: {tm.default}</p>
                </div>
                <Input
                  value={modelConfig[tm.key] || tm.default}
                  onChange={(e) => setModelConfig({ ...modelConfig, [tm.key]: e.target.value })}
                  className="w-72 bg-zinc-800 border-zinc-700 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-300">Dark Mode</p>
              <p className="text-xs text-zinc-500">Use dark theme throughout the application</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Info className="h-5 w-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Application</span>
            <span className="text-white">KernelCanvas</span>
          </div>
          <Separator className="bg-zinc-800" />
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Version</span>
            <Badge variant="outline">0.1.0</Badge>
          </div>
          <Separator className="bg-zinc-800" />
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Architecture</span>
            <span className="text-white">Schema-first, UAPI-first</span>
          </div>
          <Separator className="bg-zinc-800" />
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Phase 1 Transport</span>
            <span className="text-white">Generic Netlink</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="min-w-32">
          <Save className="h-4 w-4 mr-2" />
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
