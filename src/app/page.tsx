import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  MessageSquare,
  Network,
  ShieldCheck,
  Terminal,
  Zap,
  Code2,
  FileCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-full bg-background text-foreground overflow-auto">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-8 px-6 py-28 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-primary/25 shadow-lg shadow-primary/10">
          <Activity className="size-8 text-primary" />
        </div>
        <div className="relative flex flex-col gap-4 max-w-2xl">
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Kernel<span className="text-primary">Canvas</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Design Linux kernel APIs visually, validate ABI safety, and generate production-ready code — powered by AI.
          </p>
        </div>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 shadow-lg shadow-primary/25">
              <Sparkles className="size-4" />
              Get Started
            </Button>
          </Link>
          <Link href="/projects/new">
            <Button variant="outline" size="lg" className="gap-2">
              <Terminal className="size-4" />
              New Project
            </Button>
          </Link>
        </div>
        <div className="relative flex items-center gap-4 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1 text-xs border-emerald-500/30 text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Generic Netlink
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs border-blue-500/30 text-blue-400">
            Phase 1
          </Badge>
          <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400">
            v0.1.0
          </Badge>
        </div>
      </section>

      {/* Feature cards */}
      <section className="flex flex-wrap justify-center gap-6 px-6 pb-16 max-w-5xl mx-auto w-full">
        <Card className="flex-1 min-w-72 max-w-sm bg-card/60 border-border/40 hover:border-blue-500/30 transition-colors duration-200">
          <CardHeader>
            <div className="flex items-center justify-center size-11 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-3">
              <MessageSquare className="size-5 text-blue-400" />
            </div>
            <CardTitle className="text-base text-foreground">Create from Prompt</CardTitle>
            <CardDescription className="leading-relaxed">
              Describe your API in plain English. AI drafts the schema with commands, events, types, and permissions — following kernel conventions.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="flex-1 min-w-72 max-w-sm bg-card/60 border-border/40 hover:border-violet-500/30 transition-colors duration-200">
          <CardHeader>
            <div className="flex items-center justify-center size-11 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-3">
              <Network className="size-5 text-violet-400" />
            </div>
            <CardTitle className="text-base text-foreground">Visual Graph Editor</CardTitle>
            <CardDescription className="leading-relaxed">
              Build your API topology with a drag-and-drop node graph. Commands, events, structs, enums, and permissions as connected nodes.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="flex-1 min-w-72 max-w-sm bg-card/60 border-border/40 hover:border-emerald-500/30 transition-colors duration-200">
          <CardHeader>
            <div className="flex items-center justify-center size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
              <ShieldCheck className="size-5 text-emerald-400" />
            </div>
            <CardTitle className="text-base text-foreground">Validate & Generate</CardTitle>
            <CardDescription className="leading-relaxed">
              30+ validation rules for ABI safety, wiring completeness, and security. Generate C UAPI headers, kernel modules, and TS clients.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* Capabilities grid */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <h2 className="text-sm font-medium text-muted-foreground text-center mb-8">What you can generate</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: 'C UAPI Header', icon: Code2, color: 'text-blue-400' },
            { label: 'Kernel Module', icon: Terminal, color: 'text-emerald-400' },
            { label: 'TS Client', icon: FileCode, color: 'text-violet-400' },
            { label: 'API Docs', icon: FileCode, color: 'text-amber-400' },
            { label: 'Validation Report', icon: ShieldCheck, color: 'text-rose-400' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/40 border border-border/30 text-center"
            >
              <item.icon className={`size-5 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
