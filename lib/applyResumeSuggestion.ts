import type { ResumeData } from '@/lib/profile'
import { genId } from '@/lib/profile'

export interface ResumeSuggestion {
  id: string
  path: string
  currentValue: string
  suggestedValue: string
  reason: string
}

/** Applies a single suggestion to a copy of resume data. Paths: identity.*, summary, skills, experience.N.title|company|dates|bullets. */
export function applyResumeSuggestion(
  data: ResumeData,
  suggestion: { path: string; suggestedValue: string }
): ResumeData {
  const { path, suggestedValue } = suggestion
  const next = JSON.parse(JSON.stringify(data)) as ResumeData

  if (path === 'identity.name') {
    next.identity.name = suggestedValue
    return next
  }
  if (path === 'identity.email') {
    next.identity.email = suggestedValue
    return next
  }
  if (path === 'identity.location') {
    next.identity.location = suggestedValue
    return next
  }
  if (path === 'identity.links') {
    next.identity.links = suggestedValue
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ label: '', url }))
    return next
  }
  if (path === 'summary') {
    next.summary = suggestedValue
    return next
  }
  if (path === 'skills') {
    const names = suggestedValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    next.skills = names.map((name, i) => ({
      id: next.skills[i]?.id ?? genId(),
      name,
      sort_order: i,
    }))
    return next
  }

  const expMatch = path.match(/^experience\.(\d+)\.(title|company|dates|bullets)$/)
  if (expMatch) {
    const idx = parseInt(expMatch[1], 10)
    const field = expMatch[2]
    if (!next.experience[idx]) return next
    if (field === 'bullets') {
      const texts = suggestedValue
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      next.experience[idx].bullets = texts.map((text, i) => ({
        id: next.experience[idx].bullets[i]?.id ?? genId(),
        text,
        sort_order: i,
      }))
    } else {
      ;(next.experience[idx] as any)[field] = suggestedValue
    }
    return next
  }

  return next
}
