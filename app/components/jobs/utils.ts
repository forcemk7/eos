import type { DiscoverListing, DiscoverListingWithApply } from './types'

export function listingKey(job: DiscoverListing, index: number): string {
  const withStable = job as DiscoverListingWithApply
  if (withStable.stable_external_id) return withStable.stable_external_id
  return job.external_id ?? `job-${index}`
}

export function sameListing(a: DiscoverListing, b: DiscoverListing): boolean {
  const sa = (a as DiscoverListingWithApply).stable_external_id
  const sb = (b as DiscoverListingWithApply).stable_external_id
  if (sa && sb) return sa === sb
  if (a.external_id && b.external_id) return a.external_id === b.external_id
  return a.title === b.title && a.company === b.company && (a.url ?? '') === (b.url ?? '')
}

export function formatSourceLabel(source: string): string {
  if (!source.trim()) return 'Listing'
  return source.charAt(0).toUpperCase() + source.slice(1).toLowerCase()
}

export function formatPostedRelative(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = Date.now()
  const diffSec = Math.round((d.getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month')
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year')
}

export type JobSort = 'posted' | 'title'

export function sortListings(listings: DiscoverListing[], sort: JobSort): DiscoverListing[] {
  const copy = [...listings]
  if (sort === 'title') {
    copy.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
    return copy
  }
  copy.sort((a, b) => {
    const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0
    const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0
    return tb - ta
  })
  return copy
}
