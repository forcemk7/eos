import type { DiscoverListingWithApply } from './discoverListing'
import type { JobListingRow } from './jobListingRow'
import { stableExternalId } from './stableExternalId'

export function listingToSyncBody(l: DiscoverListingWithApply) {
  return {
    external_id: l.external_id,
    source: l.source,
    title: l.title,
    company: l.company,
    url: l.url,
    location: l.location,
    remote: l.remote,
    description: l.description,
    snippet: l.snippet,
    posted_at: l.posted_at,
    raw: l.raw,
  }
}

export type SyncedDiscoverListingResult = {
  listingId: string
  stable_external_id: string
  row: JobListingRow | null
}

/** Ensures a discover listing row exists; returns DB id for cross-feature links (cover letter, applications). */
export async function ensureDiscoverListingSynced(
  job: DiscoverListingWithApply
): Promise<SyncedDiscoverListingResult | null> {
  if (job.listing_id) {
    return {
      listingId: job.listing_id,
      stable_external_id: job.stable_external_id,
      row: null,
    }
  }
  try {
    const res = await fetch('/api/jobs/sync-discover', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listingToSyncBody(job)),
    })
    const data = await res.json()
    if (!res.ok || !data.success || !data.listing?.id) return null
    const row = data.listing as JobListingRow
    return {
      listingId: row.id,
      stable_external_id: stableExternalId({
        external_id: row.external_id,
        source: row.source,
        title: row.title,
        company: row.company,
        url: row.url,
      }),
      row,
    }
  } catch {
    return null
  }
}
