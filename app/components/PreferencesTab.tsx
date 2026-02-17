'use client'

import { useState, useEffect } from 'react'

interface Preferences {
  titles: string[]
  keywords: string[]
  locations: string[]
  remote_only: boolean
  max_applications_per_run: number
}

export default function PreferencesTab() {
  const [prefs, setPrefs] = useState<Preferences>({
    titles: [],
    keywords: [],
    locations: [],
    remote_only: false,
    max_applications_per_run: 10,
  })
  const [titlesInput, setTitlesInput] = useState('')
  const [keywordsInput, setKeywordsInput] = useState('')
  const [locationsInput, setLocationsInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  async function fetchPreferences() {
    setLoading(true)
    try {
      const res = await fetch('/api/job-preferences', { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.preferences) {
        const p = data.preferences
        setPrefs(p)
        setTitlesInput((p.titles || []).join(', '))
        setKeywordsInput((p.keywords || []).join(', '))
        setLocationsInput((p.locations || []).join(', '))
      }
    } catch (e) {
      console.error('Failed to load preferences:', e)
    } finally {
      setLoading(false)
    }
  }

  function parseCommaList(val: string): string[] {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const body = {
        titles: parseCommaList(titlesInput),
        keywords: parseCommaList(keywordsInput),
        locations: parseCommaList(locationsInput),
        remote_only: prefs.remote_only,
        max_applications_per_run: prefs.max_applications_per_run,
      }
      const res = await fetch('/api/job-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setMessage('Preferences saved.')
        if (data.preferences) setPrefs(data.preferences)
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="prefs-view">
        <p className="loading-message">Loading preferences...</p>
      </div>
    )
  }

  return (
    <div className="prefs-view">
      <div className="prefs-header">
        <h1 className="prefs-title">Job Preferences</h1>
        <p className="prefs-subtitle">
          Configure what roles the agent should search for. These settings are used when running the
          auto-apply agent.
        </p>
      </div>

      <div className="prefs-form panel">
        <div className="field-group">
          <label>Job Titles (comma-separated)</label>
          <input
            type="text"
            value={titlesInput}
            onChange={(e) => setTitlesInput(e.target.value)}
            placeholder="e.g. Software Engineer, Full Stack Developer, Backend Engineer"
          />
        </div>

        <div className="field-group">
          <label>Keywords (comma-separated)</label>
          <input
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="e.g. React, TypeScript, Python, Node.js"
          />
        </div>

        <div className="field-group">
          <label>Locations (comma-separated)</label>
          <input
            type="text"
            value={locationsInput}
            onChange={(e) => setLocationsInput(e.target.value)}
            placeholder="e.g. Remote, New York, San Francisco, London"
          />
        </div>

        <div className="prefs-row">
          <label className="prefs-checkbox-label">
            <input
              type="checkbox"
              checked={prefs.remote_only}
              onChange={(e) => setPrefs({ ...prefs, remote_only: e.target.checked })}
            />
            <span>Remote only</span>
          </label>

          <div className="field-group prefs-max-field">
            <label>Max applications per run</label>
            <input
              type="number"
              min={1}
              max={50}
              value={prefs.max_applications_per_run}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  max_applications_per_run: Math.max(1, parseInt(e.target.value) || 10),
                })
              }
            />
          </div>
        </div>

        <div className="prefs-actions">
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          {message && (
            <span className={`prefs-message ${message.startsWith('Error') ? 'error' : ''}`}>
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
