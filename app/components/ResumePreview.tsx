'use client'

import type { ResumeData } from '@/lib/profile'

export const TEMPLATE_IDS = ['classic', 'compact'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

interface ResumePreviewProps {
  data: ResumeData
  templateId: TemplateId
  className?: string
}

export default function ResumePreview({ data, templateId, className = '' }: ResumePreviewProps) {
  if (templateId === 'compact') {
    return <CompactLayout data={data} className={className} />
  }
  return <ClassicLayout data={data} className={className} />
}

function ClassicLayout({ data, className }: { data: ResumeData; className: string }) {
  const contact = [data.identity.email, data.identity.phone, data.identity.location, ...(data.identity.links || []).map((l) => (typeof l === 'string' ? l : l.url)).filter(Boolean)]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className={`resume-preview resume-preview-classic ${className}`}>
      {data.identity.name && <h1 className="resume-preview-name">{data.identity.name}</h1>}
      {contact && <p className="resume-preview-contact">{contact}</p>}
      {data.summary && (
        <section className="resume-preview-section">
          <h2 className="resume-preview-heading">Summary</h2>
          <p className="resume-preview-summary">{data.summary}</p>
        </section>
      )}
      {data.experience?.length > 0 && (
        <section className="resume-preview-section">
          <h2 className="resume-preview-heading">Experience</h2>
          {data.experience.map((exp, i) => (
            <div key={i} className="resume-preview-exp">
              <div className="resume-preview-exp-header">
                <span className="resume-preview-exp-title">
                  {[exp.title, exp.company].filter(Boolean).join(' — ')}
                </span>
                {exp.dates && <span className="resume-preview-exp-dates">{exp.dates}</span>}
              </div>
              {exp.bullets?.length > 0 && (
                <ul className="resume-preview-bullets">
                  {exp.bullets.map((b, j) => (
                    <li key={b.id ?? j}>{typeof b === 'string' ? b : b.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
      {data.skills?.length > 0 && (
        <section className="resume-preview-section">
          <h2 className="resume-preview-heading">Skills</h2>
          <p className="resume-preview-skills">
            {data.skills.map((s) => (typeof s === 'string' ? s : s.name)).join(', ')}
          </p>
        </section>
      )}
      {(data as any).languages?.length > 0 && (
        <section className="resume-preview-section">
          <h2 className="resume-preview-heading">Languages</h2>
          <p className="resume-preview-languages">
            {(data as any).languages.map((l: { language: string; level: string }) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(', ')}
          </p>
        </section>
      )}
      {(data as any).additional?.length > 0 && (
        <>
          {(data as any).additional.map((sec: { title: string; content: string[] }, i: number) => (
            sec.title || sec.content?.length ? (
              <section key={i} className="resume-preview-section">
                {sec.title && <h2 className="resume-preview-heading">{sec.title}</h2>}
                {sec.content?.length > 0 && (
                  <ul className="resume-preview-bullets">
                    {sec.content.map((item: string, j: number) => (item ? <li key={j}>{item}</li> : null))}
                  </ul>
                )}
              </section>
            ) : null
          ))}
        </>
      )}
    </div>
  )
}

function CompactLayout({ data, className }: { data: ResumeData; className: string }) {
  const contact = [data.identity.email, data.identity.phone, data.identity.location, ...(data.identity.links || []).map((l) => (typeof l === 'string' ? l : l.url)).filter(Boolean)]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className={`resume-preview resume-preview-compact ${className}`}>
      <aside className="resume-preview-sidebar">
        {data.identity.name && <h1 className="resume-preview-name">{data.identity.name}</h1>}
        {contact && <p className="resume-preview-contact">{contact}</p>}
        {data.skills?.length > 0 && (
          <section className="resume-preview-section">
            <h2 className="resume-preview-heading">Skills</h2>
            <p className="resume-preview-skills">
              {data.skills.map((s) => (typeof s === 'string' ? s : s.name)).join(', ')}
            </p>
          </section>
        )}
      </aside>
      <main className="resume-preview-main">
        {data.summary && (
          <section className="resume-preview-section">
            <h2 className="resume-preview-heading">Summary</h2>
            <p className="resume-preview-summary">{data.summary}</p>
          </section>
        )}
        {data.experience?.length > 0 && (
          <section className="resume-preview-section">
            <h2 className="resume-preview-heading">Experience</h2>
            {data.experience.map((exp, i) => (
              <div key={i} className="resume-preview-exp">
                <div className="resume-preview-exp-header">
                  <span className="resume-preview-exp-title">
                    {[exp.title, exp.company].filter(Boolean).join(' — ')}
                  </span>
                  {exp.dates && <span className="resume-preview-exp-dates">{exp.dates}</span>}
                </div>
                {exp.bullets?.length > 0 && (
                  <ul className="resume-preview-bullets">
                    {exp.bullets.map((b, j) => (
                      <li key={b.id ?? j}>{typeof b === 'string' ? b : b.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}
        {(data as any).languages?.length > 0 && (
          <section className="resume-preview-section">
            <h2 className="resume-preview-heading">Languages</h2>
            <p className="resume-preview-languages">
              {(data as any).languages.map((l: { language: string; level: string }) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(', ')}
            </p>
          </section>
        )}
        {(data as any).additional?.length > 0 && (
          <>
            {(data as any).additional.map((sec: { title: string; content: string[] }, i: number) => (
              sec.title || sec.content?.length ? (
                <section key={i} className="resume-preview-section">
                  {sec.title && <h2 className="resume-preview-heading">{sec.title}</h2>}
                  {sec.content?.length > 0 && (
                    <ul className="resume-preview-bullets">
                      {sec.content.map((item: string, j: number) => (item ? <li key={j}>{item}</li> : null))}
                    </ul>
                  )}
                </section>
              ) : null
            ))}
          </>
        )}
      </main>
    </div>
  )
}
