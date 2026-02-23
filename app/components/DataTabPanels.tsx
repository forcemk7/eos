'use client'

import type { ResumeData } from '@/lib/profile'

export interface DataTabHandlers {
  updateIdentity: (field: keyof Omit<ResumeData['identity'], 'links'>, value: string) => void
  updateLink: (index: number, field: 'label' | 'url', value: string) => void
  addLink: () => void
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

export function ContactPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-card data-chunk-contact">
        <div className="data-chunk-field">
          <label>Name</label>
          <input type="text" value={data.identity.name} onChange={(e) => h.updateIdentity('name', e.target.value)} placeholder="Full name" />
        </div>
        <div className="data-chunk-field">
          <label>Email</label>
          <input type="text" value={data.identity.email} onChange={(e) => h.updateIdentity('email', e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="data-chunk-field">
          <label>Phone</label>
          <input type="text" value={data.identity.phone} onChange={(e) => h.updateIdentity('phone', e.target.value)} placeholder="+1 234 567 8900" />
        </div>
        <div className="data-chunk-field">
          <label>Location</label>
          <input type="text" value={data.identity.location} onChange={(e) => h.updateIdentity('location', e.target.value)} placeholder="City, State / Country" />
        </div>
        <div className="data-chunk-field">
          <div className="data-chunk-links-head">
            <span className="data-chunk-field-label">Links</span>
            <button type="button" className="secondary-button small" onClick={h.addLink}>+ Add link</button>
          </div>
          {(data.identity.links ?? []).map((link, i) => (
            <div key={i} className="data-chunk-link-row">
              <input type="text" value={link.label} onChange={(e) => h.updateLink(i, 'label', e.target.value)} placeholder="Label (e.g. LinkedIn)" className="data-chunk-link-label" />
              <input type="url" value={link.url} onChange={(e) => h.updateLink(i, 'url', e.target.value)} placeholder="https://..." className="data-chunk-link-url" />
              <button type="button" className="data-chunk-remove small" onClick={() => h.removeLink(i)} title="Remove link">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SummaryPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-card">
        <textarea className="data-chunk-summary" value={data.summary} onChange={(e) => h.updateSummary(e.target.value)} placeholder="2–4 sentences: role level, key strengths, what you're targeting." rows={4} />
      </div>
    </div>
  )
}

export function ExperiencePanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-group-head">
        <button type="button" className="secondary-button small" onClick={h.addExperience}>+ Add position</button>
      </div>
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
            <button type="button" className="secondary-button small data-chunk-add-bullet" onClick={() => h.addBullet(i)}>+ Add bullet</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function EducationPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.education ?? []
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-group-head">
        <button type="button" className="secondary-button small" onClick={h.addEducation}>+ Add education</button>
      </div>
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
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-group-head">
        <button type="button" className="secondary-button small" onClick={h.addAchievement}>+ Add achievement</button>
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
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-skills">
        {data.skills.map((s, i) => (
          <div key={s.id} className="data-chunk-skill-chip">
            <input type="text" value={s.name} onChange={(e) => h.updateSkill(i, e.target.value)} className="data-chunk-skill-input" placeholder="Skill" />
            <button type="button" className="data-chunk-remove small" onClick={() => h.removeSkill(i)} title="Remove">×</button>
          </div>
        ))}
        <div className="data-chunk-skill-add">
          <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), h.addSkill(newSkillName))} placeholder="+ Add skill" className="data-chunk-skill-add-input" />
          <button type="button" className="secondary-button small" onClick={() => h.addSkill(newSkillName)} disabled={!newSkillName.trim()}>Add</button>
        </div>
      </div>
    </div>
  )
}

export function LanguagesPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.languages ?? []
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-group-head">
        <button type="button" className="secondary-button small" onClick={h.addLanguage}>+ Add language</button>
      </div>
      {list.map((lang, i) => (
        <div key={lang.id} className="data-chunk-card data-chunk-language">
          <div className="data-chunk-lang-row">
            <input type="text" value={lang.language} onChange={(e) => h.updateLanguage(i, 'language', e.target.value)} placeholder="Language" />
            <input type="text" value={lang.level} onChange={(e) => h.updateLanguage(i, 'level', e.target.value)} placeholder="Level (e.g. Native, Fluent, Intermediate)" className="data-chunk-lang-level" />
            <button type="button" className="data-chunk-remove" onClick={() => h.removeLanguage(i)} title="Remove">×</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdditionalPanel({ data, h }: { data: ResumeData; h: DataTabHandlers }) {
  const list = data.additional ?? []
  return (
    <div className="data-chunk-group" role="tabpanel">
      <div className="data-chunk-group-head">
        <button type="button" className="secondary-button small" onClick={h.addAdditionalSection}>+ Add a section</button>
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
            <button type="button" className="secondary-button small" onClick={() => h.addAdditionalSectionItem(si)}>+ Add item</button>
          </div>
        </div>
      ))}
    </div>
  )
}
