'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import {
  JobsShell,
  JobFilterBar,
  ResultsToolbar,
  JobBoardSplit,
  JobListSkeleton,
  JobEmptyNoResults,
  JobErrorState,
  JobQuotaState,
  type DiscoverListing,
  type DiscoverListingWithApply,
  type FilterChip,
  type JobSort,
} from '@/app/components/jobs'
import { ExternalJobSheet } from '@/app/components/jobs/ExternalJobSheet'
import { jobBoardPage } from '@/lib/navCopy'

export type { DiscoverListing, DiscoverListingWithApply }

const STORAGE_KEY = 'earnOS_jobs_params'
const STORAGE_SORT = 'earnOS_jobs_sort'
const STORAGE_COMPACT = 'earnOS_jobs_compact'
const DEFAULT_QUERY = 'jobs'

interface StoredParams {
  q: string
  location: string
  remoteOnly: boolean
}

function loadParams(): StoredParams {
  if (typeof window === 'undefined') {
    return { q: '', location: '', remoteOnly: true }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { q: '', location: '', remoteOnly: true }
    const parsed = JSON.parse(raw) as Partial<StoredParams>
    return {
      q: typeof parsed.q === 'string' ? parsed.q : '',
      location: typeof parsed.location === 'string' ? parsed.location : '',
      remoteOnly: typeof parsed.remoteOnly === 'boolean' ? parsed.remoteOnly : true,
    }
  } catch {
    return { q: '', location: '', remoteOnly: true }
  }
}

function saveParams(params: StoredParams) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    // ignore
  }
}

function loadSort(): JobSort {
  if (typeof window === 'undefined') return 'posted'
  try {
    const v = localStorage.getItem(STORAGE_SORT)
    if (v === 'title' || v === 'posted') return v
  } catch {
    // ignore
  }
  return 'posted'
}

function loadCompact(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_COMPACT) === '1'
  } catch {
    return false
  }
}

function dedupeAppend(
  prev: DiscoverListingWithApply[],
  more: DiscoverListingWithApply[]
): DiscoverListingWithApply[] {
  const seen = new Set<string>()
  const out: DiscoverListingWithApply[] = []
  for (const j of prev) {
    const k = j.stable_external_id
    if (seen.has(k)) continue
    seen.add(k)
    out.push(j)
  }
  for (const j of more) {
    const k = j.stable_external_id
    if (seen.has(k)) continue
    seen.add(k)
    out.push(j)
  }
  return out
}

interface JobsTabProps {
  onOpenDataTab?: () => void
  focusStableExternalId?: string | null
  onFocusListingConsumed?: () => void
  onStartTailorResume?: (job: DiscoverListingWithApply) => void | Promise<void>
}

export default function JobsTab({
  onOpenDataTab,
  focusStableExternalId,
  onFocusListingConsumed,
  onStartTailorResume,
}: JobsTabProps) {
  const [q, setQ] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(true)
  const [listings, setListings] = useState<DiscoverListingWithApply[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)
  const [checkAllTrigger, setCheckAllTrigger] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [sort, setSort] = useState<JobSort>('posted')
  const [compactView, setCompactView] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const runDiscover = useCallback(
    async (opts: {
      query: string
      loc: string
      remote: boolean
      page: number
      append: boolean
    }) => {
      const { query, loc, remote, page: reqPage, append } = opts
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }
      try {
        const params = new URLSearchParams()
        params.set('q', query.trim() || DEFAULT_QUERY)
        if (loc.trim()) params.set('location', loc.trim())
        if (remote) params.set('remote', 'true')
        params.set('page', String(reqPage))
        const res = await fetch(`/api/jobs/discover?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()

        if (data.usage) setUsage({ used: data.usage.used, limit: data.usage.limit })

        if (!res.ok) {
          const msg = data.error || 'Failed to load listings'
          throw new Error(msg)
        }
        const batch: DiscoverListingWithApply[] = data.listings ?? []
        setListings((prev) => (append ? dedupeAppend(prev, batch) : batch))
        setPage(reqPage)
        setHasMore(batch.length > 0)
        if (!append) {
          saveParams({ q: query.trim() || '', location: loc.trim(), remoteOnly: remote })
        }
        setHasSearched(true)
      } catch (e) {
        if (!append) {
          setError(e instanceof Error ? e.message : 'Failed to load')
          setListings([])
        }
        setHasSearched(true)
      } finally {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    setSort(loadSort())
    setCompactView(loadCompact())
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SORT, sort)
    } catch {
      // ignore
    }
  }, [sort])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COMPACT, compactView ? '1' : '0')
    } catch {
      // ignore
    }
  }, [compactView])

  useEffect(() => {
    const stored = loadParams()
    setQ(stored.q)
    setLocation(stored.location)
    setRemoteOnly(stored.remoteOnly)
    runDiscover({
      query: stored.q || DEFAULT_QUERY,
      loc: stored.location,
      remote: stored.remoteOnly,
      page: 1,
      append: false,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount bootstrap

  function handleSearch() {
    setPage(1)
    setHasMore(true)
    runDiscover({ query: q, loc: location, remote: remoteOnly, page: 1, append: false })
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore || usage && usage.used >= usage.limit) return
    runDiscover({ query: q, loc: location, remote: remoteOnly, page: page + 1, append: true })
  }

  const usageText = usage
    ? `${usage.used}/${usage.limit} requests this month · ${Math.max(0, usage.limit - usage.used)} left`
    : null

  const quotaBlocked = Boolean(usage && usage.used >= usage.limit)

  const patchListing = useCallback(
    (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => {
      setListings((prev) =>
        prev.map((l) => (l.stable_external_id === stable_external_id ? { ...l, ...patch } : l))
      )
    },
    []
  )

  const filterChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = []
    if (remoteOnly) {
      chips.push({
        id: 'remote',
        label: 'Remote only',
        onRemove: () => {
          setRemoteOnly(false)
          setPage(1)
          setHasMore(true)
          runDiscover({ query: q, loc: location, remote: false, page: 1, append: false })
        },
      })
    }
    if (location.trim()) {
      const loc = location.trim()
      chips.push({
        id: 'location',
        label: `Location: ${loc}`,
        onRemove: () => {
          setLocation('')
          setPage(1)
          setHasMore(true)
          runDiscover({ query: q, loc: '', remote: remoteOnly, page: 1, append: false })
        },
      })
    }
    return chips
  }, [remoteOnly, location, q, runDiscover])

  function clearFilters() {
    setQ('')
    setLocation('')
    setRemoteOnly(false)
    setPage(1)
    setHasMore(true)
    runDiscover({ query: DEFAULT_QUERY, loc: '', remote: false, page: 1, append: false })
  }

  return (
    <JobsShell>
      <Card className="jobs-board-surface border-border">
        <CardHeader className="jobs-board-header app-board-header">
          <CardTitle className="jobs-section-title">{jobBoardPage.title}</CardTitle>
          <CardDescription className="jobs-section-hint">
            {hasSearched ? jobBoardPage.descriptionSearched : jobBoardPage.descriptionIdle}{' '}
            Start tailoring from a listing to continue in Resume.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <JobFilterBar
                variant="manual"
                q={q}
                onQChange={setQ}
                location={location}
                onLocationChange={setLocation}
                remoteOnly={remoteOnly}
                onRemoteOnlyChange={setRemoteOnly}
                onSearch={handleSearch}
                loading={loading}
                usageText={usageText}
                searchInputRef={searchInputRef}
              />
            </div>
            <div className="flex shrink-0 justify-end pb-1">
              <ExternalJobSheet />
            </div>
          </div>

          {quotaBlocked && <JobQuotaState used={usage!.used} limit={usage!.limit} />}

          {error && !quotaBlocked && (
            <JobErrorState message={error} onRetry={handleSearch} />
          )}

          {!quotaBlocked && !error && (
            <>
              <ResultsToolbar
                count={listings.length}
                loading={loading}
                chips={filterChips}
                sort={sort}
                onSortChange={setSort}
                compactView={compactView}
                onCompactViewChange={setCompactView}
                onCheckFitAll={() => setCheckAllTrigger(Date.now())}
                checkFitDisabled={loading || listings.length === 0}
                showCheckFitAll={listings.length > 0}
              />

              {loading ? (
                <JobListSkeleton rows={7} />
              ) : listings.length === 0 ? (
                <JobEmptyNoResults
                  onClearFilters={hasSearched ? clearFilters : undefined}
                />
              ) : (
                <>
                  <JobBoardSplit
                    listings={listings}
                    sort={sort}
                    compact={compactView}
                    checkAllTrigger={checkAllTrigger ?? undefined}
                    onPatchListing={patchListing}
                    onOpenDataTab={onOpenDataTab}
                    focusStableExternalId={focusStableExternalId}
                    onFocusConsumed={onFocusListingConsumed}
                    listingsLoading={loading}
                    onTailorResume={onStartTailorResume}
                  />
                  {hasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loadingMore}
                        onClick={handleLoadMore}
                      >
                        {loadingMore ? 'Loading…' : 'Load more'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </JobsShell>
  )
}
