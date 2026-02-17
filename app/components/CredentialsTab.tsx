'use client'

import { useState, useEffect } from 'react'

interface Credential {
  id: string
  platform: string
  email: string
  created_at: string
}

const PLATFORMS = ['LinkedIn', 'Indeed', 'Glassdoor', 'Dice', 'Wellfound']

export default function CredentialsTab() {
  const [creds, setCreds] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchCredentials()
  }, [])

  async function fetchCredentials() {
    setLoading(true)
    try {
      const res = await fetch('/api/platform-credentials', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setCreds(data.credentials || [])
    } catch (e) {
      console.error('Failed to load credentials:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Encrypt password server-side
      const encRes = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaintext: password }),
        credentials: 'include',
      })
      const encData = await encRes.json()
      if (!encData.success) {
        setError(encData.error || 'Encryption failed')
        setSaving(false)
        return
      }

      const res = await fetch('/api/platform-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platform.toLowerCase(),
          email,
          encrypted_password: encData.encrypted,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(`${platform} credential saved.`)
        setEmail('')
        setPassword('')
        fetchCredentials()
      } else {
        setError(data.error || 'Failed to save credential')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/platform-credentials?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setCreds((prev) => prev.filter((c) => c.id !== id))
      }
    } catch (e) {
      console.error('Delete failed:', e)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="creds-view">
      <div className="creds-header">
        <h1 className="creds-title">Platform Credentials</h1>
        <p className="creds-subtitle">
          Add login credentials for job platforms. Passwords are encrypted before storage — the
          agent decrypts them at runtime only.
        </p>
      </div>

      <div className="creds-form panel">
        <div className="creds-form-row">
          <div className="field-group">
            <label>Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group" style={{ flex: 1 }}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="field-group" style={{ flex: 1 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="button"
            className="primary-button creds-add-btn"
            onClick={handleAdd}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}
      </div>

      <div className="creds-list">
        {loading ? (
          <p className="loading-message">Loading credentials...</p>
        ) : creds.length === 0 ? (
          <p className="creds-empty">No credentials saved yet. Add one above to get started.</p>
        ) : (
          <table className="creds-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Email</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id}>
                  <td className="creds-platform">{c.platform}</td>
                  <td>{c.email}</td>
                  <td className="creds-date">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button small creds-delete"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                    >
                      {deleting === c.id ? '...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
