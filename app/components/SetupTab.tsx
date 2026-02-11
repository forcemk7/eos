'use client'

import { useState, useEffect } from 'react'

interface Preferences {
  job_titles?: string[]
  keywords?: string[]
  location_type?: string
  location_cities?: string[]
  location_countries?: string[]
  salary_min?: number
  salary_max?: number
  company_size?: string[]
  max_applications_per_day?: number
  automation_enabled?: boolean
  screening_questions?: Record<string, string>
}

export default function SetupTab() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    try {
      const res = await fetch('/api/preferences')
      const data = await res.json()

      if (data.success && data.preferences) {
        setPreferences(data.preferences)
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const jobTitles = (formData.get('jobTitles') as string)?.split('\n').filter((t) => t.trim()) || []
    const keywords = (formData.get('keywords') as string)?.split(',').map((k) => k.trim()).filter((k) => k) || []
    const locationCities = (formData.get('locationCities') as string)?.split(',').map((c) => c.trim()).filter((c) => c) || []
    const companySize = formData.getAll('companySize') as string[]

    let screeningQuestions: Record<string, string> = {}
    try {
      screeningQuestions = JSON.parse((formData.get('screeningQuestions') as string) || '{}')
    } catch (err) {
      alert('Invalid JSON in screening questions. Please fix the format.')
      setSaving(false)
      return
    }

    const prefs = {
      jobTitles,
      keywords,
      locationType: formData.get('locationType') as string,
      locationCities,
      locationCountries: [],
      salaryMin: formData.get('salaryMin') ? parseInt(formData.get('salaryMin') as string) : null,
      salaryMax: formData.get('salaryMax') ? parseInt(formData.get('salaryMax') as string) : null,
      companySize,
      maxApplicationsPerDay: parseInt(formData.get('maxApplicationsPerDay') as string) || 50,
      automationEnabled: formData.get('automationEnabled') === 'on',
      screeningQuestions,
    }

    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })

      const data = await res.json()

      if (data.success) {
        setPreferences(data.preferences)
        alert('Preferences saved successfully! The AI will use these settings for job applications.')
      } else {
        throw new Error(data.error || 'Failed to save preferences')
      }
    } catch (error: any) {
      console.error('Error saving preferences:', error)
      alert('Failed to save preferences: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tab-content active">
        <section className="panel">
          <p>Loading preferences...</p>
        </section>
      </div>
    )
  }

  return (
    <div className="tab-content active">
      <section className="panel">
        <form id="setup-form" onSubmit={handleSubmit}>
          <h2>Job Search Preferences</h2>
          <p className="panel-subtitle">Configure what jobs the AI should apply to for you.</p>

          <div className="field-group">
            <label htmlFor="jobTitles">Job Titles (one per line)</label>
            <textarea
              id="jobTitles"
              name="jobTitles"
              rows={3}
              placeholder="Software Engineer&#10;Full Stack Developer&#10;Senior Developer"
              defaultValue={preferences?.job_titles?.join('\n') || ''}
            />
          </div>

          <div className="field-group">
            <label htmlFor="keywords">Keywords/Skills (comma-separated)</label>
            <input
              type="text"
              id="keywords"
              name="keywords"
              placeholder="React, Node.js, TypeScript, Python"
              defaultValue={preferences?.keywords?.join(', ') || ''}
            />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="locationType">Location Type</label>
              <select id="locationType" name="locationType" defaultValue={preferences?.location_type || 'any'}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
                <option value="any">Any</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="locationCities">Preferred Cities (comma-separated)</label>
              <input
                type="text"
                id="locationCities"
                name="locationCities"
                placeholder="San Francisco, New York, Austin"
                defaultValue={preferences?.location_cities?.join(', ') || ''}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="salaryMin">Min Salary ($)</label>
              <input
                type="number"
                id="salaryMin"
                name="salaryMin"
                placeholder="100000"
                defaultValue={preferences?.salary_min || ''}
              />
            </div>
            <div className="field-group">
              <label htmlFor="salaryMax">Max Salary ($)</label>
              <input
                type="number"
                id="salaryMax"
                name="salaryMax"
                placeholder="200000"
                defaultValue={preferences?.salary_max || ''}
              />
            </div>
          </div>

          <div className="field-group">
            <label>Company Size</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="companySize"
                  value="startup"
                  defaultChecked={preferences?.company_size?.includes('startup')}
                />{' '}
                Startup
              </label>
              <label>
                <input
                  type="checkbox"
                  name="companySize"
                  value="mid"
                  defaultChecked={preferences?.company_size?.includes('mid')}
                />{' '}
                Mid-size
              </label>
              <label>
                <input
                  type="checkbox"
                  name="companySize"
                  value="large"
                  defaultChecked={preferences?.company_size?.includes('large')}
                />{' '}
                Large
              </label>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="maxApplicationsPerDay">Max Applications Per Day</label>
            <input
              type="number"
              id="maxApplicationsPerDay"
              name="maxApplicationsPerDay"
              min="1"
              max="100"
              defaultValue={preferences?.max_applications_per_day || 50}
            />
          </div>

          <div className="field-group">
            <label>
              <input
                type="checkbox"
                id="automationEnabled"
                name="automationEnabled"
                defaultChecked={preferences?.automation_enabled}
              />
              Enable automated job applications
            </label>
            <p className="hint">When enabled, the AI will automatically apply to matching jobs daily.</p>
          </div>

          <div className="field-group">
            <label htmlFor="screeningQuestions">Common Screening Questions (JSON format)</label>
            <textarea
              id="screeningQuestions"
              name="screeningQuestions"
              rows={5}
              placeholder='{"workAuthorization": "Yes, I am authorized to work in the US", "availability": "Immediately available"}'
              defaultValue={JSON.stringify(preferences?.screening_questions || {}, null, 2)}
            />
            <p className="hint">These answers will be used for all applications. Format as JSON key-value pairs.</p>
          </div>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </section>
    </div>
  )
}
