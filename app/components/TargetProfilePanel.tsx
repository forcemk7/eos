'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JobSearchAnchor, TargetRoleRow, TargetSectorRow } from '@/lib/jobs/jobSearchAnchor'
import { normalizeTargetKey } from '@/lib/jobs/targetProfileTypes'

interface JobQualificationsRow {
  search_query: string
  location: string | null
  remote: boolean
  generated_at: string
}

interface QualificationsPayload {
  success: boolean
  qualifications: JobQualificationsRow | null
  stale?: boolean
  target_roles?: TargetRoleRow[]
  target_sectors?: TargetSectorRow[]
  dismissed_role_keys?: string[]
  dismissed_sector_keys?: string[]
  pinned_role_key?: string | null
  anchor?: JobSearchAnchor | null
  error?: string
}

type PatchAction =
  | 'pin'
  | 'unpin'
  | 'dismiss_role'
  | 'dismiss_sector'
  | 'undismiss_role'
  | 'undismiss_sector'

export default function TargetProfilePanel({
  hasData,
  refreshKey,
}: {
  hasData: boolean
  refreshKey: number
}) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [qualifications, setQualifications] = useState<JobQualificationsRow | null>(null)
  const [roles, setRoles] = useState<TargetRoleRow[]>([])
  const [sectors, setSectors] = useState<TargetSectorRow[]>([])
  const [dismissedRoleKeys, setDismissedRoleKeys] = useState<string[]>([])
  const [dismissedSectorKeys, setDismissedSectorKeys] = useState<string[]>([])
  const [pinnedRoleKey, setPinnedRoleKey] = useState<string | null>(null)
  const [patching, setPatching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs/qualifications', { credentials: 'include' })
      const data = (await res.json()) as QualificationsPayload
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not load target profile.')
        setQualifications(null)
        setRoles([])
        setSectors([])
        return
      }
      setStale(Boolean(data.stale))
      setQualifications(data.qualifications)
      setRoles(data.target_roles ?? [])
      setSectors(data.target_sectors ?? [])
      setDismissedRoleKeys(data.dismissed_role_keys ?? [])
      setDismissedSectorKeys(data.dismissed_sector_keys ?? [])
      setPinnedRoleKey(
        typeof data.pinned_role_key === 'string' && data.pinned_role_key ? data.pinned_role_key : null
      )
    } catch {
      setError('Could not load target profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function patch(action: PatchAction, key?: string) {
    setPatching(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs/qualifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, key }),
      })
      const data = (await res.json()) as QualificationsPayload
      if (!res.ok || !data.success) {
        setError(data.error || 'Update failed.')
        return
      }
      setStale(Boolean(data.stale))
      setQualifications(data.qualifications)
      setRoles(data.target_roles ?? [])
      setSectors(data.target_sectors ?? [])
      setDismissedRoleKeys(data.dismissed_role_keys ?? [])
      setDismissedSectorKeys(data.dismissed_sector_keys ?? [])
      setPinnedRoleKey(
        typeof data.pinned_role_key === 'string' && data.pinned_role_key ? data.pinned_role_key : null
      )
    } catch {
      setError('Update failed.')
    } finally {
      setPatching(false)
    }
  }

  async function regenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs/qualifications', { method: 'POST', credentials: 'include' })
      const data = (await res.json()) as QualificationsPayload
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not generate targets.')
        return
      }
      setStale(Boolean(data.stale))
      setQualifications(data.qualifications)
      setRoles(data.target_roles ?? [])
      setSectors(data.target_sectors ?? [])
      setDismissedRoleKeys(data.dismissed_role_keys ?? [])
      setDismissedSectorKeys(data.dismissed_sector_keys ?? [])
      setPinnedRoleKey(
        typeof data.pinned_role_key === 'string' && data.pinned_role_key ? data.pinned_role_key : null
      )
    } catch {
      setError('Could not generate targets.')
    } finally {
      setGenerating(false)
    }
  }

  const dismissedRoleSet = new Set(dismissedRoleKeys.map(normalizeTargetKey))
  const dismissedSectorSet = new Set(dismissedSectorKeys.map(normalizeTargetKey))

  return (
    <section className="target-profile panel mb-6" aria-labelledby="target-profile-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="target-profile-heading" className="app-section-title m-0 text-base">
            Target profile
          </h2>
          <p className="panel-subtitle m-0 mt-1 text-sm text-muted-foreground">
            Roles and sectors to anchor job search. Generated from your data; pin one role as the default search
            query.
          </p>
        </div>
        <button
          type="button"
          className="primary-button shrink-0"
          onClick={() => void regenerate()}
          disabled={!hasData || generating || loading || patching}
        >
          {generating ? 'Generating…' : qualifications ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {!hasData && (
        <p className="m-0 rounded-lg border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
          Add profile data below, then generate recommended roles and sectors.
        </p>
      )}

      {hasData && loading && (
        <p className="m-0 text-sm text-muted-foreground">Loading recommendations…</p>
      )}

      {error && (
        <p className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {hasData && !loading && stale && (
        <p className="m-0 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          Your profile changed since these targets were generated. Regenerate to refresh recommendations.
        </p>
      )}

      {hasData && !loading && qualifications && (
        <p className="m-0 text-xs text-muted-foreground">
          Default search: <span className="text-foreground/90">{qualifications.search_query}</span>
          {qualifications.remote ? ' · Remote-friendly' : ''}
          {qualifications.location ? ` · ${qualifications.location}` : ''}
        </p>
      )}

      {hasData && !loading && roles.length > 0 && (
        <ul className="target-profile-list m-0 list-none space-y-3 p-0">
          {roles.map((r) => {
            const rk = normalizeTargetKey(r.title)
            const isPinned = pinnedRoleKey === rk
            return (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card/40 px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{r.title}</span>
                      {r.stretch ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Stretch
                        </span>
                      ) : null}
                      {isPinned ? (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 m-0 leading-relaxed text-muted-foreground">{r.rationale}</p>
                    <p className="mt-1 m-0 text-xs text-muted-foreground">
                      Search terms: <span className="text-foreground/80">{r.search_terms}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {isPinned ? (
                      <button
                        type="button"
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted/50"
                        disabled={patching}
                        onClick={() => void patch('unpin')}
                      >
                        Unpin
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                        disabled={patching}
                        onClick={() => void patch('pin', r.title)}
                      >
                        Pin
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                      disabled={patching}
                      onClick={() => void patch('dismiss_role', r.title)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hasData && !loading && dismissedRoleSet.size > 0 && (
        <div className="space-y-1">
          <p className="m-0 text-xs font-medium text-muted-foreground">Dismissed roles (restore)</p>
          <ul className="m-0 flex flex-wrap gap-2 p-0 list-none">
            {dismissedRoleKeys.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  disabled={patching}
                  onClick={() => void patch('undismiss_role', k)}
                >
                  {k}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasData && !loading && sectors.length > 0 && (
        <div className="space-y-2">
          <h3 className="m-0 text-sm font-medium text-foreground">Sectors</h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {sectors.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-border/80 bg-card/30 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <p className="mt-1 m-0 text-muted-foreground leading-relaxed">{s.rationale}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                    disabled={patching}
                    onClick={() => void patch('dismiss_sector', s.name)}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasData && !loading && dismissedSectorSet.size > 0 && (
        <div className="space-y-1">
          <p className="m-0 text-xs font-medium text-muted-foreground">Dismissed sectors (restore)</p>
          <ul className="m-0 flex flex-wrap gap-2 p-0 list-none">
            {dismissedSectorKeys.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  disabled={patching}
                  onClick={() => void patch('undismiss_sector', k)}
                >
                  {k}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasData && !loading && !qualifications && !error && (
        <p className="m-0 text-sm text-muted-foreground">
          No targets yet. Click Generate to create role and sector recommendations from your profile.
        </p>
      )}
    </section>
  )
}
