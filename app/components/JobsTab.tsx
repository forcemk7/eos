'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

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

interface JobQualifications {
  search_query: string
  location: string | null
  remote: boolean
  generated_at: string
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

  // AI job board state
  const [aiListings, setAiListings] = useState<DiscoverListing[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiQualifications, setAiQualifications] = useState<JobQualifications | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)

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

  const aiQualRef = useRef<JobQualifications | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const getRes = await fetch('/api/jobs/qualifications', { credentials: 'include' })
      const getData = await getRes.json()
      if (cancelled) return
      if (getData.success && getData.qualifications) {
        setAiQualifications(getData.qualifications)
        aiQualRef.current = getData.qualifications
      } else {
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
          }
        } finally {
          if (!cancelled) setAiGenerating(false)
        }
      }
      const qual = aiQualRef.current
      if (qual && !cancelled) {
        setAiLoading(true)
        try {
          const params = new URLSearchParams()
          params.set('q', qual.search_query.trim() || DEFAULT_QUERY)
          if (qual.location?.trim()) params.set('location', qual.location.trim())
          if (qual.remote) params.set('remote', 'true')
          const res = await fetch(`/api/jobs/discover?${params.toString()}`, { credentials: 'include' })
          const data = await res.json()
          if (cancelled) return
          if (!res.ok) throw new Error(data.error || 'Failed to load listings')
          setAiListings(data.listings ?? [])
        } catch (e) {
          if (!cancelled) setAiError(e instanceof Error ? e.message : 'Failed to load')
          setAiListings([])
        } finally {
          if (!cancelled) setAiLoading(false)
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

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
        setAiLoading(true)
        try {
          const params = new URLSearchParams()
          params.set('q', data.qualifications.search_query.trim() || DEFAULT_QUERY)
          if (data.qualifications.location?.trim()) params.set('location', data.qualifications.location.trim())
          if (data.qualifications.remote) params.set('remote', 'true')
          const discoverRes = await fetch(`/api/jobs/discover?${params.toString()}`, { credentials: 'include' })
          const discoverData = await discoverRes.json()
          if (!discoverRes.ok) throw new Error(discoverData.error || 'Failed to load')
          setAiListings(discoverData.listings ?? [])
        } catch (e) {
          setAiError(e instanceof Error ? e.message : 'Failed to load')
          setAiListings([])
        } finally {
          setAiLoading(false)
        }
      }
    } finally {
      setAiGenerating(false)
    }
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

      <section className="panel jobs-list-panel jobs-ai-board">
        <h2 className="jobs-section-title">AI job board</h2>
        <p className="jobs-section-hint">
          Listings based on your Data; qualified and adjacent roles.
        </p>
        {aiError && <p className="jobs-error">{aiError}</p>}
        {!aiQualifications && !aiGenerating && !aiError && (
          <p className="jobs-loading">Loading…</p>
        )}
        {aiGenerating && <p className="jobs-loading">Generating qualifications…</p>}
        {aiQualifications && !aiGenerating && (
          <div className="jobs-ai-meta">
            <span className="jobs-ai-query">
              Search: {aiQualifications.search_query}
              {aiQualifications.location ? ` · ${aiQualifications.location}` : ''}
              {aiQualifications.remote ? ' · Remote' : ''}
            </span>
            <button
              type="button"
              className="secondary-button small"
              disabled={aiGenerating || aiLoading}
              onClick={handleRefreshQualifications}
            >
              Refresh qualifications
            </button>
          </div>
        )}
        {aiQualifications && !aiGenerating && aiLoading && (
          <p className="jobs-loading">Loading…</p>
        )}
        {aiQualifications && !aiGenerating && !aiLoading && aiListings.length === 0 && (
          <p className="jobs-empty">No listings. Try refreshing qualifications.</p>
        )}
        {aiQualifications && !aiGenerating && !aiLoading && aiListings.length > 0 && (
          <ul className="jobs-list">
            {aiListings.map((job, idx) => (
              <li key={job.external_id ?? `ai-job-${idx}`} className="jobs-card">
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
