'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import {
  pipelineStageGroup,
  resolveDisplayStage,
} from '@/lib/jobs/pipelineTaxonomy'
import { cn } from '@/lib/utils'

function summarizeApplied(listings: JobListingRow[]) {
  let progress = 0
  let reject = 0
  let ghost = 0
  let neutral = 0
  for (const L of listings) {
    if (L.apply_decision !== 'applied') continue
    const g = pipelineStageGroup(resolveDisplayStage(L))
    if (g === 'progress') progress += 1
    else if (g === 'reject') reject += 1
    else if (g === 'ghost') ghost += 1
    else neutral += 1
  }
  const applied = progress + reject + ghost + neutral
  return { applied, progress, reject, ghost, neutral }
}

export function ApplicationPipelineDashboardStrip({
  user,
  onOpenApplications,
}: {
  user: User | null
  onOpenApplications: () => void
}) {
  const [listings, setListings] = useState<JobListingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setListings([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs/application-report', { credentials: 'include' })
      const data = await res.json()
      if (res.status === 401) {
        setListings([])
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setListings(data.listings ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const { applied, progress, reject, ghost, neutral } = useMemo(() => summarizeApplied(listings), [listings])
  const total = listings.length

  const segments = useMemo(() => {
    if (applied <= 0) return []
    const parts = [
      { key: 'progress', count: progress, className: 'bg-teal-500', label: 'In progress' },
      { key: 'reject', count: reject, className: 'bg-rose-500', label: 'Rejected' },
      { key: 'ghost', count: ghost, className: 'bg-slate-400', label: 'No reply' },
      { key: 'neutral', count: neutral, className: 'bg-amber-500', label: 'Stage unset' },
    ].filter((p) => p.count > 0)
    const sum = parts.reduce((s, p) => s + p.count, 0) || 1
    return parts.map((p) => ({ ...p, pct: (p.count / sum) * 100 }))
  }, [applied, progress, reject, ghost, neutral])

  if (!user) return null

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">Pipeline snapshot</p>
        <button
          type="button"
          onClick={onOpenApplications}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open log
        </button>
      </div>
      {loading && <p className="mt-2 text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {!loading && !error && total === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">No applications logged yet. Apply from Job Board or log off-platform roles.</p>
      )}
      {!loading && !error && total > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{total}</span> tracked role
            {total !== 1 ? 's' : ''}
            {applied > 0 && (
              <>
                {' '}
                · <span className="font-semibold tabular-nums text-foreground">{applied}</span> marked applied
              </>
            )}
          </p>
          {applied > 0 && segments.length > 0 && (
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted/60 ring-1 ring-border/40"
              role="img"
              aria-label="Applied roles by pipeline group"
            >
              {segments.map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${s.count}`}
                  className={cn(s.className, 'min-w-0 transition-all')}
                  style={{ width: `${s.pct}%` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
