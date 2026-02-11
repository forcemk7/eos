'use client'

import { useState, useEffect } from 'react'
import { exportResumeToPdf } from '@/lib/exportResumePdf'

export interface ResumeData {
  identity: {
    name: string
    email: string
    location: string
    links: string[]
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

function emptyResume(): ResumeData {
  return {
    identity: { name: '', email: '', location: '', links: [] },
    summary: '',
    experience: [],
    skills: [],
  }
}

function normalizeParsed(parsed: any): ResumeData {
  return {
    identity: {
      name: parsed?.identity?.name ?? '',
      email: parsed?.identity?.email ?? '',
      location: parsed?.identity?.location ?? '',
      links: Array.isArray(parsed?.identity?.links) ? parsed.identity.links : [],
    },
    summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
    experience: Array.isArray(parsed?.experience) ? parsed.experience : [],
    skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
  }
}

interface VersionItem {
  id: string
  created_at: string
  file_name?: string
}

interface ResumeEditorProps {
  initialData: ResumeData
  versions: VersionItem[]
  onSave: (data: ResumeData) => Promise<void>
  onRestore: (versionId: string) => Promise<void>
}

export default function ResumeEditor({
  initialData,
  versions,
  onSave,
  onRestore,
}: ResumeEditorProps) {
  const [data, setData] = useState<ResumeData>(() => normalizeParsed(initialData))
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    setData(normalizeParsed(initialData))
  }, [initialData])

  function updateIdentity(field: keyof ResumeData['identity'], value: string | string[]) {
    setData((d) => ({ ...d, identity: { ...d.identity, [field]: value } }))
  }

  function updateSummary(value: string) {
    setData((d) => ({ ...d, summary: value }))
  }

  function updateExperience(index: number, field: string, value: string | string[]) {
    setData((d) => {
      const next = [...d.experience]
      if (!next[index]) return d
      ;(next[index] as any)[field] = value
      return { ...d, experience: next }
    })
  }

  function addExperience() {
    setData((d) => ({
      ...d,
      experience: [...d.experience, { title: '', company: '', dates: '', bullets: [] }],
    }))
  }

  function removeExperience(index: number) {
    setData((d) => ({
      ...d,
      experience: d.experience.filter((_, i) => i !== index),
    }))
  }

  function updateSkills(value: string[]) {
    setData((d) => ({ ...d, skills: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(versionId: string) {
    setRestoringId(versionId)
    try {
      await onRestore(versionId)
    } finally {
      setRestoringId(null)
    }
  }

  function handleExportPdf() {
    const name = (data.identity.name || 'resume').trim().replace(/\s+/g, '-') || 'resume'
    exportResumeToPdf(data, `${name}-resume.pdf`)
  }

  const skillsStr = data.skills.join(', ')
  const formatVersionDate = (created_at: string) => {
    try {
      const d = new Date(created_at)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return created_at
    }
  }

  return (
    <div className="resume-editor-layout">
      <div className="resume-editor-main">
        <div className="resume-editor-header">
          <h1 className="resume-editor-title">Resume</h1>
          <p className="resume-editor-subtitle">
            Edit below. Save creates a new version so you can always go back. One account = one resume, synced across devices.
          </p>
          <div className="resume-editor-actions">
            <button type="button" className="primary-button save-button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save new version'}
            </button>
            <button type="button" className="secondary-button export-pdf-button" onClick={handleExportPdf}>
              Export PDF
            </button>
          </div>
        </div>

        <section className="resume-section panel">
          <h2 className="resume-section-title">Contact</h2>
          <div className="resume-fields">
            <div className="field-group">
              <label>Name</label>
              <input
                type="text"
                value={data.identity.name}
                onChange={(e) => updateIdentity('name', e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="field-group">
              <label>Email</label>
              <input
                type="text"
                value={data.identity.email}
                onChange={(e) => updateIdentity('email', e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="field-group">
              <label>Location</label>
              <input
                type="text"
                value={data.identity.location}
                onChange={(e) => updateIdentity('location', e.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div className="field-group">
              <label>Links (one per line)</label>
              <textarea
                value={data.identity.links.join('\n')}
                onChange={(e) => updateIdentity('links', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                placeholder="https://linkedin.com/..."
                rows={2}
              />
            </div>
          </div>
        </section>

        <section className="resume-section panel">
          <h2 className="resume-section-title">Summary</h2>
          <textarea
            className="resume-summary-input"
            value={data.summary}
            onChange={(e) => updateSummary(e.target.value)}
            placeholder="Brief professional summary…"
            rows={4}
          />
        </section>

        <section className="resume-section panel">
          <div className="resume-section-head">
            <h2 className="resume-section-title">Experience</h2>
            <button type="button" className="secondary-button" onClick={addExperience}>
              + Add role
            </button>
          </div>
          {data.experience.map((exp, i) => (
            <div key={i} className="resume-exp-block">
              <div className="resume-exp-row">
                <input
                  type="text"
                  value={exp.title}
                  onChange={(e) => updateExperience(i, 'title', e.target.value)}
                  placeholder="Job title"
                  className="resume-exp-title"
                />
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => updateExperience(i, 'company', e.target.value)}
                  placeholder="Company"
                  className="resume-exp-company"
                />
              </div>
              <input
                type="text"
                value={exp.dates}
                onChange={(e) => updateExperience(i, 'dates', e.target.value)}
                placeholder="e.g. Jan 2020 – Present"
                className="resume-exp-dates"
              />
              <textarea
                value={(exp.bullets || []).join('\n')}
                onChange={(e) => updateExperience(i, 'bullets', e.target.value.split('\n').filter((s) => s.trim()))}
                placeholder="Bullet points, one per line"
                rows={3}
                className="resume-exp-bullets"
              />
              <button type="button" className="secondary-button small remove-exp" onClick={() => removeExperience(i)}>
                Remove
              </button>
            </div>
          ))}
        </section>

        <section className="resume-section panel">
          <h2 className="resume-section-title">Skills</h2>
          <input
            type="text"
            value={skillsStr}
            onChange={(e) => updateSkills(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="React, TypeScript, Python, ..."
            className="resume-skills-input"
          />
        </section>
      </div>

      <aside className="resume-versions panel">
        <h2 className="resume-section-title">Version history</h2>
        <p className="resume-versions-hint">Each save is a new version. Restore loads that version into the editor.</p>
        <ul className="resume-versions-list">
          {versions.map((v) => (
            <li key={v.id} className="resume-version-item">
              <div className="resume-version-meta">
                <span className="resume-version-date">{formatVersionDate(v.created_at)}</span>
                {v.file_name && <span className="resume-version-file">{v.file_name}</span>}
              </div>
              <button
                type="button"
                className="secondary-button small"
                onClick={() => handleRestore(v.id)}
                disabled={restoringId === v.id}
              >
                {restoringId === v.id ? '…' : 'Restore'}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
