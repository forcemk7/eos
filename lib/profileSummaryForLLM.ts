/**
 * Build a short text summary of an AssembledProfile for LLM prompts (e.g. job qualifications).
 * Keeps the prompt small: location, truncated summary, experience titles, skills, education.
 */

import type { AssembledProfile } from './profile'

const SUMMARY_MAX_LEN = 400
const EXPERIENCE_MAX_ITEMS = 10
const SKILLS_MAX = 30

export function buildProfileSummaryForLLM(profile: AssembledProfile): string {
  const parts: string[] = []

  if (profile.identity?.location?.trim()) {
    parts.push(`Location: ${profile.identity.location.trim()}`)
  }

  if (profile.summary?.trim()) {
    const summary = profile.summary.trim()
    parts.push(
      summary.length > SUMMARY_MAX_LEN ? `${summary.slice(0, SUMMARY_MAX_LEN)}…` : summary
    )
  }

  if (profile.experience?.length) {
    const lines = profile.experience
      .slice(0, EXPERIENCE_MAX_ITEMS)
      .map((e) => `${e.title} at ${e.company} (${e.dates || '—'})`)
    parts.push('Experience: ' + lines.join('; '))
  }

  if (profile.skills?.length) {
    const names = profile.skills
      .slice(0, SKILLS_MAX)
      .map((s) => s.name)
      .filter(Boolean)
    if (names.length) parts.push('Skills: ' + names.join(', '))
  }

  if (profile.education?.length) {
    const lines = profile.education.map(
      (e) => [e.degree, e.field_of_study, e.institution].filter(Boolean).join(' – ')
    )
    if (lines.length) parts.push('Education: ' + lines.join('; '))
  }

  if (profile.languages?.length) {
    const lines = profile.languages.map((l) => `${l.language} (${l.level})`)
    parts.push('Languages: ' + lines.join(', '))
  }

  return parts.join('\n\n')
}
