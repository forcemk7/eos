'use client'

import { useState, useEffect, useCallback } from 'react'

export interface JobListing {
  id: string
  user_id: string
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
  status: string
  created_at: string
  updated_at: string
}

const STATUS_SAVED = 'saved'
const STATUS_DISMISSED = 'dismissed'

export default function JobsTab() {
  const [listings, setListings] = useState<JobListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>(STATUS_SAVED)
  const [filterQ, setFilterQ] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterRemote, setFilterRemote] = useState(false)
  const [addMode, setAddMode] = useState<'manual' | 'paste'>('manual')
  const [addUrl, setAddUrl] = useState('')
  const [addPaste, setAddPaste] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addCompany, setAddCompany] = useState('')
  const [addLocation, setAddLocation] = useState('')
  const [addRemote, setAddRemote] = useState(false)
  const [extractLoading, setExtractLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [extracted, setExtracted] = useState<Partial<JobListing> | null>(null)

  const loadListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterQ) params.set('q', filterQ)
      if (filterLocation) params.set('location', filterLocation)
      if (filterRemote) params.set('remote', 'true')
      const res = await fetch(`/api/jobs?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs')
      setListings(data.listings ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterQ, filterLocation, filterRemote])

  useEffect(() => {
    loadListings()
  }, [loadListings])

  async function handleExtract() {
    if (!addPaste.trim()) return
    setExtractLoading(true)
    setError(null)
    setExtracted(null)
    try {
      const res = await fetch('/api/jobs/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: addPaste.trim(), url: addUrl.trim() || undefined }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setExtracted(data.listing ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setExtractLoading(false)
    }
  }

  async function handleSaveListing(payload: {
    title: string
    company: string
    url?: string | null
    location?: string | null
    remote?: boolean
    description?: string | null
    snippet?: string | null
    posted_at?: string | null
  }) {
    setSaveLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, source: extracted ? 'manual' : 'manual' }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setAddUrl('')
      setAddPaste('')
      setAddTitle('')
      setAddCompany('')
      setAddLocation('')
      setAddRemote(false)
      setExtracted(null)
      await loadListings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleDismiss(id: string) {
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: STATUS_DISMISSED }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      await loadListings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this listing?')) return
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      await loadListings()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const toSave =
    addMode === 'paste' && extracted
      ? {
          title: extracted.title || addTitle.trim() || 'Untitled',
          company: extracted.company || addCompany.trim() || 'Unknown',
          url: (extracted.url ?? addUrl.trim()) || null,
          location: (extracted.location ?? addLocation.trim()) || null,
          remote: extracted.remote ?? addRemote,
          description: extracted.description ?? null,
          snippet: extracted.snippet ?? null,
          posted_at: extracted.posted_at ?? null,
        }
      : {
          title: addTitle.trim() || 'Untitled',
          company: addCompany.trim() || 'Unknown',
          url: addUrl.trim() || null,
          location: addLocation.trim() || null,
          remote: addRemote,
          description: null,
          snippet: null,
          posted_at: null,
        }

  return (
    <div className="jobs-tab">
      <section className="panel jobs-filters-panel">
        <h2 className="jobs-section-title">Job listings</h2>
        <p className="jobs-section-hint">
          Add jobs by URL and paste (extract with AI) or enter manually. Filter and curate your list.
        </p>
        <div className="jobs-filters">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="jobs-filter-select"
            aria-label="Status"
          >
            <option value={STATUS_SAVED}>Saved</option>
            <option value={STATUS_DISMISSED}>Dismissed</option>
          </select>
          <input
            type="text"
            placeholder="Search title, company…"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            className="jobs-filter-input"
            aria-label="Search"
          />
          <input
            type="text"
            placeholder="Location"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="jobs-filter-input jobs-filter-location"
            aria-label="Location"
          />
          <label className="jobs-filter-remote">
            <input
              type="checkbox"
              checked={filterRemote}
              onChange={(e) => setFilterRemote(e.target.checked)}
              aria-label="Remote only"
            />
            Remote only
          </label>
        </div>
      </section>

      <section className="panel jobs-add-panel">
        <h3 className="jobs-add-title">Add job</h3>
        <div className="jobs-add-tabs">
          <button
            type="button"
            className={`jobs-add-tab ${addMode === 'manual' ? 'active' : ''}`}
            onClick={() => setAddMode('manual')}
          >
            Manual
          </button>
          <button
            type="button"
            className={`jobs-add-tab ${addMode === 'paste' ? 'active' : ''}`}
            onClick={() => setAddMode('paste')}
          >
            Paste &amp; extract
          </button>
        </div>
        {addMode === 'manual' ? (
          <div className="jobs-add-form">
            <input
              type="text"
              placeholder="Job title"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className="jobs-add-input"
            />
            <input
              type="text"
              placeholder="Company"
              value={addCompany}
              onChange={(e) => setAddCompany(e.target.value)}
              className="jobs-add-input"
            />
            <input
              type="url"
              placeholder="URL"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              className="jobs-add-input"
            />
            <input
              type="text"
              placeholder="Location"
              value={addLocation}
              onChange={(e) => setAddLocation(e.target.value)}
              className="jobs-add-input"
            />
            <label className="jobs-add-remote">
              <input type="checkbox" checked={addRemote} onChange={(e) => setAddRemote(e.target.checked)} />
              Remote
            </label>
            <button
              type="button"
              className="primary-button jobs-add-save"
              disabled={saveLoading || (!addTitle.trim() && !addCompany.trim())}
              onClick={() => handleSaveListing(toSave)}
            >
              {saveLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="jobs-add-form">
            <input
              type="url"
              placeholder="URL (optional)"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              className="jobs-add-input"
            />
            <textarea
              placeholder="Paste job description here…"
              value={addPaste}
              onChange={(e) => setAddPaste(e.target.value)}
              className="jobs-add-textarea"
              rows={4}
            />
            <div className="jobs-add-paste-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={extractLoading || !addPaste.trim()}
                onClick={handleExtract}
              >
                {extractLoading ? 'Extracting…' : 'Extract with AI'}
              </button>
              {extracted && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={saveLoading}
                  onClick={() => handleSaveListing(toSave)}
                >
                  {saveLoading ? 'Saving…' : 'Save listing'}
                </button>
              )}
            </div>
            {extracted && (
              <div className="jobs-extracted-preview">
                <strong>{extracted.title || 'Untitled'}</strong> at {extracted.company || '—'}
                {extracted.location && <span> · {extracted.location}</span>}
                {extracted.remote && <span className="jobs-remote-badge">Remote</span>}
                {extracted.snippet && <p className="jobs-snippet">{extracted.snippet}</p>}
              </div>
            )}
          </div>
        )}
        {error && <p className="jobs-error">{error}</p>}
      </section>

      <section className="panel jobs-list-panel">
        <h3 className="jobs-list-title">Your listings</h3>
        {loading ? (
          <p className="jobs-loading">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="jobs-empty">No listings yet. Add one above.</p>
        ) : (
          <ul className="jobs-list">
            {listings.map((job) => (
              <li key={job.id} className="jobs-card">
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
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="secondary-button small">
                      Open
                    </a>
                  )}
                  {job.status === STATUS_SAVED && (
                    <button
                      type="button"
                      className="secondary-button small"
                      onClick={() => handleDismiss(job.id)}
                    >
                      Dismiss
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button small jobs-delete"
                    onClick={() => handleDelete(job.id)}
                    aria-label="Remove"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
