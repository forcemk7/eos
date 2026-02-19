'use client'

import { useState, useEffect } from 'react'
import { exportResumeToPdf } from '@/lib/exportResumePdf'
import { applyResumeSuggestion, type ResumeSuggestion } from '@/lib/applyResumeSuggestion'
import ResumePreview, { TEMPLATE_IDS, type TemplateId } from './ResumePreview'
import type { ResumeData } from '@/lib/profile'
import { normalizedResumeData, genId } from '@/lib/profile'

export type { ResumeData }

/** Section key for grouping suggestions: identity | summary | skills | experience-0, experience-1, ... */
function sectionForPath(path: string): string {
  if (path.startsWith('identity.')) return 'identity'
  if (path === 'summary') return 'summary'
  if (path === 'skills') return 'skills'
  const m = path.match(/^experience\.(\d+)/)
  return m ? `experience-${m[1]}` : 'other'
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
  const [data, setData] = useState<ResumeData>(() => normalizedResumeData(initialData))
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(true)
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('classic')

  useEffect(() => {
    setData(normalizedResumeData(initialData))
  }, [initialData])

  // Auto-fetch suggestions when editor loads or data is restored
  useEffect(() => {
    setSuggestLoading(true)
    const payload = normalizedResumeData(initialData)
    fetch('/api/resume/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeData: payload }),
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.suggestions)) setSuggestions(json.suggestions)
      })
      .finally(() => setSuggestLoading(false))
  }, [initialData])

  function updateIdentity(field: keyof Omit<ResumeData['identity'], 'links'>, value: string) {
    setData((d) => ({ ...d, identity: { ...d.identity, [field]: value } }))
  }
  function updateLink(index: number, field: 'label' | 'url', value: string) {
    setData((d) => {
      const links = [...(d.identity.links ?? [])]
      if (!links[index]) return d
      links[index] = { ...links[index], [field]: value }
      return { ...d, identity: { ...d.identity, links } }
    })
  }
  function addLink() {
    setData((d) => ({
      ...d,
      identity: { ...d.identity, links: [...(d.identity.links ?? []), { label: '', url: '' }] },
    }))
  }
  function removeLink(index: number) {
    setData((d) => ({
      ...d,
      identity: {
        ...d.identity,
        links: (d.identity.links ?? []).filter((_, i) => i !== index),
      },
    }))
  }

  function updateSummary(value: string) {
    setData((d) => ({ ...d, summary: value }))
  }

  function updateExperience(index: number, field: string, value: string | string[]) {
    setData((d) => {
      const next = [...d.experience]
      if (!next[index]) return d
      if (field === 'bullets') {
        const texts = (value as string[]).filter((s) => s.trim())
        next[index] = {
          ...next[index],
          bullets: texts.map((text, j) => ({
            id: next[index].bullets[j]?.id ?? genId(),
            text,
            sort_order: j,
          })),
        }
      } else {
        ;(next[index] as any)[field] = value
      }
      return { ...d, experience: next }
    })
  }

  function addExperience() {
    setData((d) => ({
      ...d,
      experience: [
        ...d.experience,
        {
          id: genId(),
          title: '',
          company: '',
          dates: '',
          sort_order: d.experience.length,
          bullets: [],
        },
      ],
    }))
  }

  function removeExperience(index: number) {
    setData((d) => ({
      ...d,
      experience: d.experience.filter((_, i) => i !== index),
    }))
  }

  function updateSkills(names: string[]) {
    setData((d) => ({
      ...d,
      skills: names.map((name, i) => ({
        id: d.skills[i]?.id ?? genId(),
        name,
        sort_order: i,
      })),
    }))
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

  function handleAcceptSuggestion(s: ResumeSuggestion) {
    setData((d) => applyResumeSuggestion(d, { path: s.path, suggestedValue: s.suggestedValue }))
    setSuggestions((list) => list.filter((x) => x.id !== s.id))
  }

  function handleRejectSuggestion(s: ResumeSuggestion) {
    setSuggestions((list) => list.filter((x) => x.id !== s.id))
  }

  function handleExportPdf() {
    const name = (data.identity.name || 'resume').trim().replace(/\s+/g, '-') || 'resume'
    exportResumeToPdf(data, `${name}-${activeTemplate}.pdf`, activeTemplate)
  }

  const skillsStr = data.skills.map((s) => s.name).join(', ')
  const suggestionsBySection = (sectionKey: string) =>
    suggestions.filter((s) => sectionForPath(s.path) === sectionKey)

  function InlineSuggestions({ sectionKey }: { sectionKey: string }) {
    const list = suggestionsBySection(sectionKey)
    if (list.length === 0) return null
    return (
      <ul className="resume-suggestions-inline">
        {list.map((s) => (
          <li key={s.id} className="resume-suggestion-item">
            <div className="resume-suggestion-reason">{s.reason}</div>
            <div className="resume-suggestion-diff">
              <span className="resume-suggestion-current">{s.currentValue || '(empty)'}</span>
              <span className="resume-suggestion-arrow">→</span>
              <span className="resume-suggestion-new">{s.suggestedValue}</span>
            </div>
            <div className="resume-suggestion-actions">
              <button type="button" className="primary-button small" onClick={() => handleAcceptSuggestion(s)}>
                Accept
              </button>
              <button type="button" className="secondary-button small" onClick={() => handleRejectSuggestion(s)}>
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

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
          <div className="resume-editor-header-text">
            <h1 className="resume-editor-title">Resume</h1>
            <p className="resume-editor-subtitle">
              Edit below. Save creates a new version. Switch layout to see the same data in different styles.
            </p>
          </div>
          <div className="resume-editor-actions">
            <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save version'}
            </button>
            <button type="button" className="secondary-button" onClick={handleExportPdf}>
              Export PDF
            </button>
          </div>
        </div>

        <section className="resume-section">
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
              <label>Phone</label>
              <input
                type="text"
                value={data.identity.phone}
                onChange={(e) => updateIdentity('phone', e.target.value)}
                placeholder="+1 234 567 8900"
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
              <div className="field-group-row">
                <label>Links</label>
                <button type="button" className="secondary-button small" onClick={addLink}>
                  + Add link
                </button>
              </div>
              {(data.identity.links ?? []).map((link, i) => (
                <div key={i} className="field-group link-row">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateLink(i, 'label', e.target.value)}
                    placeholder="Label"
                  />
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                  <button type="button" className="small" onClick={() => removeLink(i)} title="Remove">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          {suggestLoading && suggestions.length === 0 ? (
            <p className="resume-suggestions-loading">Loading suggestions…</p>
          ) : (
            <InlineSuggestions sectionKey="identity" />
          )}
        </section>

        <section className="resume-section">
          <h2 className="resume-section-title">Summary</h2>
          <textarea
            className="resume-summary-input"
            value={data.summary}
            onChange={(e) => updateSummary(e.target.value)}
            placeholder="Brief professional summary…"
            rows={4}
          />
          {!suggestLoading && <InlineSuggestions sectionKey="summary" />}
        </section>

        <section className="resume-section">
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
                value={(exp.bullets || []).map((b) => b.text).join('\n')}
                onChange={(e) =>
                  updateExperience(
                    i,
                    'bullets',
                    e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="Bullet points, one per line"
                rows={3}
                className="resume-exp-bullets"
              />
              <button type="button" className="secondary-button small remove-exp" onClick={() => removeExperience(i)}>
                Remove
              </button>
              {!suggestLoading && <InlineSuggestions sectionKey={`experience-${i}`} />}
            </div>
          ))}
        </section>

        <section className="resume-section">
          <h2 className="resume-section-title">Skills</h2>
          <input
            type="text"
            value={skillsStr}
            onChange={(e) =>
              updateSkills(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder="React, TypeScript, Python, ..."
            className="resume-skills-input"
          />
          {!suggestLoading && <InlineSuggestions sectionKey="skills" />}
        </section>
      </div>

      <aside className="resume-editor-aside">
        <div className="resume-preview-wrap panel">
          <div className="resume-preview-tabs">
            {TEMPLATE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`resume-preview-tab ${activeTemplate === id ? 'active' : ''}`}
                onClick={() => setActiveTemplate(id)}
              >
                {id === 'classic' ? 'Classic' : 'Compact'}
              </button>
            ))}
          </div>
          <div className="resume-preview-frame">
            <ResumePreview data={data} templateId={activeTemplate} />
          </div>
        </div>
        <div className="resume-versions panel">
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
        </div>
      </aside>
    </div>
  )
}
