'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AppShellVariant = 'default' | 'wide'

interface AppShellProps {
  children: ReactNode
  className?: string
  /** `wide` uses a larger max-width for dense editors (e.g. resume grid). */
  variant?: AppShellVariant
}

/** Max-width column + vertical rhythm (same pattern as job boards). */
export function AppShell({ children, className, variant = 'default' }: AppShellProps) {
  return (
    <div
      className={cn(
        'app-shell',
        variant === 'wide' && 'app-shell--wide',
        className
      )}
    >
      {children}
    </div>
  )
}
