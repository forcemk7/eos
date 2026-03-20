import { createHash } from 'crypto'

export type DiscoverShape = {
  external_id: string | null
  source: string
  title: string
  company: string
  url: string | null
}

/** Stable key for job_listings.external_id: API id when present, else legacy:sha256 slice. */
export function stableExternalId(listing: DiscoverShape): string {
  const ext = typeof listing.external_id === 'string' ? listing.external_id.trim() : ''
  if (ext) return ext
  const base = `${listing.url ?? ''}|${listing.title}|${listing.company}`
  const h = createHash('sha256').update(base, 'utf8').digest('hex').slice(0, 24)
  return `legacy:${h}`
}
