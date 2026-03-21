'use client'

import { useState, useEffect, useMemo, useCallback, useId } from 'react'
import { AppShell } from '@/app/components/shell'
import { useMediaQuery } from '@/app/components/jobs/useMediaQuery'
import { cn } from '@/lib/utils'
import { exportResumeToPdf } from '@/lib/exportResumePdf'
import { applyResumeSuggestion, type ResumeSuggestion } from '@/lib/applyResumeSuggestion'
import ResumePreview, { TEMPLATE_IDS, type TemplateId } from './ResumePreview'
import type { ResumeData } from '@/lib/profile'
import { normalizedResumeData, genId } from '@/lib/profile'
import type { ResumeVersionTailoring, TailorResumeSession } from '@/lib/resumeTailoring'
import type { CandidateReadout, ArtifactReadoutResponse } from '@/lib/jobs/candidateReadout'
import { readoutArchetypeKeySet, readoutTagKeySet } from '@/lib/jobs/candidateReadout'
import { normalizeTargetKey } from '@/lib/jobs/targetProfileTypes'
import { archetypeLabel, type ArchetypeSlug } from '@/lib/jobs/archetypeTaxonomy'
import CandidateReadoutBlock from '@/app/components/CandidateReadoutBlock'
import { Button } from '@/app/components/ui/button'

export type { ResumeData }

function sessionToTailoringNav(s: TailorResumeSession): ResumeVersionTailoring {
  return {
    job_listing_id: s.listing_id,
    title: s.title,
    company: s.company,
    url: s.url,
    stable_external_id: s.stable_external_id,
    source_tab: s.sourceTab,
  }
}

function tailoringLabel(t: ResumeVersionTailoring | null | undefined): string | null {
  if (!t) return null
  const a = t.title?.trim()
  const b = t.company?.trim()
  if (a && b) return `${a} · ${b}`
  if (a) return a
  if (b) return b
  if (t.job_listing_id || t.url || t.stable_external_id) return 'Job-specific version'
  return null
}

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
  tailoring?: ResumeVersionTailoring | null
}

interface ResumeEditorProps {
  initialData: ResumeData
  versions: VersionItem[]
  onSave: (data: ResumeData) => Promise<void>
  onRestore: (versionId: string) => Promise<void>
  /** `profile` when editor reflects live server profile; UUID after restoring a historical version. */
  resumeSourceId: string
  currentTailoring?: ResumeVersionTailoring | null
  tailorSession?: TailorResumeSession | null
  onDismissTailor?: () => void
  onOpenJobPosting?: (url: string) => void
  onShowListingInBoard?: (t: ResumeVersionTailoring) => void
}

export default function ResumeEditor({
  initialData,
  versions,
  onSave,
  onRestore,
  resumeSourceId,
  currentTailoring = null,
  tailorSession,
  onDismissTailor,
  onOpenJobPosting,
  onShowListingInBoard,
}: ResumeEditorProps) {
  const [data, setData] = useState<ResumeData>(() => normalizedResumeData(initialData))
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(true)
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('classic')
  const [dataReadout, setDataReadout] = useState<CandidateReadout | null>(null)
  const [artifactReadout, setArtifactReadout] = useState<ArtifactReadoutResponse | null>(null)
  const [readoutLoading, setReadoutLoading] = useState(false)
  const [readoutError, setReadoutError] = useState<string | null>(null)
  const [lastReadoutSerialized, setLastReadoutSerialized] = useState<string | null>(null)
  const narrowLayout = useMediaQuery('(max-width: 840px)')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const tabEditId = useId()
  const tabPreviewId = useId()
  const panelEditId = useId()
  const panelPreviewId = useId()

  useEffect(() => {
    setData(normalizedResumeData(initialData))
  }, [initialData])

  const dataSerialized = useMemo(() => JSON.stringify(normalizedResumeData(data)), [data])
  const readoutDirty =
    Boolean(artifactReadout && lastReadoutSerialized !== null && lastReadoutSerialized !== dataSerialized)

  const loadDataReadout = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/qualifications', { credentials: 'include' })
      const j = (await res.json()) as {
        success?: boolean
        candidate_readout?: CandidateReadout | null
      }
      if (res.ok && j.success) setDataReadout(j.candidate_readout ?? null)
    } catch {
      // ignore — comparison strip optional
    }
  }, [])

  useEffect(() => {
    void loadDataReadout()
  }, [loadDataReadout, initialData])

  async function refreshArtifactReadout() {
    setReadoutLoading(true)
    setReadoutError(null)
    try {
      const res = await fetch('/api/resume/readout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parsed: data }),
      })
      const j = (await res.json()) as {
        success?: boolean
        readout?: ArtifactReadoutResponse
        error?: string
      }
      if (!res.ok || !j.success || !j.readout) {
        setReadoutError(j.error || 'Could not generate readout.')
        return
      }
      setArtifactReadout(j.readout)
      setLastReadoutSerialized(JSON.stringify(normalizedResumeData(data)))
    } catch {
      setReadoutError('Could not generate readout.')
    } finally {
      setReadoutLoading(false)
    }
  }

  // Auto-fetch suggestions when editor loads or data is restored (JD-aware when tailoring)
  useEffect(() => {
    setSuggestLoading(true)
    const payload = normalizedResumeData(initialData)
    const jd = tailorSession?.jdText?.trim()
    fetch('/api/resume/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeData: payload,
        ...(jd ? { jobDescription: jd } : {}),
      }),
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.suggestions)) setSuggestions(json.suggestions)
      })
      .finally(() => setSuggestLoading(false))
  }, [initialData, tailorSession?.jdText])

  function updateIdentity(field: keyof Omit<ResumeData['identity'], 'links'>, value: string) {
    setData((d) => ({ ...d, identity: { ...d.identity, [field]: value } }))
  }
  function updateLink(index: number, url: string) {
    setData((d) => {
      const links = [...(d.links ?? [])]
      if (!links[index]) return d
      links[index] = { ...links[index], url }
      return { ...d, links }
    })
  }
  function addLink(url?: string) {
    setData((d) => ({
      ...d,
      links: [...(d.links ?? []), { url: url ?? '' }],
    }))
  }
  function removeLink(index: number) {
    setData((d) => ({
      ...d,
      links: (d.links ?? []).filter((_, i) => i !== index),
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
        ;(next[index] as Record<string, unknown>)[field] = value
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
              <Button type="button" size="sm" onClick={() => handleAcceptSuggestion(s)}>
                Accept
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleRejectSuggestion(s)}>
                Reject
              </Button>
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

  const archetypeDiff = useMemo(() => {
    if (!dataReadout || !artifactReadout) return null
    const d = readoutArchetypeKeySet(dataReadout)
    const r = readoutArchetypeKeySet(artifactReadout)
    return {
      onlyData: [...d].filter((x) => !r.has(x)),
      onlyResume: [...r].filter((x) => !d.has(x)),
      shared: [...d].filter((x) => r.has(x)),
    }
  }, [dataReadout, artifactReadout])

  const tagDiff = useMemo(() => {
    if (!dataReadout || !artifactReadout) return null
    const dk = readoutTagKeySet(dataReadout)
    const rk = readoutTagKeySet(artifactReadout)
    const onlyData = dataReadout.tags.filter((t) => !rk.has(normalizeTargetKey(t.key)))
    const onlyResume = artifactReadout.tags.filter((t) => !dk.has(normalizeTargetKey(t.key)))
    const sharedKeys = [...dk].filter((k) => rk.has(k))
    const sharedLabels = sharedKeys
      .map((k) => {
        const a = dataReadout.tags.find((t) => normalizeTargetKey(t.key) === k)
        return a?.label ?? k
      })
      .filter(Boolean)
    return { onlyData, onlyResume, sharedLabels }
  }, [dataReadout, artifactReadout])

  const tailoredContext = Boolean(tailorSession || currentTailoring)

  const actionButtons = (
    <>
      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save version'}
      </Button>
      <Button type="button" variant="outline" onClick={handleExportPdf}>
        Export PDF
      </Button>
    </>
  )

  const tailorBanner =
    tailorSession ? (
          <div
            className="resume-tailor-banner mb-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="min-w-0">
              <p className="m-0 text-sm font-medium text-foreground">
                Tailoring for {tailorSession.title || 'Role'} · {tailorSession.company || 'Company'}
              </p>
              <p className="mt-1 m-0 text-xs text-muted-foreground">
                Suggestions align with this job description. Save attaches this version to the listing in history.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {tailorSession.url && onOpenJobPosting ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenJobPosting(tailorSession.url!)}>
                  Open posting
                </Button>
              ) : null}
              {onShowListingInBoard ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onShowListingInBoard(sessionToTailoringNav(tailorSession))}
                >
                  Show in job list
                </Button>
              ) : null}
              {onDismissTailor ? (
                <Button type="button" variant="outline" size="sm" onClick={onDismissTailor}>
                  Dismiss
                </Button>
              ) : null}
            </div>
          </div>
        ) : null

  const readoutSection = (
        <section className="resume-readout panel mb-4 rounded-lg border border-border bg-card/20 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="resume-section-title m-0 text-base">How this resume reads</h2>
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                On-demand archetypes and tags for this document. Refresh after edits; compare with your Profile
                readout.
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0"
              disabled={readoutLoading}
              onClick={() => void refreshArtifactReadout()}
            >
              {readoutLoading ? 'Refreshing…' : 'Refresh readout'}
            </Button>
          </div>

          {resumeSourceId !== 'profile' && (
            <p className="m-0 mt-3 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
              You&apos;re editing a restored version that isn&apos;t saved to your profile yet. Save to sync this
              content with Data — until then, recruiters see a different &quot;packet&quot; than what&apos;s stored.
            </p>
          )}

          {tailoredContext && (
            <p className="m-0 mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-foreground/90">
              Job-tailoring context is active or this row was saved for a listing. Some differences vs Data can be
              intentional repositioning.
            </p>
          )}

          {readoutError && (
            <p className="m-0 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {readoutError}
            </p>
          )}

          {readoutDirty && (
            <p className="m-0 mt-3 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
              Resume text changed since the last readout. Refresh to update labels.
            </p>
          )}

          {artifactReadout && (
            <CandidateReadoutBlock
              heading=""
              readout={artifactReadout}
              readoutStale={false}
              profileData={data}
              embedded
            />
          )}

          {!artifactReadout && !readoutLoading && (
            <p className="m-0 mt-3 text-sm text-muted-foreground">
              Click <strong className="font-medium text-foreground/90">Refresh readout</strong> to label this resume.
            </p>
          )}

          {artifactReadout && !dataReadout && (
            <p className="m-0 mt-3 text-xs text-muted-foreground">
              Regenerate your target profile on the Profile tab to store a baseline &quot;how your data reads&quot; readout
              for side-by-side comparison.
            </p>
          )}

          {archetypeDiff && tagDiff && (archetypeDiff.onlyData.length > 0 || archetypeDiff.onlyResume.length > 0 || archetypeDiff.shared.length > 0 || tagDiff.onlyData.length > 0 || tagDiff.onlyResume.length > 0 || tagDiff.sharedLabels.length > 0) && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <h3 className="m-0 text-sm font-semibold text-foreground">Data vs this resume</h3>
              <p className="m-0 text-xs text-muted-foreground">
                Compared to the readout from your Profile (regenerate targets there to refresh the baseline).
              </p>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-md border border-border/80 bg-muted/10 p-2.5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared</div>
                  <ul className="m-0 mt-1 list-none space-y-1 p-0 text-muted-foreground">
                    {archetypeDiff.shared.map((slug) => (
                      <li key={slug}>{archetypeLabel(slug as ArchetypeSlug)}</li>
                    ))}
                    {tagDiff.sharedLabels.map((label) => (
                      <li key={label}>Tag: {label}</li>
                    ))}
                    {archetypeDiff.shared.length === 0 && tagDiff.sharedLabels.length === 0 && (
                      <li className="text-xs">—</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-border/80 bg-muted/10 p-2.5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data only</div>
                  <ul className="m-0 mt-1 list-none space-y-1 p-0 text-muted-foreground">
                    {archetypeDiff.onlyData.map((slug) => (
                      <li key={slug}>{archetypeLabel(slug as ArchetypeSlug)}</li>
                    ))}
                    {tagDiff.onlyData.map((t) => (
                      <li key={t.id}>Tag: {t.label}</li>
                    ))}
                    {archetypeDiff.onlyData.length === 0 && tagDiff.onlyData.length === 0 && (
                      <li className="text-xs">—</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-border/80 bg-muted/10 p-2.5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resume only</div>
                  <ul className="m-0 mt-1 list-none space-y-1 p-0 text-muted-foreground">
                    {archetypeDiff.onlyResume.map((slug) => (
                      <li key={slug}>{archetypeLabel(slug as ArchetypeSlug)}</li>
                    ))}
                    {tagDiff.onlyResume.map((t) => (
                      <li key={t.id}>Tag: {t.label}</li>
                    ))}
                    {archetypeDiff.onlyResume.length === 0 && tagDiff.onlyResume.length === 0 && (
                      <li className="text-xs">—</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
  )

  const formSections = (
    <>
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
                <Button type="button" variant="outline" size="sm" onClick={() => addLink()}>
                  + Add link
                </Button>
              </div>
              {(data.links ?? []).map((link, i) => (
                <div key={i} className="field-group link-row">
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, e.target.value)}
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
            <Button type="button" variant="outline" onClick={addExperience}>
              + Add role
            </Button>
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
              <Button type="button" variant="outline" size="sm" className="remove-exp" onClick={() => removeExperience(i)}>
                Remove
              </Button>
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
    </>
  )

  const previewAsideInner = (
    <>
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
            {versions.map((v) => {
              const tlabel = tailoringLabel(v.tailoring ?? null)
              const canViewListing =
                onShowListingInBoard &&
                v.tailoring &&
                (v.tailoring.stable_external_id || v.tailoring.url)
              return (
                <li key={v.id} className="resume-version-item">
                  <div className="resume-version-meta">
                    <span className="resume-version-date">{formatVersionDate(v.created_at)}</span>
                    {v.file_name && <span className="resume-version-file">{v.file_name}</span>}
                    {tlabel && (
                      <span className="resume-version-listing block text-xs text-muted-foreground mt-1">
                        {tlabel}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 items-stretch sm:items-end">
                    {canViewListing ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => onShowListingInBoard!(v.tailoring!)}>
                        View listing
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(v.id)}
                      disabled={restoringId === v.id}
                    >
                      {restoringId === v.id ? '…' : 'Restore'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
    </>
  )

  return (
    <AppShell variant="wide">
    {narrowLayout ? (
      <div className="resume-editor-layout resume-editor-layout--narrow">
        <div className="resume-editor-narrow-sticky">
          <div className="resume-editor-narrow-toolbar">
            <div className="resume-editor-narrow-toolbar-actions">{actionButtons}</div>
          </div>
          <div className="resume-editor-narrow-tabs" role="tablist" aria-label="Resume editor view">
            <button
              type="button"
              role="tab"
              id={tabEditId}
              aria-selected={mobileTab === 'edit'}
              aria-controls={panelEditId}
              tabIndex={mobileTab === 'edit' ? 0 : -1}
              className={cn('resume-editor-narrow-tab', mobileTab === 'edit' && 'resume-editor-narrow-tab--active')}
              onClick={() => setMobileTab('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              id={tabPreviewId}
              aria-selected={mobileTab === 'preview'}
              aria-controls={panelPreviewId}
              tabIndex={mobileTab === 'preview' ? 0 : -1}
              className={cn('resume-editor-narrow-tab', mobileTab === 'preview' && 'resume-editor-narrow-tab--active')}
              onClick={() => setMobileTab('preview')}
            >
              Preview
            </button>
          </div>
        </div>

        <div
          id={panelEditId}
          role="tabpanel"
          aria-labelledby={tabEditId}
          hidden={mobileTab !== 'edit'}
          className="resume-editor-narrow-panel"
        >
          <div className="resume-editor-narrow-title">
            <h1 className="eos-title-section m-0 text-lg sm:text-xl">Resume</h1>
            <p className="app-section-hint mt-1 mb-0 text-sm">
              Edit fields below. Use Preview for layout, PDF export, and version history.
            </p>
          </div>
          {tailorBanner}
          {readoutSection}
          {formSections}
        </div>

        <div
          id={panelPreviewId}
          role="tabpanel"
          aria-labelledby={tabPreviewId}
          hidden={mobileTab !== 'preview'}
          className="resume-editor-narrow-panel resume-editor-aside"
        >
          {previewAsideInner}
        </div>
      </div>
    ) : (
    <div className="resume-editor-layout">
      <div className="resume-editor-main">
        <div className="resume-editor-header">
          <div className="resume-editor-header-text">
            <h1 className="eos-title-section">Resume</h1>
            <p className="app-section-hint mt-1">
              Edit below. Save creates a new version. Switch layout to see the same data in different styles.
            </p>
          </div>
          <div className="resume-editor-actions">{actionButtons}</div>
        </div>

        {tailorBanner}
        {readoutSection}
        {formSections}
      </div>

      <aside className="resume-editor-aside">{previewAsideInner}</aside>
    </div>
    )}
    </AppShell>
  )
}
