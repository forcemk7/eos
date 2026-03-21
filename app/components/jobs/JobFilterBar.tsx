'use client'

import { useId, useState, type RefObject } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

interface ManualJobFilterBarProps {
  variant: 'manual'
  q: string
  onQChange: (v: string) => void
  location: string
  onLocationChange: (v: string) => void
  remoteOnly: boolean
  onRemoteOnlyChange: (v: boolean) => void
  onSearch: () => void
  loading: boolean
  usageText: string | null
  searchInputRef?: RefObject<HTMLInputElement>
}

interface AiJobFilterBarProps {
  variant: 'ai'
  searchQuery: string
  location: string | null
  remote: boolean
  onRefreshQualifications: () => void
  disabled: boolean
}

export type JobFilterBarProps = ManualJobFilterBarProps | AiJobFilterBarProps

export function JobFilterBar(props: JobFilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [aiMobileOpen, setAiMobileOpen] = useState(false)
  const filtersId = useId()
  const aiFiltersId = useId()

  if (props.variant === 'ai') {
    return (
      <div className="jobs-filter-bar jobs-filter-bar--ai">
        <div className="md:hidden">
          <button
            type="button"
            className="jobs-filter-mobile-toggle flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-sm font-medium text-foreground"
            aria-expanded={aiMobileOpen}
            aria-controls={aiFiltersId}
            onClick={() => setAiMobileOpen((o) => !o)}
          >
            <span>Profile search &amp; actions</span>
            {aiMobileOpen ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
        </div>

        <div
          id={aiFiltersId}
          className={cn(!aiMobileOpen && 'hidden md:block', 'mt-3 md:mt-0')}
        >
          <div className="jobs-filter-ai-summary">
            <span className="jobs-filter-ai-label text-muted-foreground">Profile search</span>
            <p className="jobs-filter-ai-query m-0 mt-1 text-sm font-medium text-foreground">
              {props.searchQuery}
              {props.location ? ` · ${props.location}` : ''}
              {props.remote ? ' · Remote' : ''}
            </p>
          </div>
          <div className="jobs-filter-ai-chips mt-3 flex flex-wrap gap-2">
            {props.remote && <span className="jobs-source-pill jobs-source-pill--muted">Remote</span>}
            {props.location && <span className="jobs-source-pill jobs-source-pill--muted">{props.location}</span>}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={props.disabled}
              onClick={props.onRefreshQualifications}
            >
              Refresh qualifications
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const {
    q,
    onQChange,
    location,
    onLocationChange,
    remoteOnly,
    onRemoteOnlyChange,
    onSearch,
    loading,
    usageText,
    searchInputRef,
  } = props

  return (
    <div className="jobs-filter-bar jobs-filter-bar--manual">
      <div className="md:hidden">
        <button
          type="button"
          className="jobs-filter-mobile-toggle flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-sm font-medium text-foreground"
          aria-expanded={mobileOpen}
          aria-controls={filtersId}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span>Search & filters</span>
          {mobileOpen ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
        </button>
      </div>

      <div
        id={filtersId}
        className={cn(
          'jobs-filters mt-3 flex flex-col gap-3 md:mt-0 md:flex-row md:flex-wrap md:items-center',
          !mobileOpen && 'hidden md:flex'
        )}
      >
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Keywords (e.g. AI, developer)"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          className="jobs-filter-input jobs-discover-q min-w-0 flex-1 md:min-w-[180px]"
          aria-label="Keywords"
        />
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          className="jobs-filter-input jobs-filter-location"
          aria-label="Location"
        />
        <label className="jobs-filter-remote flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={(e) => onRemoteOnlyChange(e.target.checked)}
            aria-label="Remote only"
          />
          <span>Remote only</span>
        </label>
        <Button type="button" disabled={loading} onClick={onSearch}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </div>
      {usageText && <p className="jobs-usage mt-3 mb-0">{usageText}</p>}
    </div>
  )
}
