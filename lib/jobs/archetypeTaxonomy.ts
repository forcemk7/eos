/** Closed set of archetype slugs for LLM classification (validated server-side). */

export const ARCHETYPE_SLUGS = [
  'ic_engineering',
  'engineering_leadership',
  'product',
  'data_analytics',
  'design_ux',
  'sales_gtm',
  'marketing',
  'operations',
  'finance',
  'student_early_career',
  'career_changer',
  'executive_leadership',
  'generalist',
] as const

export type ArchetypeSlug = (typeof ARCHETYPE_SLUGS)[number]

const SLUG_SET = new Set<string>(ARCHETYPE_SLUGS)

const LABELS: Record<ArchetypeSlug, string> = {
  ic_engineering: 'Individual contributor — engineering',
  engineering_leadership: 'Engineering leadership',
  product: 'Product / program',
  data_analytics: 'Data & analytics',
  design_ux: 'Design / UX',
  sales_gtm: 'Sales / GTM',
  marketing: 'Marketing / growth',
  operations: 'Operations / business ops',
  finance: 'Finance / accounting',
  student_early_career: 'Student / early career',
  career_changer: 'Career changer',
  executive_leadership: 'Executive / GM',
  generalist: 'Generalist / mixed',
}

export function isArchetypeSlug(s: string): s is ArchetypeSlug {
  return SLUG_SET.has(s)
}

export function archetypeLabel(slug: ArchetypeSlug): string {
  return LABELS[slug]
}

export function coerceArchetypeSlug(raw: string): ArchetypeSlug | null {
  const n = raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return isArchetypeSlug(n) ? n : null
}

/** Keep primary + up to 2 secondaries from LLM output; drop unknown slugs. */
export function normalizeArchetypeSelection(
  primary: string | undefined,
  secondaries: unknown
): { primary: ArchetypeSlug | null; secondary: ArchetypeSlug[] } {
  const p = primary && typeof primary === 'string' ? coerceArchetypeSlug(primary) : null
  const rawList = Array.isArray(secondaries) ? secondaries : []
  const out: ArchetypeSlug[] = []
  for (const item of rawList) {
    if (typeof item !== 'string') continue
    const s = coerceArchetypeSlug(item)
    if (s && s !== p && !out.includes(s)) out.push(s)
    if (out.length >= 2) break
  }
  return { primary: p, secondary: out }
}

export function listArchetypesForPrompt(): string {
  return ARCHETYPE_SLUGS.map((s) => `- "${s}": ${LABELS[s]}`).join('\n')
}
