'use client'

import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import type { JobSort } from './utils'

export interface FilterChip {
  id: string
  label: string
  onRemove?: () => void
}

interface ResultsToolbarProps {
  count: number
  loading: boolean
  chips?: FilterChip[]
  sort: JobSort
  onSortChange: (s: JobSort) => void
  compactView: boolean
  onCompactViewChange: (v: boolean) => void
  onCheckFitAll: () => void
  checkFitDisabled?: boolean
  showCheckFitAll?: boolean
  announceId?: string
  announceText?: string
}

export function ResultsToolbar({
  count,
  loading,
  chips = [],
  sort,
  onSortChange,
  compactView,
  onCompactViewChange,
  onCheckFitAll,
  checkFitDisabled,
  showCheckFitAll = true,
  announceId = 'jobs-results-announce',
  announceText,
}: ResultsToolbarProps) {
  const liveText =
    announceText ??
    (loading ? 'Loading results.' : `${count} role${count === 1 ? '' : 's'} ${count === 0 ? 'found' : 'shown'}.`)

  return (
    <div className="jobs-results-toolbar flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div id={announceId} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveText}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="jobs-results-count m-0 shrink-0 text-sm font-medium text-foreground tabular-nums">
          {loading ? '…' : `${count} role${count === 1 ? '' : 's'}`}
        </p>
        {chips.length > 0 && (
          <div className="min-w-0 max-md:rounded-md max-md:border max-md:border-border max-md:bg-muted/30 max-md:px-2 max-md:py-2">
            <ul className="jobs-filter-chips m-0 flex list-none gap-2 p-0 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-0.5 md:flex-wrap md:overflow-visible jobs-toolbar-scroll">
            {chips.map((c) => (
              <li key={c.id} className="max-md:shrink-0">
                {c.onRemove ? (
                  <button
                    type="button"
                    className="jobs-filter-chip jobs-filter-chip--removable"
                    onClick={c.onRemove}
                  >
                    <span>{c.label}</span>
                    <span className="jobs-filter-chip-remove" aria-hidden>
                      ×
                    </span>
                    <span className="sr-only">Remove {c.label}</span>
                  </button>
                ) : (
                  <span className="jobs-filter-chip">{c.label}</span>
                )}
              </li>
            ))}
          </ul>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 max-md:rounded-md max-md:border max-md:border-border max-md:bg-muted/30 max-md:px-2 max-md:py-1.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1 md:border-0 md:bg-transparent md:p-0 md:overflow-visible jobs-toolbar-scroll">
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Sort by</span>
          <span aria-hidden>Sort</span>
          <select
            className="jobs-toolbar-select rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as JobSort)}
            aria-label="Sort listings"
          >
            <option value="posted">Newest posted</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        <div className="flex shrink-0 rounded-md border border-border p-0.5" role="group" aria-label="Listing density">
          <button
            type="button"
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              !compactView ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onCompactViewChange(false)}
            aria-pressed={!compactView}
          >
            Comfortable
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              compactView ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onCompactViewChange(true)}
            aria-pressed={compactView}
          >
            Compact
          </button>
        </div>
        {showCheckFitAll && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={checkFitDisabled}
            onClick={onCheckFitAll}
          >
            Check fit for all
          </Button>
        )}
      </div>
    </div>
  )
}
