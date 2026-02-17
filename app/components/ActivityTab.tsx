'use client'

import { useState, useEffect } from 'react'

interface ActivityEntry {
  id: string
  run_id: string
  action: string
  platform: string
  details: Record<string, any>
  status: string
  created_at: string
}

export default function ActivityTab() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetchActivity()
  }, [])

  async function fetchActivity() {
    setLoading(true)
    try {
      const res = await fetch('/api/activity-log?limit=100', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setEntries(data.entries || [])
    } catch (e) {
      console.error('Failed to load activity:', e)
    } finally {
      setLoading(false)
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case 'success':
        return '#22c55e'
      case 'error':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      default:
        return 'var(--text-muted)'
    }
  }

  if (loading) {
    return (
      <div className="activity-view">
        <p className="loading-message">Loading activity log...</p>
      </div>
    )
  }

  // Group entries by run_id
  const runs = new Map<string, ActivityEntry[]>()
  for (const entry of entries) {
    const existing = runs.get(entry.run_id) || []
    existing.push(entry)
    runs.set(entry.run_id, existing)
  }

  return (
    <div className="activity-view">
      <div className="activity-header">
        <h1 className="activity-title">Activity Log</h1>
        <p className="activity-subtitle">
          History of agent runs and actions. Click a row to see details.
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={fetchActivity}
        >
          Refresh
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="activity-empty panel">
          <p>No agent activity yet. Run the agent to see logs here.</p>
          <code className="activity-hint">
            cd agent && python main.py --user-id YOUR_USER_ID
          </code>
        </div>
      ) : (
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Run</th>
                <th>Platform</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className={`activity-row ${expanded === entry.id ? 'expanded' : ''}`}
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="activity-time">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="activity-run">{entry.run_id}</td>
                    <td className="activity-platform">{entry.platform || '—'}</td>
                    <td className="activity-action">{entry.action}</td>
                    <td>
                      <span
                        className="activity-status-dot"
                        style={{ color: statusColor(entry.status) }}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                  {expanded === entry.id && entry.details && Object.keys(entry.details).length > 0 && (
                    <tr key={`${entry.id}-detail`} className="activity-detail-row">
                      <td colSpan={5}>
                        <pre className="activity-detail-pre">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
