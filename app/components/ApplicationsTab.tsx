'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ExternalLink, RefreshCw, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { JobsShell } from '@/app/components/jobs/JobsShell'
import type { JobListingRow } from '@/lib/jobs/jobListingRow'

interface ApplicationEventRow {
  id: string
  job_listing_id: string
  event_type: string
  details: Record<string, unknown>
  created_at: string
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
    case 'apply_outbound_click':
      return 'Opened external apply link from eOS'
    case 'apply_decision': {
      const d = details.decision
      if (d === 'applied') return 'You marked: applied'
      if (d === 'not_applied') return 'You marked: did not apply'
      if (d === 'later') return 'You marked: decide later'
      return 'Apply decision recorded'
    }
    case 'pipeline_note':
      return typeof details.note === 'string' ? details.note : 'Pipeline note'
    default:
      return type.replace(/_/g, ' ')
  }
}

function decisionBadge(listing: JobListingRow) {
  const d = listing.apply_decision
  if (d === 'applied')
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        Applied
      </span>
    )
  if (d === 'later')
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400">
        Later
      </span>
    )
  if (d === 'not_applied')
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Skipped
      </span>
    )
  if (listing.apply_outbound_at) {
    return (
      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-400">
        Awaiting decision
      </span>
    )
  }
  return null
}

function ListingPipelineCard({
  listing,
  events,
  onNoteAdded,
}: {
  listing: JobListingRow
  events: ApplicationEventRow[]
  onNoteAdded: () => void
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
    <Card className="border-border">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg leading-snug">{listing.title || 'Untitled role'}</CardTitle>
            <CardDescription className="mt-1 text-base text-foreground/80">{listing.company}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">{decisionBadge(listing)}</div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="capitalize">Source: {listing.source || '—'}</span>
          {listing.apply_outbound_at && <span>Last open: {formatWhen(listing.apply_outbound_at)}</span>}
          {listing.apply_decision_at && <span>Decision: {formatWhen(listing.apply_decision_at)}</span>}
        </div>
        {listing.url && (
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View listing <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        <section aria-label="Resume used">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resume / materials</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-job tailored resumes will show here when you use &quot;Tailor resume to listing&quot; (coming soon). For
            now this is your main profile-backed flow from the job boards.
          </p>
        </section>

        <section aria-label="Pipeline timeline">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline &amp; activity</h3>
          {sorted.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No events yet. Open a job from the board to start logging.</p>
          ) : (
            <ol className="mt-3 space-y-3 border-l border-border pl-4">
              {sorted.map((ev) => (
                <li key={ev.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                    aria-hidden
                  />
                  <p className="text-sm text-foreground">{eventLabel(ev.event_type, ev.details)}</p>
                  <p className="text-xs text-muted-foreground">{formatWhen(ev.created_at)}</p>
                  {ev.event_type === 'apply_decision' &&
                    typeof ev.details.notes === 'string' &&
                    ev.details.notes.trim() && (
                      <p className="mt-1 text-sm text-muted-foreground italic">&ldquo;{String(ev.details.notes)}&rdquo;</p>
                    )}
                </li>
              ))}
            </ol>
          )}

          <form onSubmit={submitNote} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={`pipeline-note-${listing.id}`} className="sr-only">
                Add pipeline update
              </label>
              <textarea
                id={`pipeline-note-${listing.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. HireVue invite, phone screen Tuesday, rejection email…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" disabled={saving || !note.trim()} className="shrink-0">
              {saving ? 'Saving…' : 'Add update'}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  )
}

export default function ApplicationsTab() {
  const [listings, setListings] = useState<JobListingRow[]>([])
  const [events, setEvents] = useState<ApplicationEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setListings(data.listings ?? [])
      setEvents(data.events ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setListings([])
      setEvents([])
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

  return (
    <JobsShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Application log</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Full feedback loop for roles you open from the Job Board or Recommended Jobs: outbound clicks, apply
            decisions, and your own pipeline notes. Export for spreadsheets or future analytics (e.g. funnel charts).
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={downloadCsv} disabled={loading || listings.length === 0}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </div>
        </header>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && !error && listings.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No application activity yet</p>
              <p className="mt-2">
                When you use <strong>Apply</strong> on the Job Board or Recommended Jobs, entries appear here with a
                timeline you can extend with pipeline updates.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && listings.length > 0 && (
          <ul className="space-y-6">
            {listings.map((listing) => (
              <li key={listing.id}>
                <ListingPipelineCard
                  listing={listing}
                  events={eventsByListing.get(listing.id) ?? []}
                  onNoteAdded={load}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </JobsShell>
  )
}
