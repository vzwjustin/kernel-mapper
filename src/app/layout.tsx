import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

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
      <body className="h-full bg-background text-foreground font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
