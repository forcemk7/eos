'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppPageHeaderProps {
  title: string
  description?: string
  /** e.g. toolbar actions */
  actions?: ReactNode
  className?: string
  /** Use for page-level h1 (default). */
  as?: 'h1' | 'h2'
  /** `page` = large dashboard-style title; `section` = compact (job-board style). */
  variant?: 'page' | 'section'
}

export function AppPageHeader({
  title,
  description,
  actions,
  className,
  as = 'h1',
  variant = 'page',
}: AppPageHeaderProps) {
  const Heading = as
  return (
    <div className={cn('app-page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        <Heading
          className={cn(
            variant === 'page' ? 'eos-title-page' : 'eos-title-section app-section-title'
          )}
        >
          {title}
        </Heading>
        {description ? <p className="app-section-hint mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
