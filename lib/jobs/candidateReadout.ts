import { randomUUID } from 'crypto'
import type { ArchetypeSlug } from './archetypeTaxonomy'
import { archetypeLabel, isArchetypeSlug, normalizeArchetypeSelection } from './archetypeTaxonomy'
import { normalizeTargetKey } from './targetProfileTypes'

export type CandidateReadoutTag = {
  id: string
  key: string
  label: string
  rationale: string
  evidence_paths: string[]
}

export type CandidateReadout = {
  generated_at: string
  profile_as_of: string
  primary_archetype: ArchetypeSlug | null
  secondary_archetypes: ArchetypeSlug[]
  tags: CandidateReadoutTag[]
}

export function normalizeReadoutTagKey(label: string): string {
  return normalizeTargetKey(label).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'signal'
}

const READOUT_JSON_BLOCK = `,
  "candidate_readout": {
    "primary_archetype": string,
    "secondary_archetypes": string[],
    "tags": [
      { "key": string, "label": string, "rationale": string, "evidence_paths": string[] }
    ]
  }`

export function candidateReadoutJsonSchemaSnippet(): string {
  return READOUT_JSON_BLOCK
}

export function candidateReadoutRulesForPrompt(): string {
  return `candidate_readout rules:
- primary_archetype: exactly one slug from the allowed list (see user message).
- secondary_archetypes: 0 to 2 additional slugs from the same list, distinct from primary.
- tags: 3 to 8 items. Each key: short snake_case identifier for diffing (e.g. full_stack_web, b2b_saas). Each label: human-readable 2-5 words. rationale: 1-2 sentences; cite profile facts only. evidence_paths: 1-4 dot-paths into the profile JSON (see allowed paths below).
- Allowed evidence_paths roots: identity.name, identity.email, identity.location, summary, skills, experience.N.title, experience.N.company, experience.N.dates, experience.N.bullets, education.N.degree, education.N.institution, achievements.N.title, languages, additional.N.title — use N as 0-based index only when that entry exists.`
}

/** Parse candidate_readout from full LLM JSON object (merged with roles/sectors). */
export function parseCandidateReadoutFromParsedJson(
  parsed: Record<string, unknown>,
  profile_as_of: string,
  generated_at: string
): CandidateReadout {
  const raw = parsed.candidate_readout
  const empty: CandidateReadout = {
    generated_at,
    profile_as_of,
    primary_archetype: null,
    secondary_archetypes: [],
    tags: [],
  }
  if (!raw || typeof raw !== 'object') return empty

  const o = raw as Record<string, unknown>
  const { primary, secondary } = normalizeArchetypeSelection(
    typeof o.primary_archetype === 'string' ? o.primary_archetype : '',
    o.secondary_archetypes
  )

  const tags: CandidateReadoutTag[] = []
  const rawTags = Array.isArray(o.tags) ? o.tags : []
  for (const item of rawTags.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const label = typeof t.label === 'string' ? t.label.trim() : ''
    const rationale = typeof t.rationale === 'string' ? t.rationale.trim() : ''
    const keyRaw = typeof t.key === 'string' ? t.key.trim() : ''
    const key = keyRaw ? normalizeReadoutTagKey(keyRaw) : label ? normalizeReadoutTagKey(label) : ''
    if (!key || !label || !rationale) continue

    const pathsRaw = Array.isArray(t.evidence_paths) ? t.evidence_paths : []
    const evidence_paths = pathsRaw
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim())
      .slice(0, 6)

    if (evidence_paths.length === 0) continue

    tags.push({
      id: randomUUID(),
      key,
      label,
      rationale,
      evidence_paths,
    })
  }
  while (tags.length > 8) tags.pop()

  return {
    generated_at,
    profile_as_of,
    primary_archetype: primary,
    secondary_archetypes: secondary,
    tags,
  }
}

export function parseCandidateReadoutDb(raw: unknown): CandidateReadout | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const generated_at = typeof o.generated_at === 'string' ? o.generated_at : ''
  const profile_as_of = typeof o.profile_as_of === 'string' ? o.profile_as_of : ''
  if (!generated_at || !profile_as_of) return null

  const primaryRaw = typeof o.primary_archetype === 'string' ? o.primary_archetype : null
  const primary = primaryRaw && isArchetypeSlug(primaryRaw) ? primaryRaw : null

  const secRaw = Array.isArray(o.secondary_archetypes) ? o.secondary_archetypes : []
  const secondary_archetypes: ArchetypeSlug[] = []
  for (const x of secRaw) {
    if (typeof x === 'string' && isArchetypeSlug(x) && !secondary_archetypes.includes(x)) {
      secondary_archetypes.push(x)
    }
    if (secondary_archetypes.length >= 2) break
  }

  const tags: CandidateReadoutTag[] = []
  const rawTags = Array.isArray(o.tags) ? o.tags : []
  for (const item of rawTags) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const id = typeof t.id === 'string' ? t.id : randomUUID()
    const key = typeof t.key === 'string' ? t.key : ''
    const label = typeof t.label === 'string' ? t.label : ''
    const rationale = typeof t.rationale === 'string' ? t.rationale : ''
    const ep = Array.isArray(t.evidence_paths)
      ? t.evidence_paths.filter((p): p is string => typeof p === 'string')
      : []
    if (!key || !label || !rationale || ep.length === 0) continue
    tags.push({ id, key, label, rationale, evidence_paths: ep })
  }

  return {
    generated_at,
    profile_as_of,
    primary_archetype: primary,
    secondary_archetypes,
    tags,
  }
}

export function serializeCandidateReadoutForDb(r: CandidateReadout): Record<string, unknown> {
  return {
    generated_at: r.generated_at,
    profile_as_of: r.profile_as_of,
    primary_archetype: r.primary_archetype,
    secondary_archetypes: r.secondary_archetypes,
    tags: r.tags.map((t) => ({
      id: t.id,
      key: t.key,
      label: t.label,
      rationale: t.rationale,
      evidence_paths: t.evidence_paths,
    })),
  }
}

export type ReadoutArchetypeSlice = {
  primary_archetype: ArchetypeSlug | null
  secondary_archetypes: ArchetypeSlug[]
}

export function readoutArchetypeKeySet(r: ReadoutArchetypeSlice | null): Set<string> {
  const s = new Set<string>()
  if (!r) return s
  if (r.primary_archetype) s.add(r.primary_archetype)
  for (const x of r.secondary_archetypes) s.add(x)
  return s
}

export function readoutTagKeySet(r: { tags: Pick<CandidateReadoutTag, 'key'>[] } | null): Set<string> {
  const s = new Set<string>()
  if (!r) return s
  for (const t of r.tags) s.add(normalizeTargetKey(t.key))
  return s
}

/** Resume artifact readout (same shape; no profile_as_of in response — client uses generated_at). */
export type ArtifactReadoutResponse = {
  generated_at: string
  primary_archetype: ArchetypeSlug | null
  secondary_archetypes: ArchetypeSlug[]
  tags: CandidateReadoutTag[]
}

export function toArtifactReadoutResponse(r: CandidateReadout): ArtifactReadoutResponse {
  return {
    generated_at: r.generated_at,
    primary_archetype: r.primary_archetype,
    secondary_archetypes: r.secondary_archetypes,
    tags: r.tags,
  }
}

export function archetypeDisplayList(r: CandidateReadout | null): { slug: ArchetypeSlug; label: string }[] {
  if (!r) return []
  const out: { slug: ArchetypeSlug; label: string }[] = []
  if (r.primary_archetype) out.push({ slug: r.primary_archetype, label: archetypeLabel(r.primary_archetype) })
  for (const s of r.secondary_archetypes) {
    out.push({ slug: s, label: archetypeLabel(s) })
  }
  return out
}

/** Fallback when LLM omits readout block. */
export function fallbackCandidateReadout(
  profile_as_of: string,
  generated_at: string
): CandidateReadout {
  return {
    generated_at,
    profile_as_of,
    primary_archetype: 'generalist',
    secondary_archetypes: [],
    tags: [
      {
        id: randomUUID(),
        key: 'insufficient_signal',
        label: 'Limited readout',
        rationale: 'We could not parse archetype tags from the model response. Regenerate your target profile from Data.',
        evidence_paths: ['summary'],
      },
    ],
  }
}

export function fallbackArtifactReadout(generated_at: string): CandidateReadout {
  return {
    generated_at,
    profile_as_of: generated_at,
    primary_archetype: 'generalist',
    secondary_archetypes: [],
    tags: [
      {
        id: randomUUID(),
        key: 'insufficient_signal',
        label: 'Limited readout',
        rationale: 'We could not parse labels from the model response. Click Refresh readout to try again.',
        evidence_paths: ['summary'],
      },
    ],
  }
}

/** Parse a JSON object whose top-level fields are the readout (resume artifact endpoint). */
export function parseArtifactReadoutRoot(
  parsed: Record<string, unknown>,
  generated_at: string
): CandidateReadout {
  return parseCandidateReadoutFromParsedJson(
    { candidate_readout: parsed },
    generated_at,
    generated_at
  )
}
