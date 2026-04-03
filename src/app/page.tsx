import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, MessageSquare, Network, ShieldCheck } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <div className="flex items-center justify-center size-14 rounded-xl bg-primary/10 border border-primary/20">
          <Activity className="size-7 text-primary" />
        </div>
        <div className="flex flex-col gap-3 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            KernelCanvas
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Design Linux kernel APIs visually, powered by AI
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard"><Button size="lg">Get Started</Button></Link>
          <Link href="/projects/new"><Button variant="outline" size="lg">New Project</Button></Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="flex flex-wrap justify-center gap-6 px-6 pb-24 max-w-5xl mx-auto w-full">
        <Card className="flex-1 min-w-64 max-w-sm bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-2">
              <MessageSquare className="size-5 text-blue-400" />
            </div>
            <CardTitle className="text-base">Create from Prompt</CardTitle>
            <CardDescription>
              Describe your API in plain English and let AI draft the schema, commands, events, and types for you.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>

        <Card className="flex-1 min-w-64 max-w-sm bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-center size-10 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-2">
              <Network className="size-5 text-violet-400" />
            </div>
            <CardTitle className="text-base">Visual Graph Editor</CardTitle>
            <CardDescription>
              Build your API topology with a drag-and-drop node graph. Connect commands, events, and types visually.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>

        <Card className="flex-1 min-w-64 max-w-sm bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-2">
              <ShieldCheck className="size-5 text-emerald-400" />
            </div>
            <CardTitle className="text-base">Validate &amp; Generate</CardTitle>
            <CardDescription>
              Run ABI safety checks, wiring validation, and generate C headers, TypeScript clients, and kernel scaffolds.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </section>
    </div>
  )
}
