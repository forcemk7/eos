'use client'

import { useState, useEffect, useRef } from 'react'

const STATUSES = ['applied', 'interview', 'offer', 'rejected']

interface Application {
  id: string
  title?: string
  company?: string
  location?: string
  url?: string
  applied_at: string
  status: string
}

export default function TrackerTab() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const draggedCardRef = useRef<HTMLElement | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadApplications()
  }, [])

  async function loadApplications() {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' })
      const data = await res.json()

      if (data.success) {
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newCompany.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim() || null,
          company: newCompany.trim(),
          url: newUrl.trim() || null,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setNewTitle('')
        setNewCompany('')
        setNewUrl('')
        loadApplications()
      }
    } catch (error) {
      console.error('Error adding application:', error)
    } finally {
      setAdding(false)
    }
  }

  function handleDragStart(e: React.DragEvent, app: Application) {
    draggedCardRef.current = e.currentTarget as HTMLElement
    e.currentTarget.classList.add('dragging')
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd(e: React.DragEvent) {
    e.currentTarget.classList.remove('dragging')
    document.querySelectorAll('.kanban-column-content').forEach((col) => {
      col.classList.remove('drag-over')
    })
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    if (e.currentTarget.classList.contains('kanban-column-content')) {
      e.currentTarget.classList.add('drag-over')
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.classList.contains('kanban-column-content')) {
      e.currentTarget.classList.remove('drag-over')
    }
  }

  async function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')

    if (!draggedCardRef.current) return

    const applicationId = draggedCardRef.current.dataset.id
    if (!applicationId) return

    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      })

      const data = await res.json()

      if (data.success) {
        loadApplications()
      } else {
        throw new Error(data.error || 'Failed to update status')
      }
    } catch (error: any) {
      console.error('Error updating application status:', error)
      alert('Failed to update application status: ' + error.message)
      loadApplications()
    }
  }

  function renderApplicationCard(app: Application) {
    const date = new Date(app.applied_at).toLocaleDateString()

    return (
      <div
        key={app.id}
        className="kanban-card"
        draggable
        data-id={app.id}
        onDragStart={(e) => handleDragStart(e, app)}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-card-header">
          <h4>{app.title || 'Job Title'}</h4>
          <button
            className="kanban-card-menu"
            onClick={() => {
              if (app.url) window.open(app.url, '_blank')
            }}
          >
            ...
          </button>
        </div>
        <div className="kanban-card-company">{app.company || 'Company'}</div>
        <div className="kanban-card-location">{app.location || ''}</div>
        <div className="kanban-card-date">Applied: {date}</div>
        {app.url && (
          <a href={app.url} target="_blank" rel="noopener noreferrer" className="kanban-card-link">
            View Job
          </a>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="loading-message">Loading applications...</p>
      </section>
    )
  }

  const grouped: Record<string, Application[]> = {}
  STATUSES.forEach((status) => {
    grouped[status] = applications.filter((app) => app.status === status)
  })

  return (
    <div className="tracker-view">
      <section className="panel">
        <h2>Application Tracker</h2>
        <p className="panel-subtitle">
          Log every application. Drag cards between columns to update status.
        </p>

        <form className="tracker-add-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Job title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Company *"
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            required
          />
          <input
            type="url"
            placeholder="Job URL (optional)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <button type="submit" className="primary-button" disabled={adding || !newCompany.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>

        <div className="kanban-board">
          {STATUSES.map((status) => {
            const apps = grouped[status]
            const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

            return (
              <div key={status} className="kanban-column" data-status={status}>
                <div className="kanban-column-header">
                  <h3>{statusLabel}</h3>
                  <span className="kanban-count">{apps.length}</span>
                </div>
                <div
                  className="kanban-column-content"
                  data-status={status}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                >
                  {apps.length === 0 ? (
                    <div className="kanban-empty">No applications</div>
                  ) : (
                    apps.map(renderApplicationCard)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
