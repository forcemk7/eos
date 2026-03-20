'use client'

import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppLoadingBlockProps {
  message?: string
  className?: string
}

/** Inline loading row (job-board style): border, muted bg, spinner + text. */
export function AppLoadingBlock({ message = 'Loading…', className }: AppLoadingBlockProps) {
  return (
    <div
      className={cn(
        'app-loading-block flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
      {message}
    </div>
  )
}
