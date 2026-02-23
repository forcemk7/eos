'use client'

import { useState, useEffect, useRef } from 'react'
import type { ResumeData } from '@/lib/profile'
import { normalizedResumeData, genId } from '@/lib/profile'
import {
  ContactPanel,
  SummaryPanel,
  ExperiencePanel,
  EducationPanel,
  AchievementsPanel,
  SkillsPanel,
  LanguagesPanel,
  AdditionalPanel,
  type DataTabHandlers,
} from './DataTabPanels'

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
    } catch (err: unknown) {
      setUploadStatus(err instanceof Error ? err.message : 'Something went wrong.')
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
    } catch (err: unknown) {
      setUploadStatus(err instanceof Error ? err.message : 'Something went wrong.')
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

  const handlers: DataTabHandlers = {
    updateIdentity,
    updateLink,
    addLink,
    removeLink,
    updateSummary,
    updateExperience,
    updateBullet,
    addBullet,
    removeBullet,
    addExperience,
    removeExperience,
    addSkill,
    removeSkill,
    updateSkill,
    addEducation,
    removeEducation,
    updateEducation,
    addAchievement,
    removeAchievement,
    updateAchievement,
    addLanguage,
    removeLanguage,
    updateLanguage,
    addAdditionalSection,
    removeAdditionalSection,
    updateAdditionalSectionTitle,
    addAdditionalSectionItem,
    removeAdditionalSectionItem,
    updateAdditionalSectionItem,
  }

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
              {activeTab === 'contact' && <ContactPanel data={data} h={handlers} />}
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

              {activeTab === 'experience' && <ExperiencePanel data={data} h={handlers} />}
              {activeTab === 'education' && <EducationPanel data={data} h={handlers} />}
              {activeTab === 'achievements' && <AchievementsPanel data={data} h={handlers} />}
              {activeTab === 'skills' && <SkillsPanel data={data} h={handlers} newSkillName={newSkillName} setNewSkillName={setNewSkillName} />}
              {activeTab === 'languages' && <LanguagesPanel data={data} h={handlers} />}
              {activeTab === 'additional' && <AdditionalPanel data={data} h={handlers} />}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
