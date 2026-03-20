'use client'

import type { ReactNode } from 'react'
import { AppShell } from '@/app/components/shell'
import { cn } from '@/lib/utils'

interface JobsShellProps {
  children: ReactNode
  className?: string
}

/** Shared max-width column and vertical rhythm for manual + AI job boards. */
export function JobsShell({ children, className }: JobsShellProps) {
  return <AppShell className={cn('jobs-tab', className)}>{children}</AppShell>
}
