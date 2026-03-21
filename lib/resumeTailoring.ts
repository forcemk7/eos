import { stableExternalId } from '@/lib/jobs/stableExternalId'

export const JD_SNAPSHOT_MAX_CHARS = 32000

export type JobsBoardTab = 'jobs' | 'ai-jobs'

/** Active “tailor to this listing” session in the Resume tab (from job discovery). */
export type TailorResumeSession = {
  sourceTab: JobsBoardTab
  stable_external_id: string
  listing_id: string | null
  title: string
  company: string
  url: string | null
  jdText: string
}

export type ResumeTailoringPayload = {
  job_listing_id?: string | null
  jd_snapshot?: string | null
  title?: string | null
  company?: string | null
  url?: string | null
  source_tab?: JobsBoardTab | null
}

export type ResumeVersionTailoring = {
  job_listing_id: string | null
  title: string | null
  company: string | null
  url: string | null
  stable_external_id: string | null
  source_tab: JobsBoardTab | null
}

type JobListingJoin = {
  external_id: string | null
  source: string
  title: string
  company: string
  url: string | null
} | null

function normalizeJobListingJoin(raw: unknown): JobListingJoin {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return normalizeJobListingJoin(first)
  }
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    external_id: typeof o.external_id === 'string' ? o.external_id : o.external_id != null ? String(o.external_id) : null,
    source: typeof o.source === 'string' ? o.source : 'jsearch',
    title: typeof o.title === 'string' ? o.title : '',
    company: typeof o.company === 'string' ? o.company : '',
    url: typeof o.url === 'string' ? o.url : null,
  }
}

export function truncateJdSnapshot(text: string): string {
  if (text.length <= JD_SNAPSHOT_MAX_CHARS) return text
  return text.slice(0, JD_SNAPSHOT_MAX_CHARS)
}

function parseSourceTab(v: unknown): JobsBoardTab | null {
  if (v === 'jobs' || v === 'ai-jobs') return v
  return null
}

export function mapRowToVersionTailoring(row: {
  job_listing_id: string | null
  tailored_title: string | null
  tailored_company: string | null
  tailored_url: string | null
  tailored_source_tab: string | null
  job_listings: unknown
}): ResumeVersionTailoring | null {
  const jl = normalizeJobListingJoin(row.job_listings)
  const title = row.tailored_title ?? jl?.title ?? null
  const company = row.tailored_company ?? jl?.company ?? null
  const hasListing = Boolean(row.job_listing_id)
  const hasDenorm = Boolean((title && title.trim()) || (company && company.trim()))
  if (!hasListing && !hasDenorm) return null

  const url = row.tailored_url ?? jl?.url ?? null
  let stable_external_id: string | null = null
  if (jl) {
    stable_external_id = stableExternalId({
      external_id: jl.external_id,
      source: jl.source || 'jsearch',
      title: jl.title || '',
      company: jl.company || '',
      url: jl.url,
    })
  }

  return {
    job_listing_id: row.job_listing_id,
    title,
    company,
    url,
    stable_external_id,
    source_tab: parseSourceTab(row.tailored_source_tab),
  }
}
