'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MasterResume {
  identity: {
    name: string
    email: string
    location: string
    links: { label: string; url: string }[]
  }
  summary: string
  experience: Array<{
    title: string
    company: string
    dates: string
    bullets: string[]
  }>
  skills: string[]
}

const STORAGE_KEY_MASTER = 'eOS_masterResume'

function parsedToMaster(parsed: any): MasterResume {
  return {
    identity: {
      name: parsed?.identity?.name || '',
      email: parsed?.identity?.email || '',
      location: parsed?.identity?.location || '',
      links: (() => {
        const raw = parsed?.identity?.links
        if (!Array.isArray(raw)) return []
        return raw.map((item: unknown) => {
          if (item && typeof item === 'object' && item !== null && 'url' in item) {
            const o = item as { label?: string; url?: string }
            return { label: typeof o.label === 'string' ? o.label : '', url: typeof o.url === 'string' ? o.url : '' }
          }
          return { label: '', url: typeof item === 'string' ? item : '' }
        })
      })(),
    },
    summary: parsed?.summary || '',
    experience: Array.isArray(parsed?.experience) ? parsed.experience : [],
    skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
  }
}

function escapeHtml(text: string | null | undefined): string {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

export default function ResumeTab() {
  const [masterResume, setMasterResume] = useState<MasterResume | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadError, setUploadError] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadMasterResume()
  }, [])

  async function loadMasterResume() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const res = await fetch('/api/resume', { credentials: 'include' })
        const data = await res.json()
        if (data.success && data.current?.parsed_data) {
          setMasterResume(parsedToMaster(data.current.parsed_data))
          return
        }
      }
      const stored = localStorage.getItem(STORAGE_KEY_MASTER)
      if (stored) setMasterResume(JSON.parse(stored))
    } catch (e) {
      console.error('Failed to load master resume:', e)
      const stored = localStorage.getItem(STORAGE_KEY_MASTER)
      if (stored) setMasterResume(JSON.parse(stored))
    }
  }

  function saveMasterResume(resume: MasterResume) {
    try {
      localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(resume))
      setMasterResume(resume)
    } catch (e) {
      console.error('Failed to save master resume:', e)
    }
  }

  async function uploadResumeFile(file: File) {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploadStatus('Parsing resume… this can take a few seconds.')
    setUploadError(false)

    try {
      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse resume.')
      }

      const parsed = data.parsed || {}
      const resume = parsedToMaster(parsed)

      const saveRes = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed,
          rawText: data.rawText || '',
          fileName: data.fileName || file.name,
        }),
        credentials: 'include',
      })
      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to save to cloud')
      }

      setMasterResume(resume)
      saveMasterResume(resume)
      setUploadStatus('Parsed successfully. This is now your master resume.')
    } catch (err: any) {
      console.error('Upload/parse error', err)
      setUploadStatus(err.message || 'Failed to parse resume.')
      setUploadError(true)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      uploadResumeFile(file)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      uploadResumeFile(file)
    }
  }

  const hasData =
    masterResume &&
    (masterResume.identity?.name ||
      masterResume.summary ||
      (masterResume.experience && masterResume.experience.length) ||
      (masterResume.skills && masterResume.skills.length))

  return (
    <div className="tab-content active">
      <section className="panel panel-input">
        <h2>Resume Lab (zero extra work)</h2>
        <p className="panel-subtitle">
          Upload your existing PDF/DOCX resume. eOS parses it into structured data and keeps it as your private master.
        </p>

        <div
          role="button"
          tabIndex={0}
          className={`resume-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOver(false)
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
        >
          <input
            ref={fileInputRef}
            id="resume-file-input"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="resume-file-input-hidden"
            aria-hidden
          />
          <div className="resume-dropzone-inner">
            <p className="dropzone-title">Drop your resume here</p>
            <p className="dropzone-subtitle">or click to browse a PDF/DOCX file</p>
            <p className="dropzone-note">We'll parse it into a private JSON profile. No re-typing, no CRUD.</p>
          </div>
        </div>

        {uploadStatus && (
          <div className={`resume-upload-status ${uploadError ? 'error' : ''}`}>{uploadStatus}</div>
        )}
      </section>

      <section className="panel resume-preview-panel">
        <h2>Parsed Resume Preview</h2>
        <p className="panel-subtitle">
          Read-only view of what the parser understood. This is what future "versions" and auto-apply flows will use.
        </p>

        <div className={`parsed-resume-preview ${!hasData ? 'empty' : ''}`}>
          {!hasData ? (
            <p className="empty-state-text">
              No resume parsed yet. Upload a resume on the left to see your structured profile here.
            </p>
          ) : (
            <>
              <div className="parsed-header">
                <div className="parsed-header-name">
                  {masterResume.identity?.name || 'Your name'}
                </div>
                <div className="parsed-header-meta">
                  {masterResume.identity?.email || ''}
                  {masterResume.identity?.location
                    ? `${masterResume.identity?.email ? ' • ' : ''}${masterResume.identity.location}`
                    : ''}
                  {masterResume.identity?.links && masterResume.identity.links.length
                    ? `${masterResume.identity?.email || masterResume.identity?.location ? ' • ' : ''}${masterResume.identity.links
                        .map((l) => {
                          const url = typeof l === 'string' ? l : l.url
                          const text = (typeof l === 'string' ? l : (l.label || l.url))
                          return url ? `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(text)}</a>` : ''
                        })
                        .filter(Boolean)
                        .join(' • ')}`
                    : ''}
                </div>
              </div>

              {masterResume.summary && (
                <div>
                  <div className="parsed-section-title">Summary</div>
                  <div
                    className="parsed-summary"
                    dangerouslySetInnerHTML={{
                      __html: escapeHtml(masterResume.summary).replace(/\n/g, '<br>'),
                    }}
                  />
                </div>
              )}

              {masterResume.experience && masterResume.experience.length > 0 && (
                <div>
                  <div className="parsed-section-title">Experience</div>
                  {masterResume.experience.map((exp, i) => {
                    if (!exp.title && !exp.company) return null
                    return (
                      <div key={i} className="parsed-experience-item">
                        <div className="parsed-experience-header">
                          <div>
                            <span className="parsed-experience-title">{escapeHtml(exp.title || '')}</span>
                            {exp.company && (
                              <span className="parsed-experience-company"> {escapeHtml(exp.company)}</span>
                            )}
                          </div>
                          {exp.dates && (
                            <span className="parsed-experience-dates">{escapeHtml(exp.dates)}</span>
                          )}
                        </div>
                        {exp.bullets && exp.bullets.length > 0 && (
                          <ul>
                            {exp.bullets.map((bullet, j) => {
                              const text = typeof bullet === 'string' ? bullet : (bullet as { text?: string })?.text ?? ''
                              return text.trim() ? <li key={j}>{escapeHtml(text)}</li> : null
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {masterResume.skills && masterResume.skills.length > 0 && (
                <div>
                  <div className="parsed-section-title">Skills</div>
                  <div className="parsed-skills">{escapeHtml(masterResume.skills.join(', '))}</div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
