'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'earnOS_jobs_params'
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

/** Discovery result from JSearch (no id/user_id/created_at/updated_at/status). */
export interface DiscoverListing {
  external_id: string | null
  source: string
  title: string
  company: string
  url: string | null
  location: string | null
  remote: boolean
  description: string | null
  snippet: string | null
  posted_at: string | null
  raw: Record<string, unknown>
}

export default function JobsTab() {
  const [q, setQ] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(true)
  const [listings, setListings] = useState<DiscoverListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)

  const search = useCallback(
    async (query: string, loc: string, remote: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('q', query.trim() || DEFAULT_QUERY)
        if (loc.trim()) params.set('location', loc.trim())
        if (remote) params.set('remote', 'true')
        const res = await fetch(`/api/jobs/discover?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()

        if (data.usage) setUsage({ used: data.usage.used, limit: data.usage.limit })

        if (!res.ok) {
          const msg = data.error || 'Failed to load listings'
          throw new Error(msg)
        }
        setListings(data.listings ?? [])
        setHasSearched(true)
        saveParams({ q: query.trim() || '', location: loc.trim(), remoteOnly: remote })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
        setListings([])
        setHasSearched(true)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // First load: show listings (from cache or one API call) using stored or default params
  useEffect(() => {
    const stored = loadParams()
    setQ(stored.q)
    setLocation(stored.location)
    setRemoteOnly(stored.remoteOnly)
    search(stored.q || DEFAULT_QUERY, stored.location, stored.remoteOnly)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  function handleSearch() {
    search(q, location, remoteOnly)
  }

  const usageText = usage
    ? `${usage.used}/${usage.limit} requests this month · ${Math.max(0, usage.limit - usage.used)} left`
    : null

  return (
    <div className="jobs-tab">
      <section className="panel jobs-filters-panel">
        <h2 className="jobs-section-title">Filter listings</h2>
        <p className="jobs-section-hint">Refine what you see below.</p>
        <div className="jobs-filters">
          <input
            type="text"
            placeholder="Keywords (e.g. AI, developer)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="jobs-filter-input jobs-discover-q"
            aria-label="Keywords"
          />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="jobs-filter-input jobs-filter-location"
            aria-label="Location"
          />
          <label className="jobs-filter-remote">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              aria-label="Remote only"
            />
            Remote only
          </label>
          <button type="button" className="primary-button" disabled={loading} onClick={handleSearch}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {usageText && <p className="jobs-usage">{usageText}</p>}
      </section>

      <section className="panel jobs-list-panel">
        <h2 className="jobs-section-title">Job board</h2>
        <p className="jobs-section-hint">
          {hasSearched
            ? 'Open a link to apply on the source site. Results are cached 24h to save API usage.'
            : 'Enter keywords and click Search to see listings (one request per search, cached 24h).'}
        </p>
        {error && <p className="jobs-error">{error}</p>}
        {usage && usage.used >= usage.limit && (
          <p className="jobs-error">Monthly limit reached. Upgrade for more requests.</p>
        )}
        {loading ? (
          <p className="jobs-loading">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="jobs-empty">
            {hasSearched ? 'No listings. Try different filters or search.' : 'Enter keywords and click Search to see listings.'}
          </p>
        ) : (
          <ul className="jobs-list">
            {listings.map((job, idx) => (
              <li key={job.external_id ?? `job-${idx}`} className="jobs-card">
                <div className="jobs-card-main">
                  <h4 className="jobs-card-title">{job.title || 'Untitled'}</h4>
                  <p className="jobs-card-company">{job.company}</p>
                  <div className="jobs-card-meta">
                    {job.location && <span>{job.location}</span>}
                    {job.remote && <span className="jobs-remote-badge">Remote</span>}
                  </div>
                  {job.snippet && <p className="jobs-card-snippet">{job.snippet}</p>}
                </div>
                <div className="jobs-card-actions">
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="secondary-button small"
                    >
                      Open
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
