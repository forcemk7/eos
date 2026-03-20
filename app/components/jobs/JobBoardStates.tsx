'use client'

import type { ReactNode } from 'react'
import { Briefcase, FilterX, RefreshCw, Search, AlertCircle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

export function JobListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="jobs-list jobs-list--skeleton" aria-busy="true" aria-label="Loading job listings">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="jobs-skeleton-row">
          <div className="jobs-skeleton-line jobs-skeleton-line--title" />
          <div className="jobs-skeleton-line jobs-skeleton-line--company" />
          <div className="jobs-skeleton-line jobs-skeleton-line--meta" />
          <div className="jobs-skeleton-line jobs-skeleton-line--snippet" />
        </li>
      ))}
    </ul>
  )
}

interface StateBlockProps {
  icon?: ReactNode
  title: string
  description: string
  primaryAction?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
  role?: 'status' | 'alert'
}

export function JobStateBlock({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  role = 'status',
}: StateBlockProps) {
  return (
    <div className={cn('jobs-state-block', className)} role={role}>
      {icon && <div className="jobs-state-icon" aria-hidden>{icon}</div>}
      <h3 className="jobs-state-title">{title}</h3>
      <p className="jobs-state-body">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="jobs-state-actions">
          {primaryAction && (
            <Button type="button" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button type="button" variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function JobEmptyNoResults({ onClearFilters }: { onClearFilters?: () => void }) {
  return (
    <JobStateBlock
      icon={<FilterX className="h-8 w-8 opacity-70" />}
      title="No roles match"
      description="Try broader keywords, another location, or turn off remote-only to see more listings."
      primaryAction={
        onClearFilters
          ? { label: 'Reset filters', onClick: onClearFilters }
          : undefined
      }
    />
  )
}

export function JobEmptyInitialManual({ onFocusSearch }: { onFocusSearch?: () => void }) {
  return (
    <JobStateBlock
      icon={<Search className="h-8 w-8 opacity-70" />}
      title="Search the job board"
      description="Enter keywords and tap Search. Results are cached for 24 hours to save API usage."
      primaryAction={
        onFocusSearch ? { label: 'Edit search', onClick: onFocusSearch } : undefined
      }
    />
  )
}

export function JobEmptyAI({ onRefresh }: { onRefresh: () => void }) {
  return (
    <JobStateBlock
      icon={<Briefcase className="h-8 w-8 opacity-70" />}
      title="No listings yet"
      description="We could not find roles for your generated search. Refresh qualifications or update your Data tab."
      primaryAction={{ label: 'Refresh qualifications', onClick: onRefresh }}
    />
  )
}

export function JobErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <JobStateBlock
      role="alert"
      icon={<AlertCircle className="h-8 w-8 text-destructive opacity-90" />}
      title="Something went wrong"
      description={message}
      primaryAction={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
  )
}

export function JobQuotaState({ used, limit }: { used: number; limit: number }) {
  return (
    <JobStateBlock
      icon={<AlertCircle className="h-8 w-8 opacity-70" />}
      title="Monthly search limit reached"
      description={`You have used ${used} of ${limit} discovery requests this month. Upgrade your plan when available to continue searching.`}
    />
  )
}

export function JobGeneratingQualifications() {
  return (
    <div className="jobs-state-block jobs-state-block--minimal" role="status" aria-live="polite">
      <RefreshCw className="h-6 w-6 animate-spin opacity-70 motion-reduce:animate-none" aria-hidden />
      <p className="jobs-state-body m-0">Generating qualifications from your profile…</p>
    </div>
  )
}
