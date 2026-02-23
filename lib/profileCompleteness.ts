/**
 * Profile completeness: missing items at data-point level, aggregated to tab and dashboard.
 * Used to show incomplete indicators exactly where data is missing, then roll up to tab badges and dashboard strip.
 */

import type { ResumeData } from '@/lib/profile'

export type TabId = 'data' | 'jobs' | 'resume'

export interface MissingItem {
  id: string
  label: string
  location: TabId
}

export interface ProfileCompleteness {
  missingItems: MissingItem[]
  byTab: Record<TabId, number>
  total: number
}

const DATA_MISSING_IDS = {
  identity_name: 'identity.name',
  identity_email: 'identity.email',
  identity_phone: 'identity.phone',
  identity_location: 'identity.location',
  links: 'links',
  summary: 'summary',
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  achievements: 'achievements',
  languages: 'languages',
  additional: 'additional',
} as const

/** Exported for use in DataTabPanels to style incomplete fields. */
export const MISSING_IDS = DATA_MISSING_IDS

/** Context passed to panels for incomplete indicators. */
export interface IncompleteContext {
  missingSet?: Set<string>
}

/** Returns true if the given missing set contains the id (field is incomplete). */
export function fieldIncomplete(missingSet: Set<string> | undefined, id: string): boolean {
  return missingSet != null && missingSet.has(id)
}

function empty(s: string | undefined | null): boolean {
  return s === undefined || s === null || String(s).trim() === ''
}

/** Lightweight: returns only the data-tab incomplete count (no array/Set). Use for tab badge and dashboard. */
export function getDataIncompleteCount(data: ResumeData | null): number {
  if (!data) return 12
  let n = 0
  const identity = data.identity ?? { name: '', email: '', phone: '', location: '' }
  if (empty(identity.name)) n++
  if (empty(identity.email)) n++
  if (empty(identity.phone)) n++
  if (empty(identity.location)) n++
  if (!(data.links ?? []).length) n++
  if (empty(data.summary)) n++
  if (!(data.experience ?? []).length) n++
  if (!(data.education ?? []).length) n++
  if (!(data.skills ?? []).length) n++
  if (!(data.achievements ?? []).length) n++
  if (!(data.languages ?? []).length) n++
  if (!(data.additional ?? []).length) n++
  return n
}

/**
 * Given current profile data and whether user has a resume, returns missing items (with stable ids),
 * counts per tab, and total for dashboard.
 */
export function getProfileCompleteness(data: ResumeData | null, hasResume: boolean): ProfileCompleteness {
  const missingItems: MissingItem[] = []
  const location: TabId = 'data'

  if (!data) {
    // No profile data at all: all data-section items missing
    missingItems.push(
      { id: DATA_MISSING_IDS.identity_name, label: 'Name', location },
      { id: DATA_MISSING_IDS.identity_email, label: 'Email', location },
      { id: DATA_MISSING_IDS.identity_phone, label: 'Phone', location },
      { id: DATA_MISSING_IDS.identity_location, label: 'Location', location },
      { id: DATA_MISSING_IDS.links, label: 'Links', location },
      { id: DATA_MISSING_IDS.summary, label: 'Summary', location },
      { id: DATA_MISSING_IDS.experience, label: 'Experience', location },
      { id: DATA_MISSING_IDS.education, label: 'Education', location },
      { id: DATA_MISSING_IDS.skills, label: 'Skills', location },
      { id: DATA_MISSING_IDS.achievements, label: 'Achievements', location },
      { id: DATA_MISSING_IDS.languages, label: 'Languages', location },
      { id: DATA_MISSING_IDS.additional, label: 'Additional', location }
    )
  } else {
    const identity = data.identity ?? { name: '', email: '', phone: '', location: '' }
    if (empty(identity.name)) missingItems.push({ id: DATA_MISSING_IDS.identity_name, label: 'Name', location })
    if (empty(identity.email)) missingItems.push({ id: DATA_MISSING_IDS.identity_email, label: 'Email', location })
    if (empty(identity.phone)) missingItems.push({ id: DATA_MISSING_IDS.identity_phone, label: 'Phone', location })
    if (empty(identity.location)) missingItems.push({ id: DATA_MISSING_IDS.identity_location, label: 'Location', location })
    if (!(data.links ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.links, label: 'Links', location })
    if (empty(data.summary)) missingItems.push({ id: DATA_MISSING_IDS.summary, label: 'Summary', location })
    if (!(data.experience ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.experience, label: 'Experience', location })
    if (!(data.education ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.education, label: 'Education', location })
    if (!(data.skills ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.skills, label: 'Skills', location })
    if (!(data.achievements ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.achievements, label: 'Achievements', location })
    if (!(data.languages ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.languages, label: 'Languages', location })
    if (!(data.additional ?? []).length) missingItems.push({ id: DATA_MISSING_IDS.additional, label: 'Additional', location })
  }

  const dataCount = missingItems.length
  const resumeCount = hasResume ? 0 : 1
  if (!hasResume) {
    missingItems.push({ id: 'resume.upload', label: 'Upload resume', location: 'resume' })
  }

  return {
    missingItems,
    byTab: { data: dataCount, jobs: 0, resume: resumeCount },
    total: dataCount + resumeCount,
  }
}

/** Set of missing item ids for quick lookup (e.g. to style a field as incomplete). */
export function missingIdsSet(completeness: ProfileCompleteness): Set<string> {
  return new Set(completeness.missingItems.map((m) => m.id))
}
