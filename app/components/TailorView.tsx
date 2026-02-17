'use client'

import { useState } from 'react'
import type { ResumeData } from './ResumeEditor'
import { exportResumeToPdf } from '@/lib/exportResumePdf'
import { exportCoverLetterToPdf } from '@/lib/exportCoverLetterPdf'

interface TailorViewProps {
  resumeData: ResumeData
  onSaveVersion: (data: ResumeData) => Promise<void>
}

export default function TailorView({ resumeData, onSaveVersion }: TailorViewProps) {
  const [jobDescription, setJobDescription] = useState('')
  const [tailoredResume, setTailoredResume] = useState<ResumeData | null>(null)
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTailor() {
    if (!jobDescription.trim()) return
    setLoading(true)
    setError(null)
    setTailoredResume(null)
    setCoverLetter(null)

    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData, jobDescription }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Tailoring failed')
      }
      setTailoredResume(data.tailoredResume)
      setCoverLetter(data.coverLetter)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveVersion() {
    if (!tailoredResume) return
    setSaving(true)
    try {
      await onSaveVersion(tailoredResume)
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleExportResumePdf() {
    if (!tailoredResume) return
    const name = (tailoredResume.identity.name || 'resume').trim().replace(/\s+/g, '-')
    exportResumeToPdf(tailoredResume, `${name}-tailored.pdf`)
  }

  function handleExportCoverLetterPdf() {
    if (!coverLetter) return
    const name = (tailoredResume?.identity.name || 'cover-letter').trim().replace(/\s+/g, '-')
    exportCoverLetterToPdf(coverLetter, `${name}-cover-letter.pdf`)
  }

  return (
    <div className="tailor-view">
      <div className="tailor-input-section panel">
        <h2>Tailor for a Job</h2>
        <p className="panel-subtitle">
          Paste a job description below. AI will rewrite your resume to match and generate a cover letter.
        </p>
        <textarea
          className="tailor-jd-input"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here…"
          rows={10}
        />
        <button
          type="button"
          className="primary-button tailor-button"
          onClick={handleTailor}
          disabled={loading || !jobDescription.trim()}
        >
          {loading ? 'Tailoring…' : 'Tailor resume + cover letter'}
        </button>
        {error && <p className="error-box">{error}</p>}
      </div>

      {tailoredResume && (
        <div className="tailor-results">
          <div className="tailor-result-section panel">
            <div className="tailor-result-header">
              <h2>Tailored Resume</h2>
              <div className="tailor-result-actions">
                <button type="button" className="secondary-button" onClick={handleExportResumePdf}>
                  Export PDF
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSaveVersion}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save as version'}
                </button>
              </div>
            </div>
            <div className="tailor-resume-preview">
              <div className="tailor-preview-identity">
                <h3>{tailoredResume.identity.name}</h3>
                <p className="tailor-preview-meta">
                  {[tailoredResume.identity.email, tailoredResume.identity.location]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {tailoredResume.summary && (
                <div className="tailor-preview-section">
                  <h4>Summary</h4>
                  <p>{tailoredResume.summary}</p>
                </div>
              )}
              {tailoredResume.experience?.length > 0 && (
                <div className="tailor-preview-section">
                  <h4>Experience</h4>
                  {tailoredResume.experience.map((exp, i) => (
                    <div key={i} className="tailor-preview-exp">
                      <div className="tailor-preview-exp-header">
                        <strong>{exp.title}</strong>
                        {exp.company && <span> — {exp.company}</span>}
                      </div>
                      {exp.dates && <div className="tailor-preview-exp-dates">{exp.dates}</div>}
                      {exp.bullets?.length > 0 && (
                        <ul>
                          {exp.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {tailoredResume.skills?.length > 0 && (
                <div className="tailor-preview-section">
                  <h4>Skills</h4>
                  <p>{tailoredResume.skills.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {coverLetter && (
            <div className="tailor-result-section panel">
              <div className="tailor-result-header">
                <h2>Cover Letter</h2>
                <button type="button" className="secondary-button" onClick={handleExportCoverLetterPdf}>
                  Export PDF
                </button>
              </div>
              <div className="tailor-cover-letter">
                {coverLetter.split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00A0'}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
