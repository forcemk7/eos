'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  ExternalLink,
  RefreshCw,
  Download,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  CircleDot,
  X,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { AppShell, AppLoadingBlock } from '@/app/components/shell'
import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import type { ApplicationReportMeta } from '@/lib/jobs/applicationReportMeta'
import { ApplicationInsights } from '@/app/components/applications/ApplicationInsights'
import { ManualApplicationSheet } from '@/app/components/applications/ManualApplicationSheet'
import { ExternalJobSheet } from '@/app/components/jobs/ExternalJobSheet'
import {
  listingMatchesSankeyFilter,
  SANKEY_FILTER_ALL_APPLIED,
  SANKEY_FILTER_IN_PROCESS_HUB,
} from '@/lib/jobs/sankeyPipeline'
import {
  isCustomPipelineStageId,
  PIPELINE_CUSTOM_PREFIX,
  PIPELINE_POST_APPLY_STAGES,
  pipelineStageLabel,
  preApplyStageLabel,
} from '@/lib/jobs/pipelineTaxonomy'
import { cn } from '@/lib/utils'

interface ApplicationEventRow {
  id: string
  job_listing_id: string
  event_type: string
  details: Record<string, unknown>
  created_at: string
}

export interface ApplicationsTabProps {
  onBrowseJobs?: () => void
  onBrowseRecommended?: () => void
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function eventLabel(type: string, details: Record<string, unknown>): string {
  switch (type) {
    case 'manual_entry': {
      const applied = details.mark_applied === true
      const n = typeof details.note === 'string' ? details.note.trim() : ''
      if (n) return applied ? `Logged off-platform · applied · ${n}` : `Logged off-platform · tracking · ${n}`
      return applied ? 'Logged off-platform (submitted application)' : 'Logged off-platform (saved role)'
    }
    case 'imported_external': {
      const n = typeof details.note === 'string' ? details.note.trim() : ''
      if (n) return `Imported external listing · ${n}`
      return 'Imported external listing into eOS'
    }
    case 'apply_outbound_click':
      return 'Opened external apply link from eOS'
    case 'apply_decision': {
      const d = details.decision
      if (d === 'applied') return 'Marked as applied'
      if (d === 'not_applied') return 'Marked as did not apply'
      if (d === 'later') return 'Deferred — decide later'
      return 'Decision recorded'
    }
    case 'pipeline_note':
      return typeof details.note === 'string' ? details.note : 'Pipeline update'
    case 'pipeline_stage_change': {
      const s = details.stage
      if (s == null || s === '') return 'Pipeline stage cleared'
      return `Stage → ${pipelineStageLabel(String(s))}`
    }
    default:
      return type.replace(/_/g, ' ')
  }
}

function eventDotClass(type: string): string {
  switch (type) {
    case 'apply_outbound_click':
      return 'bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.25)]'
    case 'apply_decision':
      return 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]'
    case 'manual_entry':
      return 'bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]'
    case 'imported_external':
      return 'bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.25)]'
    case 'pipeline_note':
      return 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]'
    case 'pipeline_stage_change':
      return 'bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.25)]'
    default:
      return 'bg-muted-foreground/80'
  }
}

function decisionBadge(listing: JobListingRow) {
  const d = listing.apply_decision
  if (d === 'applied')
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        Applied
      </span>
    )
  if (d === 'later')
    return (
      <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
        Later
      </span>
    )
  if (d === 'not_applied')
    return (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        Skipped
      </span>
    )
  if (listing.apply_outbound_at) {
    return (
      <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
        In flight
      </span>
    )
  }
  if (listing.source === 'manual') {
    return (
      <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
        Manual
      </span>
    )
  }
  return null
}

function companyInitial(name: string) {
  const t = name.trim()
  return t ? t.charAt(0).toUpperCase() : '?'
}

function stageFilterLabel(id: string): string {
  if (id === SANKEY_FILTER_ALL_APPLIED) return 'All applied'
  if (id === SANKEY_FILTER_IN_PROCESS_HUB) return 'In progress'
  if (id.startsWith('pre_')) return preApplyStageLabel(id)
  return pipelineStageLabel(id)
}

function PipelineStageControl({
  listing,
  onSaved,
}: {
  listing: JobListingRow
  onSaved: () => void
}) {
  const raw = listing.pipeline_stage?.trim() ?? ''
  const isCustom = isCustomPipelineStageId(raw)
  const [customDraft, setCustomDraft] = useState(() =>
    isCustom ? raw.slice(PIPELINE_CUSTOM_PREFIX.length) : ''
  )
  const [savingStage, setSavingStage] = useState(false)

  useEffect(() => {
    if (isCustomPipelineStageId(raw)) setCustomDraft(raw.slice(PIPELINE_CUSTOM_PREFIX.length))
    else setCustomDraft('')
  }, [raw, listing.id])

  async function postStage(stage: string | null) {
    setSavingStage(true)
    try {
      const res = await fetch(`/api/jobs/${listing.id}/apply-event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pipeline_stage_set', stage: stage === null ? '' : stage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update stage')
      onSaved()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update stage')
    } finally {
      setSavingStage(false)
    }
  }

  const selectable = PIPELINE_POST_APPLY_STAGES.filter((s) => s.selectable)

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline stage</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label htmlFor={`pipeline-stage-${listing.id}`} className="sr-only">
          Pipeline stage
        </label>
        <select
          id={`pipeline-stage-${listing.id}`}
          className="w-full min-w-[12rem] max-w-md rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          value={isCustom ? '__current_custom__' : raw || ''}
          disabled={savingStage}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__current_custom__') return
            void postStage(v === '' ? null : v)
          }}
        >
          {isCustom && (
            <option value="__current_custom__">{pipelineStageLabel(raw)}</option>
          )}
          <option value="">Not set</option>
          {selectable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            type="text"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            placeholder="Custom label (e.g. HireVue)"
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Custom pipeline stage label"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={savingStage || !customDraft.trim()}
            onClick={() => void postStage(`${PIPELINE_CUSTOM_PREFIX}${customDraft.trim()}`)}
          >
            Save custom
          </Button>
        </div>
      </div>
    </div>
  )
}

function ListingPipelineCard({
  listing,
  events,
  onNoteAdded,
  eventsReady,
}: {
  listing: JobListingRow
  events: ApplicationEventRow[]
  onNoteAdded: () => void
  eventsReady: boolean
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [events]
  )

  async function submitNote(e: React.FormEvent) {
    e.preventDefault()
    const t = note.trim()
    if (!t || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${listing.id}/apply-event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pipeline_note', note: t }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setNote('')
      onNoteAdded()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li>
      <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 text-lg font-bold text-foreground ring-1 ring-border/60"
            aria-hidden
          >
            {companyInitial(listing.company)}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                  {listing.title || 'Untitled role'}
                </h3>
                <p className="mt-0.5 text-sm font-medium text-muted-foreground">{listing.company}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">{decisionBadge(listing)}</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted/50 px-2 py-0.5 font-medium capitalize text-foreground/80">
                {listing.source || 'listing'}
              </span>
              {listing.apply_outbound_at && <span>Opened {formatWhen(listing.apply_outbound_at)}</span>}
              {listing.apply_decision_at && <span>Decision {formatWhen(listing.apply_decision_at)}</span>}
            </div>
            {listing.url && (
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                View posting
                <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </a>
            )}

            {listing.apply_decision === 'applied' && <PipelineStageControl listing={listing} onSaved={onNoteAdded} />}

            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resume / materials</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Per-job tailored resumes will appear here after you use &quot;Tailor resume to listing&quot;. Until then,
                your profile-backed materials apply.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
              {!eventsReady ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Timeline unavailable until the <code className="rounded bg-muted px-1 text-xs">application_events</code>{' '}
                  table exists. Run the latest <code className="rounded bg-muted px-1 text-xs">backend/schema.sql</code> on
                  Supabase.
                </p>
              ) : sorted.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No events yet for this role.</p>
              ) : (
                <ol className="relative mt-3 space-y-0 border-l border-border/80 pl-5">
                  {sorted.map((ev, i) => (
                    <li key={ev.id} className={cn('relative pb-5 last:pb-0', i === sorted.length - 1 && 'last:pb-0')}>
                      <span
                        className={cn(
                          'absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                          eventDotClass(ev.event_type)
                        )}
                        aria-hidden
                      />
                      <p className="text-sm font-medium leading-snug text-foreground">{eventLabel(ev.event_type, ev.details)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatWhen(ev.created_at)}</p>
                      {ev.event_type === 'apply_decision' &&
                        typeof ev.details.notes === 'string' &&
                        ev.details.notes.trim() && (
                          <p className="mt-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm italic text-muted-foreground">
                            &ldquo;{String(ev.details.notes)}&rdquo;
                          </p>
                        )}
                    </li>
                  ))}
                </ol>
              )}

              {eventsReady && (
                <form onSubmit={submitNote} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`pipeline-note-${listing.id}`} className="sr-only">
                      Add pipeline update
                    </label>
                    <textarea
                      id={`pipeline-note-${listing.id}`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Interview invite, rejection, recruiter name…"
                      rows={2}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <Button type="submit" disabled={saving || !note.trim()} className="shrink-0">
                    {saving ? 'Saving…' : 'Add update'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

function SchemaBanner({ meta }: { meta: ApplicationReportMeta | null }) {
  if (!meta?.suggestDatabaseMigration) return null
  return (
    <div
      className="flex gap-4 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-sm"
      role="status"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">Database needs the latest migration</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Apply tracking columns or the events table are missing. Run the current{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">backend/schema.sql</code> in the Supabase SQL editor—we
          still show saved roles where possible, but funnel stats and timelines stay limited until then.
        </p>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {!meta.applyTrackingReady && <li>Apply columns on <code className="text-xs">job_listings</code></li>}
          {!meta.eventsReady && <li><code className="text-xs">application_events</code> table</li>}
        </ul>
      </div>
    </div>
  )
}

export default function ApplicationsTab({ onBrowseJobs, onBrowseRecommended }: ApplicationsTabProps) {
  const [listings, setListings] = useState<JobListingRow[]>([])
  const [events, setEvents] = useState<ApplicationEventRow[]>([])
  const [meta, setMeta] = useState<ApplicationReportMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStageId, setFilterStageId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs/application-report', { credentials: 'include' })
      const data = await res.json()
      if (res.status === 401) {
        setError('Sign in to view your application log.')
        setListings([])
        setEvents([])
        setMeta(null)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setListings(data.listings ?? [])
      setEvents(data.events ?? [])
      setMeta(data.meta ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setListings([])
      setEvents([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const eventsByListing = useMemo(() => {
    const m = new Map<string, ApplicationEventRow[]>()
    for (const ev of events) {
      const list = m.get(ev.job_listing_id) ?? []
      list.push(ev)
      m.set(ev.job_listing_id, list)
    }
    return m
  }, [events])

  const pipelineNotesCount = useMemo(
    () => events.filter((e) => e.event_type === 'pipeline_note').length,
    [events]
  )

  const eventsReady = meta?.eventsReady !== false

  const filteredListings = useMemo(
    () => listings.filter((L) => listingMatchesSankeyFilter(L, filterStageId)),
    [listings, filterStageId]
  )

  const handleStageSelect = useCallback((stageKey: string) => {
    setFilterStageId((prev) => (prev === stageKey ? null : stageKey))
  }, [])

  async function downloadCsv() {
    try {
      const res = await fetch('/api/jobs/application-report?format=csv', { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'earnOS-application-report.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const showEmpty = !loading && !error && listings.length === 0

  return (
    <AppShell className="applications-log-page">
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] p-6 shadow-sm md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <CircleDot className="h-3.5 w-3.5 text-primary" aria-hidden />
                Full feedback loop
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Application pipeline</h1>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                Track every role—from boards or elsewhere—see outcome mix like a Sankey snapshot, and keep a living
                timeline. Logging here makes it easier to remember follow-ups and to see where your search leaks.
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
              <ExternalJobSheet onImported={load} />
              <ManualApplicationSheet onLogged={load} />
              <Button type="button" variant="outline" size="default" onClick={load} disabled={loading} className="gap-2">
                <RefreshCw
                  className={cn('h-4 w-4', loading && 'animate-spin motion-reduce:animate-none')}
                  aria-hidden
                />
                Refresh
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="default"
                onClick={downloadCsv}
                disabled={loading || listings.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" aria-hidden />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <SchemaBanner meta={meta} />

          {error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && <AppLoadingBlock message="Loading your pipeline…" />}

          {!loading && !error && listings.length > 0 && (
            <ApplicationInsights
              listings={listings}
              pipelineNotesCount={pipelineNotesCount}
              selectedStage={filterStageId}
              onStageSelect={handleStageSelect}
            />
          )}

          {showEmpty && (
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-card to-muted/10 shadow-sm">
              <div className="grid gap-0 md:grid-cols-[1fr_minmax(0,280px)]">
                <div className="space-y-4 p-8 md:p-10">
                  <div className="inline-flex rounded-xl bg-primary/10 p-3">
                    <Sparkles className="h-6 w-6 text-primary" aria-hidden />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">Nothing in your pipeline yet</h2>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                    When you hit <strong>Apply</strong> on the Job Board or Recommended Jobs, roles land here with
                    decisions and reminders. Or log something you applied to elsewhere—the funnel fills in as you go.
                  </p>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                    {onBrowseJobs && (
                      <Button type="button" className="gap-2" onClick={onBrowseJobs}>
                        Open Job Board
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                    {onBrowseRecommended && (
                      <Button type="button" variant="outline" className="gap-2" onClick={onBrowseRecommended}>
                        Recommended Jobs
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Applied on LinkedIn or email? Use <strong>Log off-platform role</strong> above.
                  </p>
                </div>
                <div className="flex flex-col justify-center border-t border-border/60 bg-muted/15 p-8 md:border-l md:border-t-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why log?</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                      See rejection vs ghosting patterns over time
                    </li>
                    <li className="flex gap-2">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                      Prompts after apply help you close the loop
                    </li>
                    <li className="flex gap-2">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                      CSV export for deeper charts (e.g. Sankey)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && listings.length > 0 && (
            <section aria-label="Application list">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Roles</h2>
                {filterStageId != null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setFilterStageId(null)}
                  >
                    <span className="max-w-[220px] truncate text-left">
                      Filter: {stageFilterLabel(filterStageId)}
                    </span>
                    <X className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    <span className="sr-only">Clear filter</span>
                  </Button>
                )}
              </div>
              {filteredListings.length === 0 ? (
                <p className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                  No roles in this stage. Clear the filter or pick another segment on the chart.
                </p>
              ) : (
                <ul className="space-y-5">
                  {filteredListings.map((listing) => (
                    <ListingPipelineCard
                      key={listing.id}
                      listing={listing}
                      events={eventsByListing.get(listing.id) ?? []}
                      onNoteAdded={load}
                      eventsReady={eventsReady}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
    </AppShell>
  )
}
