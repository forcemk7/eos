/**
 * Richer profile text for target role/sector LLM prompts (achievements, links, additional).
 */

import type { AssembledProfile } from './profile'

const SUMMARY_MAX_LEN = 400
const EXPERIENCE_MAX_ITEMS = 10
const SKILLS_MAX = 30
const ACHIEVEMENTS_MAX = 12
const ADDITIONAL_MAX_SECTIONS = 6
const ADDITIONAL_LINES_PER_SECTION = 4
const LINKS_MAX = 12
const RATIONALE_MAX = 280

export function buildTargetProfileSummaryForLLM(profile: AssembledProfile): string {
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

  if (profile.links?.length) {
    const lines = profile.links.slice(0, LINKS_MAX).map((l) => {
      const k = l.kind ?? 'link'
      const u = (l.url ?? '').trim()
      return u ? `${k}: ${u}` : k
    })
    if (lines.length) parts.push('Links (professional presence):\n' + lines.join('\n'))
  }

  if (profile.experience?.length) {
    const lines = profile.experience.slice(0, EXPERIENCE_MAX_ITEMS).map((e) => {
      const bullets = e.bullets
        .slice(0, 3)
        .map((b) => b.text?.trim())
        .filter(Boolean)
      const bulletStr = bullets.length ? ` — ${bullets.join('; ')}` : ''
      return `${e.title} at ${e.company} (${e.dates || '—'})${bulletStr}`
    })
    parts.push('Experience:\n' + lines.join('\n'))
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

  if (profile.achievements?.length) {
    const lines = profile.achievements.slice(0, ACHIEVEMENTS_MAX).map((a) =>
      [a.title, a.issuer, a.date].filter(Boolean).join(' — ')
    )
    if (lines.length) parts.push('Achievements:\n' + lines.join('\n'))
  }

  if (profile.languages?.length) {
    const lines = profile.languages.map((l) => `${l.language} (${l.level})`)
    parts.push('Languages: ' + lines.join(', '))
  }

  if (profile.additional?.length) {
    const blocks: string[] = []
    for (const s of profile.additional.slice(0, ADDITIONAL_MAX_SECTIONS)) {
      const title = s.title?.trim()
      const content = (s.content ?? [])
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, ADDITIONAL_LINES_PER_SECTION)
      if (title || content.length) {
        blocks.push(
          [title || 'Section', ...content.map((c) => (c.length > RATIONALE_MAX ? c.slice(0, RATIONALE_MAX) + '…' : c))].join('\n')
        )
      }
    }
    if (blocks.length) parts.push('Additional:\n' + blocks.join('\n\n'))
  }

  return parts.join('\n\n')
}
