'use client'

import { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LazyJobFitIndicator } from './LazyJobFitIndicator'
import { ApplyOpenButton, ApplyStatusBadge } from './ApplyTracking'
import type { DiscoverListingWithApply } from './types'
import { formatPostedRelative, formatSourceLabel } from './utils'

export interface JobRowCardProps {
  job: DiscoverListingWithApply
  selected: boolean
  onSelect: (job: DiscoverListingWithApply) => void
  checkAllTrigger?: number
  compact: boolean
  onPatchListing: (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => void
  onOpenDataTab?: () => void
}

export const JobRowCard = memo(function JobRowCard({
  job,
  selected,
  onSelect,
  checkAllTrigger,
  compact,
  onPatchListing,
  onOpenDataTab,
}: JobRowCardProps) {
  const title = job.title || 'Untitled'
  const posted = formatPostedRelative(job.posted_at)
  const source = formatSourceLabel(job.source)

  return (
    <li className="jobs-list-item">
      <div
        className={cn(
          'jobs-row-card flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-card transition-colors sm:flex-row sm:items-stretch sm:gap-0',
          selected ? 'jobs-row-card--selected border-accent ring-1 ring-accent/40' : 'border-border'
        )}
      >
        <button
          type="button"
          className="jobs-row-main min-w-0 flex-1 rounded-[var(--radius-lg)] p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:rounded-r-none sm:pr-3"
          onClick={() => onSelect(job)}
          data-selected={selected ? '' : undefined}
          aria-label={`View details: ${title} at ${job.company}`}
        >
          <h3 className="jobs-card-title m-0 text-base font-semibold leading-snug text-foreground">{title}</h3>
          <p className="jobs-card-company mt-1 text-sm text-muted-foreground">{job.company}</p>
          <div className="jobs-card-meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {job.location && <span>{job.location}</span>}
            {job.remote && <span className="jobs-remote-badge">Remote</span>}
            {posted && <span>{posted}</span>}
            <span className="jobs-source-pill">{source}</span>
            <ApplyStatusBadge listing={job} />
          </div>
          {job.snippet && (
            <p
              className={cn(
                'jobs-card-snippet mt-2 text-sm leading-relaxed text-muted-foreground',
                compact ? 'line-clamp-1' : 'line-clamp-2'
              )}
            >
              {job.snippet}
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
            View role
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        <div
          className="jobs-row-actions flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-4 py-3 sm:w-auto sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <LazyJobFitIndicator listing={job} triggerCheck={checkAllTrigger} onOpenDataTab={onOpenDataTab} />
          {job.url ? (
            <ApplyOpenButton listing={job} url={job.url} label="Apply" onPatch={onPatchListing} />
          ) : null}
        </div>
      </div>
    </li>
  )
})
