/**
 * Profile-centric data model: DB = source of truth, resume = view.
 * First-class entities: profile (identity + summary), work experiences, bullets, skills.
 * Order is explicit via sort_order. IDs are stable for updates.
 */

/** ISO date range (YYYY-MM-DD). end_date null = current. */
export interface DateRange {
  start_date: string | null
  end_date: string | null
  /** Free text when exact dates unknown (e.g. "Early 2020 – Present"). Display only. */
  dates_display?: string
}

/** Controlled vocabulary for language proficiency. Stored as string in DB. */
export type LanguageLevel = 'native' | 'fluent' | 'advanced' | 'intermediate' | 'basic' | 'other'

export const LANGUAGE_LEVELS: LanguageLevel[] = ['native', 'fluent', 'advanced', 'intermediate', 'basic', 'other']

/** Link kind inferred from URL for merge/dedup. Not user-editable. */
export type LinkKind = 'linkedin' | 'portfolio' | 'website' | 'github' | 'other'

/** One link = URL only. kind is inferred from URL for merge/display. */
export interface ProfileLink {
  url: string
  kind?: LinkKind
}

/** Infer link kind from URL (linkedin.com, github.com, etc.) for merge and display. */
export function inferLinkKindFromUrl(url: string): LinkKind {
  if (!url || typeof url !== 'string') return 'other'
  const u = url.toLowerCase().trim()
  if (u.includes('linkedin.com')) return 'linkedin'
  if (u.includes('github.com')) return 'github'
  if (u.includes('portfolio') || u.includes('behance.net') || u.includes('dribbble.com')) return 'portfolio'
  return 'website'
}

/** Contact only (name, email, phone, location). Links live in their own section. */
export interface Identity {
  name: string
  email: string
  phone: string
  location: string
}

/** One flexible "additional" section: title + list of content strings. */
export interface AdditionalSection {
  id?: string
  title: string
  content: string[]
}

export interface Profile {
  user_id: string
  identity: Identity
  summary: string
  updated_at?: string
}

export interface WorkExperienceRow {
  id: string
  user_id: string
  company: string
  title: string
  /** Display string (legacy or derived from start_date/end_date). */
  dates: string
  start_date?: string | null
  end_date?: string | null
  dates_display?: string
  sort_order: number
  created_at?: string
}

export interface BulletRow {
  id: string
  experience_id: string
  text: string
  sort_order: number
  created_at?: string
}

export interface SkillRow {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at?: string
}

export interface EducationRow {
  id: string
  user_id: string
  institution: string
  degree: string
  field_of_study: string
  /** Display string (legacy or derived from start_date/end_date). */
  dates: string
  start_date?: string | null
  end_date?: string | null
  dates_display?: string
  sort_order: number
  created_at?: string
}

export interface AchievementRow {
  id: string
  user_id: string
  title: string
  issuer: string
  date: string
  sort_order: number
  created_at?: string
}

export interface LanguageRow {
  id: string
  user_id: string
  language: string
  level: string
  sort_order: number
  created_at?: string
}

/** Work experience with nested bullets (for assembled view) */
export interface WorkWithBullets extends WorkExperienceRow {
  bullets: BulletRow[]
}

/** Assembled "resume view": profile + links + work + education + achievements + skills + languages + additional. Used by UI and export. */
export interface AssembledProfile {
  identity: Identity
  links: ProfileLink[]
  summary: string
  experience: Array<{
    id: string
    title: string
    company: string
    dates: string
    start_date?: string | null
    end_date?: string | null
    dates_display?: string
    sort_order: number
    bullets: Array<{ id: string; text: string; sort_order: number }>
  }>
  education: Array<{
    id: string
    institution: string
    degree: string
    field_of_study: string
    dates: string
    start_date?: string | null
    end_date?: string | null
    dates_display?: string
    sort_order: number
  }>
  achievements: Array<{ id: string; title: string; issuer: string; date: string; sort_order: number }>
  skills: Array<{ id: string; name: string; sort_order: number }>
  languages: Array<{ id: string; language: string; level: string; sort_order: number }>
  additional: Array<{ id: string; title: string; content: string[] }>
}

/** Payload for saving: same shape as AssembledProfile, ids optional (new items get generated ids) */
export interface AssembledProfilePayload {
  identity: Identity
  links: ProfileLink[]
  summary: string
  experience: Array<{
    id?: string
    title: string
    company: string
    dates?: string
    start_date?: string | null
    end_date?: string | null
    dates_display?: string
    sort_order?: number
    bullets: Array<{ id?: string; text: string; sort_order?: number }>
  }>
  education?: Array<{
    id?: string
    institution: string
    degree: string
    field_of_study: string
    dates?: string
    start_date?: string | null
    end_date?: string | null
    dates_display?: string
    sort_order?: number
  }>
  achievements?: Array<{ id?: string; title: string; issuer: string; date: string; sort_order?: number }>
  skills: Array<{ id?: string; name: string; sort_order?: number }>
  languages?: Array<{ id?: string; language: string; level: string; sort_order?: number }>
  additional?: Array<{ id?: string; title: string; content: string[] }>
}

/** UI/editor resume type: same as AssembledProfile (DB view). */
export type ResumeData = AssembledProfile

export const DEFAULT_IDENTITY: Identity = {
  name: '',
  email: '',
  phone: '',
  location: '',
}

const LINK_KINDS: LinkKind[] = ['linkedin', 'portfolio', 'website', 'github', 'other']

/** Normalize to LinkKind (for merge key). Uses inferred from URL when kind missing. */
export function normalizeLinkKind(link: ProfileLink | { kind?: unknown; url?: string }): LinkKind {
  if (link.kind && typeof link.kind === 'string' && LINK_KINDS.includes(link.kind as LinkKind))
    return link.kind as LinkKind
  return inferLinkKindFromUrl(link.url ?? '')
}

/** Normalize string to LanguageLevel; maps common synonyms. */
export function normalizeLanguageLevel(level: unknown): string {
  if (typeof level !== 'string' || !level.trim()) return 'other'
  const m: Record<string, LanguageLevel> = {
    native: 'native',
    fluent: 'fluent',
    advanced: 'advanced',
    proficient: 'advanced',
    intermediate: 'intermediate',
    basic: 'basic',
    beginner: 'basic',
    elementary: 'basic',
    other: 'other',
  }
  return m[level.toLowerCase().trim()] ?? 'other'
}

/** Derive display dates string from structured range or use dates_display. */
export function formatDateRange(range: {
  start_date?: string | null
  end_date?: string | null
  dates_display?: string
  dates?: string
}): string {
  if (range.dates_display?.trim()) return range.dates_display.trim()
  if (range.dates?.trim()) return range.dates.trim()
  const start = range.start_date
  const end = range.end_date
  if (!start && !end) return ''
  if (start && !end) return `${start} – Present`
  if (start && end) return `${start} – ${end}`
  return end ? `${end}` : ''
}

/** Normalize identity.links (string[] or { url }[]) to ProfileLink[]. Infers kind from URL. */
export function normalizeLinks(links: unknown): ProfileLink[] {
  if (!Array.isArray(links)) return []
  return links.map((item) => {
    const url = typeof item === 'string' ? item : (item && typeof item === 'object' && 'url' in item ? (item as { url?: string }).url : '')
    const urlStr = typeof url === 'string' ? url : ''
    const kind = inferLinkKindFromUrl(urlStr)
    return { url: urlStr, kind }
  })
}

/** URLs only, for display/export (e.g. contact line). */
export function linkUrls(links: ProfileLink[]): string[] {
  return (links ?? []).map((l) => l.url).filter(Boolean)
}

/** Normalize parser output: extract links to top-level, language levels. For use in parse-resume and ingest APIs. */
export function normalizeParsedOutput(parsed: Record<string, unknown>): Record<string, unknown> {
  const identity = parsed.identity as Record<string, unknown> | undefined
  if (identity && Array.isArray(identity.links)) {
    parsed.links = normalizeLinks(identity.links)
    delete identity.links
  }
  const languages = parsed.languages as Array<{ language?: string; level?: string }> | undefined
  if (Array.isArray(languages)) {
    parsed.languages = languages.map((l) => ({
      ...l,
      level: normalizeLanguageLevel(l?.level),
    }))
  }
  return parsed
}

/** Legacy parsed_data from resumes table. May include structured date/link/level fields. */
export interface LegacyParsedData {
  identity?: Identity & { phone?: string }
  summary?: string
  experience?: Array<{
    title?: string
    company?: string
    dates?: string
    start_date?: string | null
    end_date?: string | null
    dates_display?: string
    bullets?: string[]
  }>
  education?: Array<{
    institution?: string
    degree?: string
    field_of_study?: string
    dates?: string
    start_date?: string | null
    end_date?: string | null
    dates_display?: string
  }>
  achievements?: Array<{ title?: string; issuer?: string; date?: string }>
  skills?: string[]
  languages?: Array<{ language?: string; level?: string }>
  additional?: Array<{ title?: string; content?: string[] }>
}

export function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))
}

/** Convert legacy parsed_data to AssembledProfile (generate ids). For fallback when no profile yet. */
export function legacyToAssembled(legacy: LegacyParsedData | null): AssembledProfile | null {
  if (!legacy) return null
  const rawIdentity = legacy.identity ?? DEFAULT_IDENTITY
  const raw = rawIdentity as unknown as Record<string, unknown>
  const identity: Identity = {
    name: (raw.name as string) ?? '',
    email: (raw.email as string) ?? '',
    phone: (raw.phone as string) ?? '',
    location: (raw.location as string) ?? '',
  }
  const links = normalizeLinks(raw.links ?? [])
  const experience = (legacy.experience ?? []).map((exp, i) => {
    const datesStr = formatDateRange({
      dates: exp.dates,
      start_date: exp.start_date,
      end_date: exp.end_date,
      dates_display: exp.dates_display,
    })
    return {
      id: genId(),
      title: exp.title ?? '',
      company: exp.company ?? '',
      dates: (datesStr || exp.dates) ?? '',
      start_date: exp.start_date ?? null,
      end_date: exp.end_date ?? null,
      dates_display: exp.dates_display,
      sort_order: i,
      bullets: (exp.bullets ?? []).map((text, j) => ({
        id: genId(),
        text,
        sort_order: j,
      })),
    }
  })
  const education = (legacy.education ?? []).map((e, i) => {
    const datesStr = formatDateRange({
      dates: e.dates,
      start_date: e.start_date,
      end_date: e.end_date,
      dates_display: e.dates_display,
    })
    return {
      id: genId(),
      institution: e.institution ?? '',
      degree: e.degree ?? '',
      field_of_study: e.field_of_study ?? '',
      dates: (datesStr || e.dates) ?? '',
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
      dates_display: e.dates_display,
      sort_order: i,
    }
  })
  const achievements = (legacy.achievements ?? []).map((a, i) => ({
    id: genId(),
    title: a.title ?? '',
    issuer: a.issuer ?? '',
    date: a.date ?? '',
    sort_order: i,
  }))
  const skills = (legacy.skills ?? []).map((name, i) => ({
    id: genId(),
    name,
    sort_order: i,
  }))
  const languages = (legacy.languages ?? []).map((l, i) => {
    const raw = l as { language?: string; level?: string }
    return {
      id: genId(),
      language: raw.language ?? '',
      level: normalizeLanguageLevel(raw.level),
      sort_order: i,
    }
  })
  const additional = (legacy.additional ?? []).map((s) => {
    const t = s as { title?: string; content?: string[] }
    return {
      id: genId(),
      title: t.title ?? '',
      content: Array.isArray(t.content) ? t.content : ([] as string[]),
    }
  })
  return { identity, links, summary: legacy.summary ?? '', experience, education, achievements, skills, languages, additional }
}

/** Normalize any parsed payload (legacy or assembled) to AssembledProfile. For UI. */
export function normalizedResumeData(parsed: AssembledProfile | LegacyParsedData | null | undefined): ResumeData {
  if (!parsed) {
    return {
      identity: DEFAULT_IDENTITY,
      links: [],
      summary: '',
      experience: [],
      education: [],
      achievements: [],
      skills: [],
      languages: [],
      additional: [],
    }
  }
  if (parsed.experience?.length && typeof parsed.experience[0].bullets?.[0] === 'object' && parsed.experience[0].bullets[0].text !== undefined) {
    const p = parsed as AssembledProfile
    const additional: Array<{ id: string; title: string; content: string[] }> = (p.additional ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      content: Array.isArray(s.content) ? s.content : [],
    }))
    const experience = (p.experience ?? []).map((e) => ({
      ...e,
      dates: e.dates || formatDateRange(e),
    }))
    const education = (p.education ?? []).map((e) => ({
      ...e,
      dates: e.dates || formatDateRange(e),
    }))
    const languages = (p.languages ?? []).map((l) => ({
      ...l,
      level: normalizeLanguageLevel(l.level),
    }))
    return {
      ...p,
      identity: {
        ...DEFAULT_IDENTITY,
        name: p.identity?.name ?? '',
        email: p.identity?.email ?? '',
        phone: p.identity?.phone ?? '',
        location: p.identity?.location ?? '',
      },
      links: normalizeLinks((p as { links?: ProfileLink[] }).links ?? (p.identity as { links?: unknown })?.links ?? []),
      experience,
      education,
      achievements: p.achievements ?? [],
      languages,
      additional,
    }
  }
  const fromLegacy = legacyToAssembled(parsed as LegacyParsedData)
  return fromLegacy ?? {
    identity: DEFAULT_IDENTITY,
    links: [],
    summary: '',
    experience: [],
    education: [],
    achievements: [],
    skills: [],
    languages: [],
    additional: [],
  }
}

/** Convert legacy parsed_data to AssembledProfilePayload (no ids). For initial sync. */
export function legacyToPayload(legacy: LegacyParsedData | null): AssembledProfilePayload | null {
  if (!legacy) return null
  const rawIdentity = legacy.identity ?? DEFAULT_IDENTITY
  const raw = rawIdentity as unknown as Record<string, unknown>
  const identity: Identity = {
    name: (raw.name as string) ?? '',
    email: (raw.email as string) ?? '',
    phone: (raw.phone as string) ?? '',
    location: (raw.location as string) ?? '',
  }
  const links = normalizeLinks(raw.links ?? [])
  const experience = (legacy.experience ?? []).map((exp, i) => {
    const datesStr = formatDateRange({
      dates: exp.dates,
      start_date: exp.start_date,
      end_date: exp.end_date,
      dates_display: exp.dates_display,
    })
    return {
      title: exp.title ?? '',
      company: exp.company ?? '',
      dates: (datesStr || exp.dates) ?? '',
      start_date: exp.start_date ?? null,
      end_date: exp.end_date ?? null,
      dates_display: exp.dates_display,
      sort_order: i,
      bullets: (exp.bullets ?? []).map((text, j) => ({ text, sort_order: j })),
    }
  })
  const education = (legacy.education ?? []).map((e, i) => {
    const datesStr = formatDateRange({
      dates: e.dates,
      start_date: e.start_date,
      end_date: e.end_date,
      dates_display: e.dates_display,
    })
    return {
      institution: e.institution ?? '',
      degree: e.degree ?? '',
      field_of_study: e.field_of_study ?? '',
      dates: (datesStr || e.dates) ?? '',
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
      dates_display: e.dates_display,
      sort_order: i,
    }
  })
  const achievements = (legacy.achievements ?? []).map((a, i) => ({
    title: a.title ?? '',
    issuer: a.issuer ?? '',
    date: a.date ?? '',
    sort_order: i,
  }))
  const skills = (legacy.skills ?? []).map((name, i) => ({ name, sort_order: i }))
  const languages = (legacy.languages ?? []).map((l, i) => {
    const raw = l as { language?: string; level?: string }
    return {
      language: raw.language ?? '',
      level: normalizeLanguageLevel(raw.level),
      sort_order: i,
    }
  })
  const additional = (legacy.additional ?? []).map((s) => {
    const t = s as { title?: string; content?: string[] }
    return { title: t.title ?? '', content: Array.isArray(t.content) ? t.content : ([] as string[]) }
  })
  return { identity, links, summary: legacy.summary ?? '', experience, education, achievements, skills, languages, additional }
}
