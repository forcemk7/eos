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

  useEffect(() => {
    loadApplications()
    const interval = setInterval(loadApplications, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadApplications() {
    try {
      const res = await fetch('/api/applications')
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
            ⋯
          </button>
        </div>
        <div className="kanban-card-company">{app.company || 'Company'}</div>
        <div className="kanban-card-location">{app.location || ''}</div>
        <div className="kanban-card-date">Applied: {date}</div>
        {app.url && (
          <a href={app.url} target="_blank" rel="noopener noreferrer" className="kanban-card-link">
            View Job →
          </a>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tab-content active">
        <section className="panel">
          <p>Loading applications...</p>
        </section>
      </div>
    )
  }

  const grouped: Record<string, Application[]> = {}
  STATUSES.forEach((status) => {
    grouped[status] = applications.filter((app) => app.status === status)
  })

  return (
    <div className="tab-content active">
      <section className="panel">
        <h2>Job Application Tracker</h2>
        <p className="panel-subtitle">
          Track all your job applications. Drag cards between columns to update status.
        </p>
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
