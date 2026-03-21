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

/**
 * Centered content column + vertical rhythm (`gap: var(--app-shell-gap)` in globals.css).
 * Layout tokens: `--content-max`, `--content-max-wide`, `--app-shell-gap` on `:root` in `app/globals.css`.
 */
export function AppShell({ children, className, variant = 'default' }: AppShellProps) {
  return (
    <div
      className={cn(
        'app-shell min-w-0',
        variant === 'wide' && 'app-shell--wide',
        className
      )}
    >
      {children}
    </div>
  )
}
