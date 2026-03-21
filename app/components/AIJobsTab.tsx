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
  JobEmptyAI,
  JobErrorState,
  JobGeneratingQualifications,
  StrongMatchLoopPanel,
  type DiscoverListing,
  type DiscoverListingWithApply,
  type FilterChip,
  type JobSort,
} from '@/app/components/jobs'
import type { JobSearchAnchor } from '@/lib/jobs/jobSearchAnchor'

export type { DiscoverListing, DiscoverListingWithApply }

interface JobQualifications {
  search_query: string
  location: string | null
  remote: boolean
  generated_at: string
}

const DEFAULT_QUERY = 'jobs'
const STORAGE_SORT = 'earnOS_ai_jobs_sort'
const STORAGE_COMPACT = 'earnOS_ai_jobs_compact'

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

interface AIJobsTabProps {
  onOpenDataTab?: () => void
  onOpenResumeTab?: () => void
}

export default function AIJobsTab({ onOpenDataTab, onOpenResumeTab }: AIJobsTabProps) {
  const [aiListings, setAiListings] = useState<DiscoverListingWithApply[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiQualifications, setAiQualifications] = useState<JobQualifications | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [checkAllTrigger, setCheckAllTrigger] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [sort, setSort] = useState<JobSort>('posted')
  const [compactView, setCompactView] = useState(false)
  const [jobSearchAnchor, setJobSearchAnchor] = useState<JobSearchAnchor | null>(null)

  const aiQualRef = useRef<JobQualifications | null>(null)

  const fetchListings = useCallback(
    async (qual: JobQualifications, reqPage: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else {
        setAiLoading(true)
        setAiError(null)
      }
      try {
        const params = new URLSearchParams()
        params.set('q', qual.search_query.trim() || DEFAULT_QUERY)
        const loc = qual.location?.trim()
        if (loc) params.set('location', loc)
        if (qual.remote) params.set('remote', 'true')
        params.set('page', String(reqPage))
        const res = await fetch(`/api/jobs/discover?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load listings')
        const batch: DiscoverListingWithApply[] = data.listings ?? []
        setAiListings((prev) => (append ? dedupeAppend(prev, batch) : batch))
        setPage(reqPage)
        setHasMore(batch.length > 0)
      } catch (e) {
        if (!append) {
          setAiError(e instanceof Error ? e.message : 'Failed to load')
          setAiListings([])
        }
      } finally {
        if (append) setLoadingMore(false)
        else setAiLoading(false)
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
    let cancelled = false
    async function run() {
      const getRes = await fetch('/api/jobs/qualifications', { credentials: 'include' })
      const getData = await getRes.json()
      if (cancelled) return
      if (getData.success && getData.qualifications) {
        setAiQualifications(getData.qualifications)
        aiQualRef.current = getData.qualifications
        setJobSearchAnchor(getData.anchor ?? null)
      } else {
        setJobSearchAnchor(null)
        setAiGenerating(true)
        try {
          const postRes = await fetch('/api/jobs/qualifications', {
            method: 'POST',
            credentials: 'include',
          })
          const postData = await postRes.json()
          if (cancelled) return
          if (!postRes.ok) {
            setAiError(postData.error || 'Complete your Data tab first, then refresh.')
            return
          }
          if (postData.qualifications) {
            setAiQualifications(postData.qualifications)
            aiQualRef.current = postData.qualifications
            setJobSearchAnchor(postData.anchor ?? null)
          }
        } finally {
          if (!cancelled) setAiGenerating(false)
        }
      }
      const qual = aiQualRef.current
      if (qual && !cancelled) {
        setPage(1)
        setHasMore(true)
        await fetchListings(qual, 1, false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [fetchListings])

  async function handleRefreshQualifications() {
    setAiGenerating(true)
    setAiError(null)
    try {
      const res = await fetch('/api/jobs/qualifications', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || 'Could not generate qualifications.')
        return
      }
      if (data.qualifications) {
        setAiQualifications(data.qualifications)
        aiQualRef.current = data.qualifications
        setJobSearchAnchor(data.anchor ?? null)
        setPage(1)
        setHasMore(true)
        await fetchListings(data.qualifications, 1, false)
      }
    } finally {
      setAiGenerating(false)
    }
  }

  function handleLoadMore() {
    const qual = aiQualRef.current
    if (!qual || loadingMore || !hasMore || aiLoading) return
    fetchListings(qual, page + 1, true)
  }

  const readOnlyChips = useMemo((): FilterChip[] => {
    if (!aiQualifications) return []
    const chips: FilterChip[] = []
    if (aiQualifications.remote) chips.push({ id: 'chip-remote', label: 'Remote' })
    if (aiQualifications.location) chips.push({ id: 'chip-loc', label: aiQualifications.location })
    if (jobSearchAnchor?.sectors?.length) {
      jobSearchAnchor.sectors.slice(0, 6).forEach((s, i) => {
        chips.push({ id: `chip-sector-${i}`, label: s })
      })
    }
    return chips
  }, [aiQualifications, jobSearchAnchor])

  const showBoard = aiQualifications && !aiGenerating

  const patchListing = useCallback(
    (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => {
      setAiListings((prev) =>
        prev.map((l) => (l.stable_external_id === stable_external_id ? { ...l, ...patch } : l))
      )
    },
    []
  )

  return (
    <JobsShell>
      <StrongMatchLoopPanel onOpenDataTab={onOpenDataTab} onOpenResumeTab={onOpenResumeTab} />
      <Card className="jobs-board-surface border-border">
        <CardHeader className="jobs-board-header app-board-header">
          <CardTitle className="jobs-section-title">AI job board</CardTitle>
          <CardDescription className="jobs-section-hint">
            Roles matched to your profile. Search terms are generated from your Data tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiError && <JobErrorState message={aiError} onRetry={handleRefreshQualifications} />}

          {!aiError && aiGenerating && <JobGeneratingQualifications />}

          {!aiError && !aiGenerating && !aiQualifications && <JobListSkeleton rows={4} />}

          {showBoard && aiQualifications && (
            <>
              <JobFilterBar
                variant="ai"
                searchQuery={aiQualifications.search_query}
                location={aiQualifications.location}
                remote={aiQualifications.remote}
                onRefreshQualifications={handleRefreshQualifications}
                disabled={aiGenerating || aiLoading}
              />

              <ResultsToolbar
                count={aiListings.length}
                loading={aiLoading}
                chips={readOnlyChips}
                sort={sort}
                onSortChange={setSort}
                compactView={compactView}
                onCompactViewChange={setCompactView}
                onCheckFitAll={() => setCheckAllTrigger(Date.now())}
                checkFitDisabled={aiLoading || aiListings.length === 0}
                showCheckFitAll={aiListings.length > 0}
              />

              {aiLoading ? (
                <JobListSkeleton rows={7} />
              ) : aiListings.length === 0 ? (
                <JobEmptyAI onRefresh={handleRefreshQualifications} />
              ) : (
                <>
                  <JobBoardSplit
                    listings={aiListings}
                    sort={sort}
                    compact={compactView}
                    checkAllTrigger={checkAllTrigger ?? undefined}
                    onPatchListing={patchListing}
                    onOpenDataTab={onOpenDataTab}
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
