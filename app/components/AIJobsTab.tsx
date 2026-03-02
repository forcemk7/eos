'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface JobQualifications {
  search_query: string
  location: string | null
  remote: boolean
  generated_at: string
}

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

const DEFAULT_QUERY = 'jobs'

export default function AIJobsTab() {
  const [aiListings, setAiListings] = useState<DiscoverListing[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiQualifications, setAiQualifications] = useState<JobQualifications | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)

  const aiQualRef = useRef<JobQualifications | null>(null)

  const fetchListings = useCallback(async (qual: JobQualifications) => {
    setAiLoading(true)
    setAiError(null)
    try {
      const params = new URLSearchParams()
      params.set('q', qual.search_query.trim() || DEFAULT_QUERY)
      if (qual.remote) params.set('remote', 'true')
      const res = await fetch(`/api/jobs/discover?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load listings')
      setAiListings(data.listings ?? [])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to load')
      setAiListings([])
    } finally {
      setAiLoading(false)
    }
  }, [])

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
        await fetchListings(qual)
      }
    }
    run()
    return () => { cancelled = true }
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
        setAiLoading(true)
        try {
          const params = new URLSearchParams()
          params.set('q', data.qualifications.search_query.trim() || DEFAULT_QUERY)
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

  return (
    <div className="jobs-tab">
      <section className="panel jobs-list-panel jobs-ai-board">
        <h2 className="jobs-section-title">AI job board</h2>
        <p className="jobs-section-hint">
          Listings based on your Data; qualified and adjacent roles. Keywords are generated from your profile.
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
