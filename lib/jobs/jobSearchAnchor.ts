/**
 * Contract for job discovery filters / ranking; consumers may ignore fields until wired.
 */

import { normalizeTargetKey } from './targetProfileTypes'

export interface JobSearchAnchor {
  primary_query: string
  alternate_queries: string[]
  sectors: string[]
  remote_default: boolean
  location_hint: string | null
  pinned_role_key: string | null
  dismissed_role_keys: string[]
  dismissed_sector_keys: string[]
  generated_at: string
  profile_as_of: string | null
}

export interface TargetRoleRow {
  id: string
  title: string
  rationale: string
  search_terms: string
  stretch?: boolean
}

export interface TargetSectorRow {
  id: string
  name: string
  rationale: string
}

export type JobQualificationsDbRow = {
  search_query?: string | null
  location?: string | null
  remote?: boolean | null
  generated_at?: string | null
  target_roles?: unknown
  target_sectors?: unknown
  profile_as_of?: string | null
  dismissed_role_keys?: unknown
  dismissed_sector_keys?: unknown
  pinned_role_key?: string | null
}

function parseRoles(raw: unknown): TargetRoleRow[] {
  if (!Array.isArray(raw)) return []
  const out: TargetRoleRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const title = typeof o.title === 'string' ? o.title : ''
    const rationale = typeof o.rationale === 'string' ? o.rationale : ''
    const search_terms = typeof o.search_terms === 'string' ? o.search_terms : ''
    if (!id || !title) continue
    out.push({
      id,
      title,
      rationale,
      search_terms,
      stretch: typeof o.stretch === 'boolean' ? o.stretch : undefined,
    })
  }
  return out
}

function parseSectors(raw: unknown): TargetSectorRow[] {
  if (!Array.isArray(raw)) return []
  const out: TargetSectorRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const name = typeof o.name === 'string' ? o.name : ''
    const rationale = typeof o.rationale === 'string' ? o.rationale : ''
    if (!id || !name) continue
    out.push({ id, name, rationale })
  }
  return out
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

/** Visible roles: exclude dismissed keys. */
export function filterRolesByDismissed(roles: TargetRoleRow[], dismissedKeys: string[]): TargetRoleRow[] {
  const set = new Set(dismissedKeys.map(normalizeTargetKey))
  return roles.filter((r) => !set.has(normalizeTargetKey(r.title)))
}

export function filterSectorsByDismissed(sectors: TargetSectorRow[], dismissedKeys: string[]): TargetSectorRow[] {
  const set = new Set(dismissedKeys.map(normalizeTargetKey))
  return sectors.filter((s) => !set.has(normalizeTargetKey(s.name)))
}

export function toJobSearchAnchor(row: JobQualificationsDbRow): JobSearchAnchor {
  const roles = parseRoles(row.target_roles)
  const sectors = parseSectors(row.target_sectors)
  const dismissedRoleKeys = parseStringArray(row.dismissed_role_keys).map(normalizeTargetKey)
  const dismissedSectorKeys = parseStringArray(row.dismissed_sector_keys).map(normalizeTargetKey)
  const visibleRoles = filterRolesByDismissed(roles, dismissedRoleKeys)
  const primary_query =
    (typeof row.search_query === 'string' && row.search_query.trim()) || 'jobs'
  const alternates = visibleRoles
    .map((r) => r.search_terms.trim())
    .filter((q) => q && q !== primary_query)
  const uniqueAlternates = [...new Set(alternates)]

  return {
    primary_query,
    alternate_queries: uniqueAlternates,
    sectors: filterSectorsByDismissed(sectors, dismissedSectorKeys).map((s) => s.name),
    remote_default: Boolean(row.remote ?? true),
    location_hint: typeof row.location === 'string' && row.location.trim() ? row.location.trim() : null,
    pinned_role_key: typeof row.pinned_role_key === 'string' && row.pinned_role_key ? row.pinned_role_key : null,
    dismissed_role_keys: dismissedRoleKeys,
    dismissed_sector_keys: dismissedSectorKeys,
    generated_at:
      typeof row.generated_at === 'string' && row.generated_at
        ? row.generated_at
        : new Date().toISOString(),
    profile_as_of: typeof row.profile_as_of === 'string' ? row.profile_as_of : null,
  }
}

export { parseRoles, parseSectors, parseStringArray }
