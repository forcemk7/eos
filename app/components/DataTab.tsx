'use client'

import { useState, useEffect, useRef } from 'react'
import type { ResumeData } from '@/lib/profile'
import { normalizedResumeData, genId } from '@/lib/profile'

interface DataTabProps {
  initialData: ResumeData | null
  onSave: (data: ResumeData) => Promise<void>
  onDataChange: () => void
}

export default function DataTab({
  initialData,
  onSave,
  onDataChange,
}: DataTabProps) {
  const [data, setData] = useState<ResumeData>(() => normalizedResumeData(initialData ?? undefined))
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadError, setUploadError] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [newSkillName, setNewSkillName] = useState('')
  const [activeTab, setActiveTab] = useState<
    'contact' | 'summary' | 'experience' | 'education' | 'achievements' | 'skills' | 'languages' | 'additional'
  >('contact')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setData(normalizedResumeData(initialData ?? undefined))
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
      identity: {
        ...d.identity,
        links: [...(d.identity.links ?? []), { label: '', url: '' }],
      },
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
  function updateExperience(index: number, field: 'title' | 'company' | 'dates', value: string) {
    setData((d) => {
      const next = [...d.experience]
      if (!next[index]) return d
      next[index] = { ...next[index], [field]: value }
      return { ...d, experience: next }
    })
  }
  function updateBullet(expIndex: number, bulletIndex: number, text: string) {
    setData((d) => {
      const next = [...d.experience]
      if (!next[expIndex] || !next[expIndex].bullets[bulletIndex]) return d
      const bullets = [...next[expIndex].bullets]
      bullets[bulletIndex] = { ...bullets[bulletIndex], text }
      next[expIndex] = { ...next[expIndex], bullets }
      return { ...d, experience: next }
    })
  }
  function addBullet(expIndex: number) {
    setData((d) => {
      const next = [...d.experience]
      if (!next[expIndex]) return d
      const bullets = [...next[expIndex].bullets, { id: genId(), text: '', sort_order: next[expIndex].bullets.length }]
      next[expIndex] = { ...next[expIndex], bullets }
      return { ...d, experience: next }
    })
  }
  function removeBullet(expIndex: number, bulletIndex: number) {
    setData((d) => {
      const next = [...d.experience]
      if (!next[expIndex]) return d
      const bullets = next[expIndex].bullets.filter((_, j) => j !== bulletIndex).map((b, j) => ({ ...b, sort_order: j }))
      next[expIndex] = { ...next[expIndex], bullets }
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
    setData((d) => ({ ...d, experience: d.experience.filter((_, i) => i !== index) }))
  }
  function addSkill(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setData((d) => ({
      ...d,
      skills: [...d.skills, { id: genId(), name: trimmed, sort_order: d.skills.length }],
    }))
    setNewSkillName('')
  }
  function removeSkill(index: number) {
    setData((d) => ({
      ...d,
      skills: d.skills.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })),
    }))
  }
  function updateSkill(index: number, name: string) {
    setData((d) => {
      const next = [...d.skills]
      if (!next[index]) return d
      next[index] = { ...next[index], name: name.trim() }
      return { ...d, skills: next }
    })
  }

  function addEducation() {
    setData((d) => ({
      ...d,
      education: [
        ...d.education,
        {
          id: genId(),
          institution: '',
          degree: '',
          field_of_study: '',
          dates: '',
          sort_order: d.education.length,
        },
      ],
    }))
  }
  function removeEducation(index: number) {
    setData((d) => ({
      ...d,
      education: d.education.filter((_, i) => i !== index).map((e, i) => ({ ...e, sort_order: i })),
    }))
  }
  function updateEducation(
    index: number,
    field: 'institution' | 'degree' | 'field_of_study' | 'dates',
    value: string
  ) {
    setData((d) => {
      const next = [...d.education]
      if (!next[index]) return d
      next[index] = { ...next[index], [field]: value }
      return { ...d, education: next }
    })
  }

  function addAchievement() {
    setData((d) => ({
      ...d,
      achievements: [
        ...d.achievements,
        { id: genId(), title: '', issuer: '', date: '', sort_order: d.achievements.length },
      ],
    }))
  }
  function removeAchievement(index: number) {
    setData((d) => ({
      ...d,
      achievements: d.achievements.filter((_, i) => i !== index).map((a, i) => ({ ...a, sort_order: i })),
    }))
  }
  function updateAchievement(index: number, field: 'title' | 'issuer' | 'date', value: string) {
    setData((d) => {
      const next = [...d.achievements]
      if (!next[index]) return d
      next[index] = { ...next[index], [field]: value }
      return { ...d, achievements: next }
    })
  }

  function addLanguage() {
    setData((d) => ({
      ...d,
      languages: [
        ...(d.languages ?? []),
        { id: genId(), language: '', level: '', sort_order: (d.languages ?? []).length },
      ],
    }))
  }
  function removeLanguage(index: number) {
    setData((d) => ({
      ...d,
      languages: (d.languages ?? []).filter((_, i) => i !== index).map((l, i) => ({ ...l, sort_order: i })),
    }))
  }
  function updateLanguage(index: number, field: 'language' | 'level', value: string) {
    setData((d) => {
      const next = [...(d.languages ?? [])]
      if (!next[index]) return d
      next[index] = { ...next[index], [field]: value }
      return { ...d, languages: next }
    })
  }

  function addAdditionalSection() {
    setData((d) => ({
      ...d,
      additional: [
        ...(d.additional ?? []),
        { id: genId(), title: '', content: [] },
      ],
    }))
  }
  function removeAdditionalSection(index: number) {
    setData((d) => ({
      ...d,
      additional: (d.additional ?? []).filter((_, i) => i !== index),
    }))
  }
  function updateAdditionalSectionTitle(index: number, title: string) {
    setData((d) => {
      const next = [...(d.additional ?? [])]
      if (!next[index]) return d
      next[index] = { ...next[index], title }
      return { ...d, additional: next }
    })
  }
  function addAdditionalSectionItem(sectionIndex: number) {
    setData((d) => {
      const next = [...(d.additional ?? [])]
      if (!next[sectionIndex]) return d
      next[sectionIndex] = {
        ...next[sectionIndex],
        content: [...next[sectionIndex].content, ''],
      }
      return { ...d, additional: next }
    })
  }
  function removeAdditionalSectionItem(sectionIndex: number, itemIndex: number) {
    setData((d) => {
      const next = [...(d.additional ?? [])]
      if (!next[sectionIndex]) return d
      next[sectionIndex] = {
        ...next[sectionIndex],
        content: next[sectionIndex].content.filter((_, j) => j !== itemIndex),
      }
      return { ...d, additional: next }
    })
  }
  function updateAdditionalSectionItem(sectionIndex: number, itemIndex: number, value: string) {
    setData((d) => {
      const next = [...(d.additional ?? [])]
      if (!next[sectionIndex] || next[sectionIndex].content[itemIndex] === undefined) return d
      const content = [...next[sectionIndex].content]
      content[itemIndex] = value
      next[sectionIndex] = { ...next[sectionIndex], content }
      return { ...d, additional: next }
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  async function ingestFile(file: File) {
    if (!file) return
    setUploadStatus('Parsing…')
    setUploadError(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const ingestRes = await fetch('/api/data/ingest', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const ingestData = await ingestRes.json()
      if (!ingestRes.ok || !ingestData.success) {
        throw new Error(ingestData.error || 'Failed to parse.')
      }
      setUploadStatus('Adding to your data…')
      const mergeRes = await fetch('/api/profile/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: ingestData.parsed }),
        credentials: 'include',
      })
      const mergeData = await mergeRes.json()
      if (!mergeRes.ok || !mergeData.success) {
        throw new Error(mergeData.error || 'Failed to add.')
      }
      setUploadStatus('Done.')
      onDataChange()
      setData(normalizedResumeData(mergeData.profile))
    } catch (err: any) {
      setUploadStatus(err.message || 'Something went wrong.')
      setUploadError(true)
    }
  }

  async function ingestPastedText() {
    const text = pastedText.trim()
    if (!text) return
    setUploadStatus('Parsing…')
    setUploadError(false)
    try {
      const ingestRes = await fetch('/api/data/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        credentials: 'include',
      })
      const ingestData = await ingestRes.json()
      if (!ingestRes.ok || !ingestData.success) {
        throw new Error(ingestData.error || 'Failed to parse.')
      }
      setUploadStatus('Adding to your data…')
      const mergeRes = await fetch('/api/profile/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: ingestData.parsed }),
        credentials: 'include',
      })
      const mergeData = await mergeRes.json()
      if (!mergeRes.ok || !mergeData.success) {
        throw new Error(mergeData.error || 'Failed to add.')
      }
      setUploadStatus('Done.')
      setPastedText('')
      onDataChange()
      setData(normalizedResumeData(mergeData.profile))
    } catch (err: any) {
      setUploadStatus(err.message || 'Something went wrong.')
      setUploadError(true)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) ingestFile(file)
  }

  const hasData =
    data.identity.name ||
    data.identity.email ||
    data.identity.phone ||
    data.summary ||
    data.experience.length > 0 ||
    (data.education?.length ?? 0) > 0 ||
    (data.achievements?.length ?? 0) > 0 ||
    data.skills.length > 0 ||
    (data.languages?.length ?? 0) > 0 ||
    (data.additional?.length ?? 0) > 0

  const totalChunks =
    (data.summary ? 1 : 0) +
    data.experience.length +
    data.experience.reduce((n, e) => n + e.bullets.length, 0) +
    (data.education?.length ?? 0) +
    (data.achievements?.length ?? 0) +
    data.skills.length +
    (data.languages?.length ?? 0) +
    (data.additional ?? []).reduce((n, s) => n + 1 + s.content.length, 0)

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'contact', label: 'Contact' },
    { id: 'summary', label: 'Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'skills', label: 'Skills' },
    { id: 'languages', label: 'Languages' },
    { id: 'additional', label: 'Additional' },
  ]

  const educationList = data.education ?? []
  const achievementsList = data.achievements ?? []

  return (
    <div className="data-tab">
      <section className="data-upload data-upload-compact panel">
        <div
          className="data-upload-row"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <button
            type="button"
            className="data-dropzone-compact"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
              className="data-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) ingestFile(f)
                e.target.value = ''
              }}
            />
            Upload file
          </button>
          <span className="data-upload-sep">or</span>
          <input
            type="text"
            className="data-paste-inline"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), ingestPastedText())}
            placeholder="Paste text…"
          />
          <button
            type="button"
            className="primary-button data-parse-btn"
            onClick={ingestPastedText}
            disabled={!pastedText.trim() || !!uploadStatus}
          >
            Parse & add
          </button>
        </div>
        {uploadStatus && (
          <p className={uploadError ? 'data-upload-error' : 'data-upload-status'}>{uploadStatus}</p>
        )}
      </section>

      <section className="data-content panel">
        <div className="data-content-head">
          <h2 className="data-section-title">Your data</h2>
          {hasData && (
            <div className="data-actions">
              <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <span className="data-chunk-count">{totalChunks} pieces</span>
            </div>
          )}
        </div>
        {!hasData ? (
          <p className="data-empty-hint">
            Upload a file or paste text above. We’ll extract Contact, Experience, Education, Achievements, Skills, Languages, and Additional into the tabs below.
          </p>
        ) : (
          <>
            <div className="data-tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`data-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="data-tab-panels">
              {activeTab === 'contact' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-card data-chunk-contact">
                    <div className="data-chunk-field">
                      <label>Name</label>
                      <input
                        type="text"
                        value={data.identity.name}
                        onChange={(e) => updateIdentity('name', e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="data-chunk-field">
                      <label>Email</label>
                      <input
                        type="text"
                        value={data.identity.email}
                        onChange={(e) => updateIdentity('email', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="data-chunk-field">
                      <label>Phone</label>
                      <input
                        type="text"
                        value={data.identity.phone}
                        onChange={(e) => updateIdentity('phone', e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                    <div className="data-chunk-field">
                      <label>Location</label>
                      <input
                        type="text"
                        value={data.identity.location}
                        onChange={(e) => updateIdentity('location', e.target.value)}
                        placeholder="City, State / Country"
                      />
                    </div>
                    <div className="data-chunk-field">
                      <div className="data-chunk-links-head">
                        <span className="data-chunk-field-label">Links</span>
                        <button type="button" className="secondary-button small" onClick={addLink}>
                          + Add link
                        </button>
                      </div>
                      {(data.identity.links ?? []).map((link, i) => (
                        <div key={i} className="data-chunk-link-row">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => updateLink(i, 'label', e.target.value)}
                            placeholder="Label (e.g. LinkedIn)"
                            className="data-chunk-link-label"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => updateLink(i, 'url', e.target.value)}
                            placeholder="https://..."
                            className="data-chunk-link-url"
                          />
                          <button
                            type="button"
                            className="data-chunk-remove small"
                            onClick={() => removeLink(i)}
                            title="Remove link"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-card">
                    <textarea
                      className="data-chunk-summary"
                      value={data.summary}
                      onChange={(e) => updateSummary(e.target.value)}
                      placeholder="2–4 sentences: role level, key strengths, what you’re targeting."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'experience' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-group-head">
                    <button type="button" className="secondary-button small" onClick={addExperience}>
                      + Add position
                    </button>
                  </div>
                  {data.experience.map((exp, i) => (
                    <div key={exp.id} className="data-chunk-card data-chunk-experience">
                      <div className="data-chunk-exp-header">
                        <input
                          type="text"
                          value={exp.title}
                          onChange={(e) => updateExperience(i, 'title', e.target.value)}
                          placeholder="Job title"
                          className="data-chunk-exp-title"
                        />
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => updateExperience(i, 'company', e.target.value)}
                          placeholder="Company"
                          className="data-chunk-exp-company"
                        />
                        <input
                          type="text"
                          value={exp.dates}
                          onChange={(e) => updateExperience(i, 'dates', e.target.value)}
                          placeholder="Dates"
                          className="data-chunk-exp-dates"
                        />
                        <button
                          type="button"
                          className="data-chunk-remove"
                          onClick={() => removeExperience(i)}
                          title="Remove position"
                        >
                          ×
                        </button>
                      </div>
                      <div className="data-chunk-bullets">
                        <span className="data-chunk-bullets-label">Bullets</span>
                        {(exp.bullets || []).map((b, j) => (
                          <div key={b.id} className="data-chunk-bullet-row">
                            <input
                              type="text"
                              value={b.text}
                              onChange={(e) => updateBullet(i, j, e.target.value)}
                              placeholder="Quantified achievement or responsibility…"
                              className="data-chunk-bullet-input"
                            />
                            <button
                              type="button"
                              className="data-chunk-remove small"
                              onClick={() => removeBullet(i, j)}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="secondary-button small data-chunk-add-bullet"
                          onClick={() => addBullet(i)}
                        >
                          + Add bullet
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'education' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-group-head">
                    <button type="button" className="secondary-button small" onClick={addEducation}>
                      + Add education
                    </button>
                  </div>
                  {educationList.map((edu, i) => (
                    <div key={edu.id} className="data-chunk-card data-chunk-education">
                      <div className="data-chunk-edu-row">
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => updateEducation(i, 'institution', e.target.value)}
                          placeholder="Institution"
                        />
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => updateEducation(i, 'degree', e.target.value)}
                          placeholder="Degree"
                        />
                        <input
                          type="text"
                          value={edu.field_of_study}
                          onChange={(e) => updateEducation(i, 'field_of_study', e.target.value)}
                          placeholder="Field of study"
                        />
                        <input
                          type="text"
                          value={edu.dates}
                          onChange={(e) => updateEducation(i, 'dates', e.target.value)}
                          placeholder="Dates"
                          className="data-chunk-dates"
                        />
                        <button
                          type="button"
                          className="data-chunk-remove"
                          onClick={() => removeEducation(i)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'achievements' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-group-head">
                    <button type="button" className="secondary-button small" onClick={addAchievement}>
                      + Add achievement
                    </button>
                  </div>
                  {achievementsList.map((a, i) => (
                    <div key={a.id} className="data-chunk-card data-chunk-achievement">
                      <div className="data-chunk-ach-row">
                        <input
                          type="text"
                          value={a.title}
                          onChange={(e) => updateAchievement(i, 'title', e.target.value)}
                          placeholder="Award or certification name"
                        />
                        <input
                          type="text"
                          value={a.issuer}
                          onChange={(e) => updateAchievement(i, 'issuer', e.target.value)}
                          placeholder="Issuer"
                        />
                        <input
                          type="text"
                          value={a.date}
                          onChange={(e) => updateAchievement(i, 'date', e.target.value)}
                          placeholder="Date"
                          className="data-chunk-dates"
                        />
                        <button
                          type="button"
                          className="data-chunk-remove"
                          onClick={() => removeAchievement(i)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'skills' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-skills">
                    {data.skills.map((s, i) => (
                      <div key={s.id} className="data-chunk-skill-chip">
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => updateSkill(i, e.target.value)}
                          className="data-chunk-skill-input"
                          placeholder="Skill"
                        />
                        <button
                          type="button"
                          className="data-chunk-remove small"
                          onClick={() => removeSkill(i)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="data-chunk-skill-add">
                      <input
                        type="text"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill(newSkillName))}
                        placeholder="+ Add skill"
                        className="data-chunk-skill-add-input"
                      />
                      <button
                        type="button"
                        className="secondary-button small"
                        onClick={() => addSkill(newSkillName)}
                        disabled={!newSkillName.trim()}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'languages' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-group-head">
                    <button type="button" className="secondary-button small" onClick={addLanguage}>
                      + Add language
                    </button>
                  </div>
                  {(data.languages ?? []).map((lang, i) => (
                    <div key={lang.id} className="data-chunk-card data-chunk-language">
                      <div className="data-chunk-lang-row">
                        <input
                          type="text"
                          value={lang.language}
                          onChange={(e) => updateLanguage(i, 'language', e.target.value)}
                          placeholder="Language"
                        />
                        <input
                          type="text"
                          value={lang.level}
                          onChange={(e) => updateLanguage(i, 'level', e.target.value)}
                          placeholder="Level (e.g. Native, Fluent, Intermediate)"
                          className="data-chunk-lang-level"
                        />
                        <button
                          type="button"
                          className="data-chunk-remove"
                          onClick={() => removeLanguage(i)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'additional' && (
                <div className="data-chunk-group" role="tabpanel">
                  <div className="data-chunk-group-head">
                    <button type="button" className="secondary-button small" onClick={addAdditionalSection}>
                      + Add a section
                    </button>
                  </div>
                  <p className="data-section-hint data-additional-hint">
                    Each section has a title and a list of items.
                  </p>
                  {(data.additional ?? []).map((sec, si) => (
                    <div key={sec.id} className="data-chunk-card data-chunk-additional">
                      <div className="data-chunk-additional-head">
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => updateAdditionalSectionTitle(si, e.target.value)}
                          placeholder="Section title (e.g. Community & Sports)"
                          className="data-chunk-additional-title"
                        />
                        <button
                          type="button"
                          className="data-chunk-remove"
                          onClick={() => removeAdditionalSection(si)}
                          title="Remove section"
                        >
                          ×
                        </button>
                      </div>
                      <div className="data-chunk-additional-content">
                        {sec.content.map((item, ii) => (
                          <div key={ii} className="data-chunk-additional-item">
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => updateAdditionalSectionItem(si, ii, e.target.value)}
                              placeholder="One line"
                            />
                            <button
                              type="button"
                              className="data-chunk-remove small"
                              onClick={() => removeAdditionalSectionItem(si, ii)}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="secondary-button small"
                          onClick={() => addAdditionalSectionItem(si)}
                        >
                          + Add item
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
