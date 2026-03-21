'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { TrendingDown, Send, CheckCircle2, Clock, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import { buildStageFilterOptions, stageFilterLabel } from '@/lib/jobs/sankeyPipeline'

const ApplicationPipelineChart = dynamic(
  () =>
    import('@/app/components/applications/ApplicationPipelineChart').then((m) => m.ApplicationPipelineChart),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Loading pipeline chart…</p>,
  }
)

export type FunnelStats = {
  total: number
  awaiting: number
  applied: number
  later: number
  skipped: number
  manual: number
}

export function computeFunnelStats(listings: JobListingRow[]): FunnelStats {
  let awaiting = 0
  let applied = 0
  let later = 0
  let skipped = 0
  let manual = 0
  for (const L of listings) {
    if (L.source === 'manual') manual += 1
    const d = L.apply_decision
    if (d === 'applied') applied += 1
    else if (d === 'later') later += 1
    else if (d === 'not_applied') skipped += 1
    else if (L.apply_outbound_at) awaiting += 1
  }
  return {
    total: listings.length,
    awaiting,
    applied,
    later,
    skipped,
    manual,
  }
}

const statConfig = [
  { key: 'total', label: 'Tracked', icon: Send, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  { key: 'awaiting', label: 'In flight', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'applied', label: 'Applied', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'later', label: 'Later', icon: TrendingDown, color: 'text-violet-400', bg: 'bg-violet-500/10' },
] as const

export function ApplicationInsights({
  listings,
  pipelineNotesCount,
  selectedStage = null,
  onStageSelect = () => {},
  className,
}: {
  listings: JobListingRow[]
  pipelineNotesCount: number
  selectedStage?: string | null
  onStageSelect?: (stageKey: string) => void
  className?: string
}) {
  const stats = useMemo(() => computeFunnelStats(listings), [listings])

  const segments = useMemo(() => {
    const parts = [
      { key: 'applied', count: stats.applied, className: 'bg-emerald-500', label: 'Applied' },
      { key: 'awaiting', count: stats.awaiting, className: 'bg-sky-500', label: 'Opened / deciding' },
      { key: 'later', count: stats.later, className: 'bg-violet-500', label: 'Deferred' },
      { key: 'skipped', count: stats.skipped, className: 'bg-zinc-500', label: 'Skipped' },
    ].filter((p) => p.count > 0)
    if (parts.length === 0 && stats.total === 0) {
      return [{ key: 'empty', count: 1, className: 'bg-muted', label: 'No data yet', pct: 100 }]
    }
    if (parts.length === 0) {
      return [
        {
          key: 'tracked',
          count: stats.total,
          className: 'bg-primary',
          label: 'In pipeline',
          pct: 100,
        },
      ]
    }
    const sum = parts.reduce((s, p) => s + p.count, 0) || 1
    return parts.map((p) => ({ ...p, pct: (p.count / sum) * 100 }))
  }, [stats])

  const stageFilterOptions = useMemo(() => buildStageFilterOptions(listings), [listings])
  const breakdownRows = useMemo(
    () => stageFilterOptions.filter((o) => o.stageKey !== null),
    [stageFilterOptions]
  )

  if (stats.total === 0) return null

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statConfig.map(({ key, label, icon: Icon, color, bg }) => {
          const v = stats[key as keyof FunnelStats]
          const num = typeof v === 'number' ? v : 0
          return (
            <div
              key={key}
              className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-border"
            >
              <div className={cn('mb-2 inline-flex rounded-lg p-2', bg)}>
                <Icon className={cn('h-4 w-4', color)} aria-hidden />
              </div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{num}</p>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Stages in your data</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Before you apply</span> covers saved roles, opened apply links,
          and skips. <span className="font-medium text-foreground">After you mark applied</span>, stages track screening
          through offer, plus ghosted or rejected. Each role shows the same status on its card.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Click a row to filter the list below (same as the optional flow diagram). Click again to clear.
        </p>
        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60" role="list">
          {breakdownRows.map((row) => {
            const key = row.stageKey!
            const selected = selectedStage === key
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onStageSelect(key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                    'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    selected && 'bg-primary/10'
                  )}
                  aria-pressed={selected}
                >
                  <span className="font-medium text-foreground">{stageFilterLabel(key)}</span>
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <details className="group rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
        <summary className="cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Pipeline flow diagram</h3>
            <span className="text-xs font-medium text-primary group-open:text-muted-foreground">
              Optional · click stages to filter
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Expand for a Sankey view. You can always use the stage list above or the filter on the roles section.
          </p>
        </summary>
        <div className="border-t border-border/60 px-5 pb-5 pt-2">
          <div className="min-w-0 overflow-x-auto">
            <ApplicationPipelineChart
              listings={listings}
              selectedStage={selectedStage}
              onStageSelect={onStageSelect}
            />
          </div>
        </div>
      </details>

      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Apply decision mix</h3>
          <span className="text-xs text-muted-foreground">Share of tracked roles (by count)</span>
        </div>
        <div
          className="flex h-4 overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/50"
          role="img"
          aria-label="Distribution of application outcomes"
        >
          {segments.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.count}`}
              className={cn(s.className, 'min-w-0 transition-all duration-500 ease-out')}
              style={{ width: `${s.pct}%` }}
            />
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', s.className)} aria-hidden />
              <span className="text-foreground/90">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">({s.count})</span>
            </li>
          ))}
        </ul>
        {pipelineNotesCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{pipelineNotesCount}</span> pipeline update
            {pipelineNotesCount !== 1 ? 's' : ''} logged across roles
          </p>
        )}
        {stats.manual > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {stats.manual} role{stats.manual !== 1 ? 's' : ''} logged off-platform
          </p>
        )}
      </div>
    </div>
  )
}
