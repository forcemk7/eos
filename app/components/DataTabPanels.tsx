'use client'

import { useState } from 'react'
import type { ResumeData } from '@/lib/profile'
import { LANGUAGE_LEVELS } from '@/lib/profile'
import { Button } from '@/app/components/ui/button'

export interface DataTabHandlers {
  updateIdentity: (field: keyof ResumeData['identity'], value: string) => void
  updateLink: (index: number, url: string) => void
  addLink: (url?: string) => void
  removeLink: (index: number) => void
  updateSummary: (value: string) => void
  updateExperience: (index: number, field: 'title' | 'company' | 'dates', value: string) => void
  updateBullet: (expIndex: number, bulletIndex: number, text: string) => void
  addBullet: (expIndex: number) => void
  removeBullet: (expIndex: number, bulletIndex: number) => void
  addExperience: () => void
  removeExperience: (index: number) => void
  addSkill: (name: string) => void
  removeSkill: (index: number) => void
  updateSkill: (index: number, name: string) => void
  addEducation: () => void
  removeEducation: (index: number) => void
  updateEducation: (index: number, field: 'institution' | 'degree' | 'field_of_study' | 'dates', value: string) => void
  addAchievement: () => void
  removeAchievement: (index: number) => void
  updateAchievement: (index: number, field: 'title' | 'issuer' | 'date', value: string) => void
  addLanguage: () => void
  removeLanguage: (index: number) => void
  updateLanguage: (index: number, field: 'language' | 'level', value: string) => void
  addAdditionalSection: () => void
  removeAdditionalSection: (index: number) => void
  updateAdditionalSectionTitle: (index: number, title: string) => void
  addAdditionalSectionItem: (sectionIndex: number) => void
  removeAdditionalSectionItem: (sectionIndex: number, itemIndex: number) => void
  updateAdditionalSectionItem: (sectionIndex: number, itemIndex: number, value: string) => void
}

function empty(s: string | undefined | null): boolean {
  return s === undefined || s === null || String(s).trim() === ''
}

export function ContactPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const nameMissing = empty(data.identity.name)
  const emailMissing = empty(data.identity.email)
  const phoneMissing = empty(data.identity.phone)
  const locationMissing = empty(data.identity.location)
  return (
    <div className="data-chunk-group" role="tabpanel">
      <p className="data-panel-purpose">
        How employers reach you and where you’re based—used in search filters and document headers.
      </p>
      <div className="data-chunk-card data-chunk-contact">
        <div className={`data-chunk-field${nameMissing ? ' incomplete' : ''}`} data-incomplete-hint={nameMissing ? 'Add name' : undefined}>
          <label>Name</label>
          <input type="text" value={data.identity.name} onChange={(e) => h.updateIdentity('name', e.target.value)} placeholder="Full name" />
        </div>
        <div className={`data-chunk-field${emailMissing ? ' incomplete' : ''}`} data-incomplete-hint={emailMissing ? 'Add email' : undefined}>
          <label>Email</label>
          <input type="text" value={data.identity.email} onChange={(e) => h.updateIdentity('email', e.target.value)} placeholder="email@example.com" />
        </div>
        <div className={`data-chunk-field${phoneMissing ? ' incomplete' : ''}`} data-incomplete-hint={phoneMissing ? 'Add phone' : undefined}>
          <label>Phone</label>
          <input type="text" value={data.identity.phone} onChange={(e) => h.updateIdentity('phone', e.target.value)} placeholder="+1 234 567 8900" />
        </div>
        <div className={`data-chunk-field${locationMissing ? ' incomplete' : ''}`} data-incomplete-hint={locationMissing ? 'Add location' : undefined}>
          <label>Location</label>
          <input type="text" value={data.identity.location} onChange={(e) => h.updateIdentity('location', e.target.value)} placeholder="City, State / Country" />
        </div>
      </div>
    </div>
  )
}

export function LinksPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const [newUrl, setNewUrl] = useState('')
  const links = data.links ?? []
  const linksMissing = links.length === 0
  const handleAdd = () => {
    const u = newUrl.trim()
    if (u) h.addLink(u)
    setNewUrl('')
  }
  return (
    <div className={`data-chunk-group links-panel${linksMissing ? ' incomplete' : ''}`} role="tabpanel">
      <div className="links-panel-header">
        <h3 className="links-panel-title">URLs</h3>
        <p className="links-panel-desc">
          LinkedIn, portfolio, GitHub—helps match you to listings and fills link sections in tailored resumes and cover letters.
        </p>
      </div>
      <div className="links-add-row">
        <input
          type="url"
          className="links-input"
          placeholder="Paste or type URL…"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <Button type="button" className="links-add-btn h-10 shrink-0 px-[18px] text-sm font-medium" onClick={handleAdd}>
          Add
        </Button>
      </div>
      {links.length === 0 ? (
        <p className="links-empty">{linksMissing ? 'Add links (e.g. LinkedIn, portfolio, GitHub).' : 'No links yet. Add your LinkedIn, portfolio, or other URLs above.'}</p>
      ) : (
        <ul className="links-list">
          {links.map((link, i) => (
            <li key={i} className="links-list-item">
              <input
                type="url"
                value={link.url}
                onChange={(e) => h.updateLink(i, e.target.value)}
                className="links-list-edit"
                placeholder="https://…"
              />
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="links-list-open" title="Open">↗</a>
              <button type="button" className="links-remove" onClick={() => h.removeLink(i)} title="Remove" aria-label="Remove link">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SummaryPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const summaryMissing = empty(data.summary)
  return (
    <div className={`data-chunk-group${summaryMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        A short positioning statement—drives fit scoring and strong opening lines in tailored documents.
      </p>
      <div className="data-chunk-card">
        <textarea className={`data-chunk-summary${summaryMissing ? ' incomplete' : ''}`} value={data.summary} onChange={(e) => h.updateSummary(e.target.value)} placeholder="2–4 sentences: role level, key strengths, what you're targeting." rows={4} aria-invalid={summaryMissing} />
        {summaryMissing && <span className="incomplete-badge">Add summary</span>}
      </div>
    </div>
  )
}

export function ExperiencePanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const experienceMissing = (data.experience ?? []).length === 0
  return (
    <div className={`data-chunk-group${experienceMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        Roles and impact employers scan first; we reuse bullets when tailoring resumes and cover letters.
      </p>
      <div className="data-chunk-group-head">
        <Button type="button" variant="outline" size="sm" onClick={h.addExperience}>+ Add position</Button>
        {experienceMissing && <span className="incomplete-badge">Add experience</span>}
      </div>
      {data.experience.length === 0 && experienceMissing ? (
        <p className="data-empty-hint" style={{ marginTop: 8 }}>Add at least one position.</p>
      ) : null}
      {data.experience.map((exp, i) => (
        <div key={exp.id} className="data-chunk-card data-chunk-experience">
          <div className="data-chunk-exp-header">
            <input type="text" value={exp.title} onChange={(e) => h.updateExperience(i, 'title', e.target.value)} placeholder="Job title" className="data-chunk-exp-title" />
            <input type="text" value={exp.company} onChange={(e) => h.updateExperience(i, 'company', e.target.value)} placeholder="Company" className="data-chunk-exp-company" />
            <input type="text" value={exp.dates} onChange={(e) => h.updateExperience(i, 'dates', e.target.value)} placeholder="Dates" className="data-chunk-exp-dates" />
            <button type="button" className="data-chunk-remove" onClick={() => h.removeExperience(i)} title="Remove position">×</button>
          </div>
          <div className="data-chunk-bullets">
            <span className="data-chunk-bullets-label">Bullets</span>
            {(exp.bullets || []).map((b, j) => (
              <div key={b.id} className="data-chunk-bullet-row">
                <input type="text" value={b.text} onChange={(e) => h.updateBullet(i, j, e.target.value)} placeholder="Quantified achievement or responsibility…" className="data-chunk-bullet-input" />
                <button type="button" className="data-chunk-remove small" onClick={() => h.removeBullet(i, j)} title="Remove">×</button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="data-chunk-add-bullet" onClick={() => h.addBullet(i)}>+ Add bullet</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function EducationPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.education ?? []
  const educationMissing = list.length === 0
  return (
    <div className={`data-chunk-group${educationMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        Degrees and schools that signal level and eligibility in search and on your resume.
      </p>
      <div className="data-chunk-group-head">
        <Button type="button" variant="outline" size="sm" onClick={h.addEducation}>+ Add education</Button>
        {educationMissing && <span className="incomplete-badge">Add education</span>}
      </div>
      {list.length === 0 && educationMissing ? (
        <p className="data-empty-hint" style={{ marginTop: 8 }}>Add at least one degree or credential.</p>
      ) : null}
      {list.map((edu, i) => (
        <div key={edu.id} className="data-chunk-card data-chunk-education">
          <div className="data-chunk-edu-row">
            <input type="text" value={edu.institution} onChange={(e) => h.updateEducation(i, 'institution', e.target.value)} placeholder="Institution" />
            <input type="text" value={edu.degree} onChange={(e) => h.updateEducation(i, 'degree', e.target.value)} placeholder="Degree" />
            <input type="text" value={edu.field_of_study} onChange={(e) => h.updateEducation(i, 'field_of_study', e.target.value)} placeholder="Field of study" />
            <input type="text" value={edu.dates} onChange={(e) => h.updateEducation(i, 'dates', e.target.value)} placeholder="Dates" className="data-chunk-dates" />
            <button type="button" className="data-chunk-remove" onClick={() => h.removeEducation(i)} title="Remove">×</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AchievementsPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.achievements ?? []
  const achievementsMissing = list.length === 0
  return (
    <div className={`data-chunk-group${achievementsMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        Awards and certifications that add credibility beyond employment for matching and documents.
      </p>
      <div className="data-chunk-group-head">
        <Button type="button" variant="outline" size="sm" onClick={h.addAchievement}>+ Add achievement</Button>
        {achievementsMissing && <span className="incomplete-badge">Add achievements</span>}
      </div>
      {list.map((a, i) => (
        <div key={a.id} className="data-chunk-card data-chunk-achievement">
          <div className="data-chunk-ach-row">
            <input type="text" value={a.title} onChange={(e) => h.updateAchievement(i, 'title', e.target.value)} placeholder="Award or certification name" />
            <input type="text" value={a.issuer} onChange={(e) => h.updateAchievement(i, 'issuer', e.target.value)} placeholder="Issuer" />
            <input type="text" value={a.date} onChange={(e) => h.updateAchievement(i, 'date', e.target.value)} placeholder="Date" className="data-chunk-dates" />
            <button type="button" className="data-chunk-remove" onClick={() => h.removeAchievement(i)} title="Remove">×</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkillsPanel({ data, h, newSkillName, setNewSkillName }: { data: ResumeData; h: DataTabHandlers; newSkillName: string; setNewSkillName: (v: string) => void }) {
  const skillsMissing = data.skills.length === 0
  return (
    <div className={`data-chunk-group${skillsMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        Keywords that overlap with job posts and populate skills sections in tailored outputs.
      </p>
      {skillsMissing && (
        <div className="data-chunk-group-head" style={{ marginBottom: 8 }}>
          <span className="incomplete-badge">Add skills</span>
        </div>
      )}
      <div className="data-chunk-skills">
        {data.skills.map((s, i) => (
          <div key={s.id} className="data-chunk-skill-chip">
            <input type="text" value={s.name} onChange={(e) => h.updateSkill(i, e.target.value)} className="data-chunk-skill-input" placeholder="Skill" />
            <button type="button" className="data-chunk-remove small" onClick={() => h.removeSkill(i)} title="Remove">×</button>
          </div>
        ))}
        <div className="data-chunk-skill-add">
          <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), h.addSkill(newSkillName))} placeholder="+ Add skill" className="data-chunk-skill-add-input" />
          <Button type="button" variant="outline" size="sm" onClick={() => h.addSkill(newSkillName)} disabled={!newSkillName.trim()}>Add</Button>
        </div>
      </div>
    </div>
  )
}

export function LanguagesPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.languages ?? []
  const languagesMissing = list.length === 0
  return (
    <div className={`data-chunk-group${languagesMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        Languages and proficiency—used for multilingual-role matching and accurate wording.
      </p>
      <div className="data-chunk-group-head">
        <Button type="button" variant="outline" size="sm" onClick={h.addLanguage}>+ Add language</Button>
        {languagesMissing && <span className="incomplete-badge">Add languages</span>}
      </div>
      {list.map((lang, i) => (
        <div key={lang.id} className="data-chunk-card data-chunk-language">
          <div className="data-chunk-lang-row">
            <input type="text" value={lang.language} onChange={(e) => h.updateLanguage(i, 'language', e.target.value)} placeholder="Language" />
            <select
              value={LANGUAGE_LEVELS.includes(lang.level as typeof LANGUAGE_LEVELS[number]) ? lang.level : 'other'}
              onChange={(e) => h.updateLanguage(i, 'level', e.target.value)}
              className="data-chunk-lang-level"
              title="Proficiency level"
            >
              {LANGUAGE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl.charAt(0).toUpperCase() + lvl.slice(1)}</option>
              ))}
            </select>
            <button type="button" className="data-chunk-remove" onClick={() => h.removeLanguage(i)} title="Remove">×</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdditionalPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.additional ?? []
  const additionalMissing = list.length === 0
  return (
    <div className={`data-chunk-group${additionalMissing ? ' incomplete' : ''}`} role="tabpanel">
      <p className="data-panel-purpose">
        Optional sections—volunteering, licenses, interests—for niche fit and extra resume blocks.
      </p>
      <div className="data-chunk-group-head">
        <Button type="button" variant="outline" size="sm" onClick={h.addAdditionalSection}>+ Add a section</Button>
        {additionalMissing && <span className="incomplete-badge">Add section</span>}
      </div>
      <p className="data-section-hint data-additional-hint">Each section has a title and a list of items.</p>
      {list.map((sec, si) => (
        <div key={sec.id} className="data-chunk-card data-chunk-additional">
          <div className="data-chunk-additional-head">
            <input type="text" value={sec.title} onChange={(e) => h.updateAdditionalSectionTitle(si, e.target.value)} placeholder="Section title (e.g. Community & Sports)" className="data-chunk-additional-title" />
            <button type="button" className="data-chunk-remove" onClick={() => h.removeAdditionalSection(si)} title="Remove section">×</button>
          </div>
          <div className="data-chunk-additional-content">
            {sec.content.map((item, ii) => (
              <div key={ii} className="data-chunk-additional-item">
                <input type="text" value={item} onChange={(e) => h.updateAdditionalSectionItem(si, ii, e.target.value)} placeholder="One line" />
                <button type="button" className="data-chunk-remove small" onClick={() => h.removeAdditionalSectionItem(si, ii)} title="Remove">×</button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => h.addAdditionalSectionItem(si)}>+ Add item</Button>
          </div>
        </div>
      ))}
    </div>
  )
}
