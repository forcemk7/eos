'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface JobsShellProps {
  children: ReactNode
  className?: string
}

/** Shared max-width column and vertical rhythm for manual + AI job boards. */
export function JobsShell({ children, className }: JobsShellProps) {
  return <div className={cn('jobs-tab jobs-shell', className)}>{children}</div>
}
