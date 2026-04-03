import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/layout/app-shell'

export const metadata: Metadata = {
  title: 'KernelCanvas',
  description: 'AI-powered Linux kernel API designer',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="h-full overflow-hidden bg-background text-foreground font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
