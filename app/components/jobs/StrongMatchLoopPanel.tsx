'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { cn } from '@/lib/utils'
import { STRONG_MATCH_CRITERIA_BULLETS, isStrongMatch, toClientFitResult, type JobFitSuccessResponse } from '@/lib/jobsFit'
import { splitIntoSentences } from '@/lib/utils'
import { JobFitExplainModal } from '@/app/components/jobs/JobFitExplainModal'
import type { DiscoverListingWithApply } from '@/app/components/jobs/types'

type LoopIterationRow = {
  id: string
  session_id: string
  iteration_index: number
  search_params: { q?: string; location?: string; remote?: boolean; page?: number }
  listings: unknown
  evaluations: unknown
  strong_match_ids: string[] | null
  refinement_source: string | null
  suggested_next: Record<string, unknown> | null
  jsearch_requests_delta: number
  created_at: string
}

type SessionRow = {
  id: string
  title: string | null
  status: string
  created_at: string
  updated_at: string
}

function listingToSyncBody(l: DiscoverListingWithApply) {
  return {
    external_id: l.external_id,
    source: l.source,
    title: l.title,
    company: l.company,
    url: l.url,
    location: l.location,
    remote: l.remote,
    description: l.description,
    snippet: l.snippet,
    posted_at: l.posted_at,
    raw: l.raw,
  }
}

function bestScoreFromEvals(evals: unknown): number | null {
  if (!Array.isArray(evals)) return null
  let max = -1
  for (const row of evals) {
    if (!row || typeof row !== 'object') continue
    const fit = (row as { fit?: { score?: number } }).fit
    if (fit && typeof fit.score === 'number') max = Math.max(max, fit.score)
  }
  return max < 0 ? null : max
}

function strongCountFromEvals(evals: unknown): number {
  if (!Array.isArray(evals)) return 0
  let n = 0
  for (const row of evals) {
    if (!row || typeof row !== 'object') continue
    const fit = (row as { fit?: JobFitSuccessResponse }).fit
    if (fit && isStrongMatch(fit)) n++
  }
  return n
}

export interface StrongMatchLoopPanelProps {
  onOpenDataTab?: () => void
  onStartTailorResume?: (job: DiscoverListingWithApply) => void | Promise<void>
}

export function StrongMatchLoopPanel({ onOpenDataTab, onStartTailorResume }: StrongMatchLoopPanelProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [iterations, setIterations] = useState<LoopIterationRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [stepLoading, setStepLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [openPanel, setOpenPanel] = useState(true)
  const [forceRefresh, setForceRefresh] = useState(false)
  const [maxEvaluate, setMaxEvaluate] = useState(10)
  const [overrideQ, setOverrideQ] = useState('')
  const [overrideLoc, setOverrideLoc] = useState('')
  const [overrideRemote, setOverrideRemote] = useState<boolean | null>(null)
  const [overridePage, setOverridePage] = useState('')
  const [showOverrides, setShowOverrides] = useState(false)
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [compareResult, setCompareResult] = useState<{ a: LoopIterationRow; b: LoopIterationRow } | null>(null)
  const [usageHint, setUsageHint] = useState<string | null>(null)

  const [explainOpen, setExplainOpen] = useState(false)
  const [explainFit, setExplainFit] = useState<ReturnType<typeof toClientFitResult> | null>(null)
  const [explainTitle, setExplainTitle] = useState('')
  const [explainCompany, setExplainCompany] = useState('')
  const [explainListing, setExplainListing] = useState<DiscoverListingWithApply | null>(null)

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/jobs/match-loop/sessions', { credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.sessions)) setSessions(data.sessions)
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadSessionDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/match-loop/sessions/${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not load session')
        return
      }
      setIterations(Array.isArray(data.iterations) ? data.iterations : [])
    } catch {
      setError('Could not load session')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (sessionId) loadSessionDetail(sessionId)
  }, [sessionId, loadSessionDetail])

  useEffect(() => {
    setCompareA('')
    setCompareB('')
    setCompareResult(null)
  }, [sessionId])

  function buildOverrides():
    | { q?: string; location?: string; remote?: boolean; page?: number }
    | undefined {
    if (!showOverrides) return undefined
    const o: { q?: string; location?: string; remote?: boolean; page?: number } = {}
    if (overrideQ.trim()) o.q = overrideQ.trim()
    if (overrideLoc.trim()) o.location = overrideLoc.trim()
    if (overrideRemote !== null) o.remote = overrideRemote
    if (overridePage.trim()) {
      const p = parseInt(overridePage, 10)
      if (!Number.isNaN(p) && p >= 1) o.page = p
    }
    return Object.keys(o).length ? o : undefined
  }

  async function runStep(action: 'start' | 'continue') {
    setStepLoading(true)
    setError(null)
    setUsageHint(null)
    try {
      const body: Record<string, unknown> = {
        action,
        max_evaluate: maxEvaluate,
        force_refresh: forceRefresh,
      }
      if (action === 'continue' && sessionId) body.session_id = sessionId
      const ov = buildOverrides()
      if (ov) body.overrides = ov

      const res = await fetch('/api/jobs/match-loop/step', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Step failed')
        if (data.usage) setUsageHint(`JSearch usage: ${data.usage.used ?? '?'}/${data.usage.limit ?? '?'}`)
        return
      }
      if (data.session_id) setSessionId(data.session_id)
      if (data.usage?.jsearch) {
        const u = data.usage.jsearch
        setUsageHint(`JSearch: ${u.used}/${u.limit} this month · ${data.usage.fit_checks ?? 0} fit checks this step`)
      }
      await loadSessions()
      if (data.session_id) await loadSessionDetail(data.session_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Step failed')
    } finally {
      setStepLoading(false)
    }
  }

  async function runCompare() {
    if (!sessionId || !compareA || !compareB || compareA === compareB) return
    setError(null)
    try {
      const res = await fetch(
        `/api/jobs/match-loop/sessions/${sessionId}?compare=${encodeURIComponent(compareA)},${encodeURIComponent(compareB)}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!data.success || !data.compare) {
        setCompareResult(null)
        setError(data.error || 'Could not compare those iterations')
        return
      }
      setCompareResult(data.compare as { a: LoopIterationRow; b: LoopIterationRow })
    } catch {
      setCompareResult(null)
      setError('Compare failed')
    }
  }

  async function saveListing(listing: DiscoverListingWithApply) {
    setError(null)
    try {
      const res = await fetch('/api/jobs/sync-discover', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingToSyncBody(listing)),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not save listing')
        return
      }
      setUsageHint('Saved to your jobs — use Apply from the board to track.')
    } catch {
      setError('Could not save listing')
    }
  }

  function openExplain(
    fit: JobFitSuccessResponse,
    title: string,
    company: string,
    listing?: DiscoverListingWithApply | null
  ) {
    setExplainFit(toClientFitResult({ ...fit, success: true } as JobFitSuccessResponse))
    setExplainTitle(title)
    setExplainCompany(company)
    setExplainListing(listing ?? null)
    setExplainOpen(true)
  }

  function toggleIter(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <Card className="border-border">
        <CardHeader className="jobs-board-header app-board-header pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="jobs-section-title flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                Find a strong match
              </CardTitle>
              <ul className="jobs-section-hint m-0 mt-1 list-disc space-y-1 pl-4 text-xs sm:text-sm text-muted-foreground">
                {STRONG_MATCH_CRITERIA_BULLETS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => setOpenPanel((o) => !o)}
              aria-expanded={openPanel}
            >
              {openPanel ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>
        {openPanel && (
          <CardContent className="space-y-4 pt-0">
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {usageHint && <p className="text-xs text-muted-foreground">{usageHint}</p>}

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[140px] flex-col gap-1 text-xs text-muted-foreground">
                Session
                <select
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                  value={sessionId ?? ''}
                  onChange={(e) => setSessionId(e.target.value || null)}
                  disabled={loadingSessions}
                >
                  <option value="">— New / pick saved —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || `Loop ${s.id.slice(0, 8)}…`} ·{' '}
                      {new Date(s.updated_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Max fit checks / step
                <input
                  type="number"
                  min={1}
                  max={25}
                  className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={maxEvaluate}
                  onChange={(e) => setMaxEvaluate(Math.min(25, Math.max(1, parseInt(e.target.value, 10) || 10)))}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                />
                Force fresh JSearch (skip cache)
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={stepLoading} onClick={() => runStep('start')}>
                {stepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start new loop
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={stepLoading || !sessionId}
                onClick={() => runStep('continue')}
              >
                Run next iteration
              </Button>
            </div>

            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowOverrides((s) => !s)}
            >
              {showOverrides ? 'Hide search overrides' : 'Search overrides (optional)'}
            </button>
            {showOverrides && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  placeholder="Query q"
                  value={overrideQ}
                  onChange={(e) => setOverrideQ(e.target.value)}
                />
                <input
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  placeholder="Location"
                  value={overrideLoc}
                  onChange={(e) => setOverrideLoc(e.target.value)}
                />
                <select
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={overrideRemote === null ? '' : overrideRemote ? '1' : '0'}
                  onChange={(e) =>
                    setOverrideRemote(e.target.value === '' ? null : e.target.value === '1')
                  }
                >
                  <option value="">Remote: default</option>
                  <option value="1">Remote only</option>
                  <option value="0">Not remote-only</option>
                </select>
                <input
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  placeholder="Page"
                  value={overridePage}
                  onChange={(e) => setOverridePage(e.target.value)}
                />
              </div>
            )}

            {loadingDetail ? (
              <p className="text-sm text-muted-foreground">Loading iterations…</p>
            ) : sessionId && iterations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Run “Start new loop” to create the first iteration.</p>
            ) : null}

            {sessionId && iterations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeline</p>
                <ul className="space-y-1 border-l-2 border-border pl-3">
                  {[...iterations]
                    .sort((a, b) => b.iteration_index - a.iteration_index)
                    .map((it) => {
                      const sp = it.search_params ?? {}
                      const best = bestScoreFromEvals(it.evaluations)
                      const strongN = strongCountFromEvals(it.evaluations)
                      const open = expanded.has(it.id)
                      const evals = Array.isArray(it.evaluations) ? it.evaluations : []
                      return (
                        <li key={it.id} className="text-sm">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md py-1 text-left hover:bg-muted/50"
                            onClick={() => toggleIter(it.id)}
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )}
                            <span className="font-medium">Iteration {it.iteration_index}</span>
                            <span className="text-muted-foreground">
                              {sp.q ?? '—'} · p{sp.page ?? 1}
                              {sp.remote ? ' · remote' : ''}
                            </span>
                            {best != null && (
                              <span className="tabular-nums text-muted-foreground">best fit score {best}%</span>
                            )}
                            {strongN > 0 && (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                                {strongN} strong
                              </span>
                            )}
                          </button>
                          {open && (
                            <div className="ml-6 mt-2 space-y-2 border-l border-border pl-3">
                              {it.suggested_next && typeof it.suggested_next === 'object' && (
                                <div className="text-xs text-muted-foreground">
                                  <p className="m-0">
                                    Next suggested:{' '}
                                    <span className="text-foreground">
                                      {(it.suggested_next as { q?: string }).q} · p
                                      {(it.suggested_next as { page?: number }).page ?? 1}
                                    </span>
                                  </p>
                                  {(() => {
                                    const rationale = (it.suggested_next as { rationale?: string }).rationale
                                    if (!rationale?.trim()) return null
                                    const sentences = splitIntoSentences(rationale)
                                    if (sentences.length <= 1) {
                                      return <p className="m-0 mt-1 leading-relaxed">{rationale}</p>
                                    }
                                    return (
                                      <ul className="m-0 mt-1 list-disc space-y-0.5 pl-4 leading-relaxed">
                                        {sentences.map((s, si) => (
                                          <li key={si}>{s}</li>
                                        ))}
                                      </ul>
                                    )
                                  })()}
                                </div>
                              )}
                              <ul className="space-y-2">
                                {evals.map((row, idx) => {
                                  if (!row || typeof row !== 'object') return null
                                  const r = row as {
                                    stable_external_id?: string
                                    title?: string
                                    company?: string
                                    fit?: JobFitSuccessResponse
                                    error?: string
                                  }
                                  const listings = Array.isArray(it.listings) ? it.listings : []
                                  const listing = listings.find(
                                    (l: unknown) =>
                                      l &&
                                      typeof l === 'object' &&
                                      (l as { stable_external_id?: string }).stable_external_id ===
                                        r.stable_external_id
                                  ) as DiscoverListingWithApply | undefined
                                  const strong = r.fit && isStrongMatch(r.fit)
                                  return (
                                    <li
                                      key={r.stable_external_id ?? idx}
                                      className="flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-muted/20 px-2 py-2"
                                    >
                                      <span className="min-w-0 flex-1 font-medium leading-snug">
                                        {r.title ?? 'Job'} · {r.company ?? ''}
                                      </span>
                                      {r.error && (
                                        <span className="text-xs text-destructive">{r.error}</span>
                                      )}
                                      {r.fit && (
                                        <>
                                          <span
                                            className={cn(
                                              'tabular-nums text-sm',
                                              strong && 'font-semibold text-emerald-600 dark:text-emerald-400'
                                            )}
                                          >
                                            {r.fit.score}%
                                          </span>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs"
                                            aria-label={`Why this fit score for ${r.title ?? 'job'} at ${r.company ?? ''}`}
                                            onClick={() =>
                                              openExplain(r.fit!, r.title ?? '', r.company ?? '', listing)
                                            }
                                          >
                                            Why
                                          </Button>
                                          {strong && listing && (
                                            <>
                                              <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => saveListing(listing)}
                                              >
                                                Save &amp; track
                                              </Button>
                                              {onStartTailorResume && listing && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 text-xs"
                                                  onClick={() => void onStartTailorResume(listing)}
                                                >
                                                  Tailor resume
                                                </Button>
                                              )}
                                            </>
                                          )}
                                        </>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </li>
                      )
                    })}
                </ul>
              </div>
            )}

            {sessionId && iterations.length >= 2 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Compare iterations
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                  >
                    <option value="">Iteration A</option>
                    {iterations.map((it) => (
                      <option key={it.id} value={it.id}>
                        #{it.iteration_index}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                  >
                    <option value="">Iteration B</option>
                    {iterations.map((it) => (
                      <option key={it.id} value={it.id}>
                        #{it.iteration_index}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={runCompare}>
                    Compare
                  </Button>
                </div>
                {compareResult && (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {(['a', 'b'] as const).map((k) => {
                      const it = compareResult[k]
                      const sp = it.search_params ?? {}
                      return (
                        <div key={k} className="rounded-md border border-border p-3">
                          <p className="font-medium">Iteration {it.iteration_index}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            q={String(sp.q ?? '')} · loc={String(sp.location ?? '')} · remote=
                            {String(sp.remote)} · p{String(sp.page ?? 1)}
                          </p>
                          <p className="mt-2 tabular-nums">
                            Best fit score: {bestScoreFromEvals(it.evaluations) ?? '—'}%
                          </p>
                          <p>Strong matches: {strongCountFromEvals(it.evaluations)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {explainFit && (
        <JobFitExplainModal
          open={explainOpen}
          onOpenChange={setExplainOpen}
          jobTitle={explainTitle}
          jobCompany={explainCompany}
          fit={explainFit}
          onOpenDataTab={onOpenDataTab}
          onTailorToJob={
            explainListing && onStartTailorResume
              ? () => {
                  setExplainOpen(false)
                  void onStartTailorResume(explainListing)
                }
              : undefined
          }
        />
      )}
    </>
  )
}
