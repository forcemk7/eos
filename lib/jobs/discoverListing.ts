export interface DiscoverListing {
  external_id: string | null
  source: string
  title: string
  company: string
  url: string | null
  location: string | null
  remote: boolean
  description: string | null
  snippet: string | null
  posted_at: string | null
  raw: Record<string, unknown>
}

/** Persisted apply state merged in GET /api/jobs/discover (same shape + server listing id + apply columns). */
/** Full job description text for tailoring / fit (matches job detail body). */
export function jdTextFromListing(l: Pick<DiscoverListing, 'description' | 'snippet'>): string {
  return l.description?.trim() || l.snippet?.trim() || ''
}

export type DiscoverListingWithApply = DiscoverListing & {
  /** Same key stored in job_listings.external_id (JSearch id or legacy:hash). */
  stable_external_id: string
  listing_id: string | null
  apply_outbound_at: string | null
  apply_decision: string | null
  apply_decision_at: string | null
  apply_notes: string | null
  apply_remind_at: string | null
  pipeline_stage: string | null
}
