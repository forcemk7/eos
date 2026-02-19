/**
 * Profile-centric data model: DB = source of truth, resume = view.
 * First-class entities: profile (identity + summary), work experiences, bullets, skills.
 * Order is explicit via sort_order. IDs are stable for updates.
 */

/** One link = one row. No "one per line" blob. */
export interface ProfileLink {
  label: string
  url: string
}

export interface Identity {
  name: string
  email: string
  phone: string
  location: string
  /** Links — one entry per link (label + URL). */
  links: ProfileLink[]
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
  dates: string
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
  dates: string
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

/** Assembled "resume view": profile + work + education + achievements + skills + languages + additional. Used by UI and export. */
export interface AssembledProfile {
  identity: Identity
  summary: string
  experience: Array<{
    id: string
    title: string
    company: string
    dates: string
    sort_order: number
    bullets: Array<{ id: string; text: string; sort_order: number }>
  }>
  education: Array<{ id: string; institution: string; degree: string; field_of_study: string; dates: string; sort_order: number }>
  achievements: Array<{ id: string; title: string; issuer: string; date: string; sort_order: number }>
  skills: Array<{ id: string; name: string; sort_order: number }>
  languages: Array<{ id: string; language: string; level: string; sort_order: number }>
  additional: Array<{ id: string; title: string; content: string[] }>
}

/** Payload for saving: same shape as AssembledProfile, ids optional (new items get generated ids) */
export interface AssembledProfilePayload {
  identity: Identity
  summary: string
  experience: Array<{
    id?: string
    title: string
    company: string
    dates: string
    sort_order?: number
    bullets: Array<{ id?: string; text: string; sort_order?: number }>
  }>
  education?: Array<{ id?: string; institution: string; degree: string; field_of_study: string; dates: string; sort_order?: number }>
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
  links: [],
}

/** Normalize legacy identity.links (string[] or mixed) to ProfileLink[]. */
export function normalizeLinks(links: unknown): ProfileLink[] {
  if (!Array.isArray(links)) return []
  return links.map((item) => {
    if (item && typeof item === 'object' && 'url' in item) {
      const o = item as { label?: string; url?: string }
      return { label: typeof o.label === 'string' ? o.label : '', url: typeof o.url === 'string' ? o.url : '' }
    }
    return { label: '', url: typeof item === 'string' ? item : '' }
  })
}

/** URLs only, for display/export (e.g. contact line). */
export function linkUrls(links: ProfileLink[]): string[] {
  return (links ?? []).map((l) => l.url).filter(Boolean)
}

/** Legacy parsed_data from resumes table. */
export interface LegacyParsedData {
  identity?: Identity & { phone?: string }
  summary?: string
  experience?: Array<{
    title?: string
    company?: string
    dates?: string
    bullets?: string[]
  }>
  education?: Array<{ institution?: string; degree?: string; field_of_study?: string; dates?: string }>
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
  const identity = {
    ...DEFAULT_IDENTITY,
    ...rawIdentity,
    phone: (rawIdentity as any).phone ?? '',
    links: normalizeLinks((rawIdentity as any).links ?? []),
  }
  const experience = (legacy.experience ?? []).map((exp, i) => ({
    id: genId(),
    title: exp.title ?? '',
    company: exp.company ?? '',
    dates: exp.dates ?? '',
    sort_order: i,
    bullets: (exp.bullets ?? []).map((text, j) => ({
      id: genId(),
      text,
      sort_order: j,
    })),
  }))
  const education = (legacy.education ?? []).map((e, i) => ({
    id: genId(),
    institution: e.institution ?? '',
    degree: e.degree ?? '',
    field_of_study: e.field_of_study ?? '',
    dates: e.dates ?? '',
    sort_order: i,
  }))
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
  const languages = (legacy.languages ?? []).map((l, i) => ({
    id: genId(),
    language: (l as any).language ?? '',
    level: (l as any).level ?? '',
    sort_order: i,
  }))
  const additional = (legacy.additional ?? []).map((s, i) => ({
    id: genId(),
    title: (s as any).title ?? '',
    content: Array.isArray((s as any).content) ? (s as any).content : [],
  }))
  return { identity, summary: legacy.summary ?? '', experience, education, achievements, skills, languages, additional }
}

/** Normalize any parsed payload (legacy or assembled) to AssembledProfile. For UI. */
export function normalizedResumeData(parsed: any): ResumeData {
  if (!parsed) {
    return {
      identity: DEFAULT_IDENTITY,
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
    return {
      ...p,
      identity: {
        ...DEFAULT_IDENTITY,
        ...p.identity,
        phone: (p.identity as any)?.phone ?? '',
        links: normalizeLinks(p.identity?.links ?? []),
      },
      education: p.education ?? [],
      achievements: p.achievements ?? [],
      languages: p.languages ?? [],
      additional: p.additional ?? [],
    }
  }
  const fromLegacy = legacyToAssembled(parsed as LegacyParsedData)
  return fromLegacy ?? {
    identity: DEFAULT_IDENTITY,
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
  const identity = {
    ...DEFAULT_IDENTITY,
    ...rawIdentity,
    phone: (rawIdentity as any).phone ?? '',
    links: normalizeLinks((rawIdentity as any).links ?? []),
  }
  const experience = (legacy.experience ?? []).map((exp, i) => ({
    title: exp.title ?? '',
    company: exp.company ?? '',
    dates: exp.dates ?? '',
    sort_order: i,
    bullets: (exp.bullets ?? []).map((text, j) => ({ text, sort_order: j })),
  }))
  const education = (legacy.education ?? []).map((e, i) => ({
    institution: e.institution ?? '',
    degree: e.degree ?? '',
    field_of_study: e.field_of_study ?? '',
    dates: e.dates ?? '',
    sort_order: i,
  }))
  const achievements = (legacy.achievements ?? []).map((a, i) => ({
    title: a.title ?? '',
    issuer: a.issuer ?? '',
    date: a.date ?? '',
    sort_order: i,
  }))
  const skills = (legacy.skills ?? []).map((name, i) => ({ name, sort_order: i }))
  const languages = (legacy.languages ?? []).map((l, i) => ({
    language: (l as any).language ?? '',
    level: (l as any).level ?? '',
    sort_order: i,
  }))
  const additional = (legacy.additional ?? []).map((s) => ({
    title: (s as any).title ?? '',
    content: Array.isArray((s as any).content) ? (s as any).content : [],
  }))
  return { identity, summary: legacy.summary ?? '', experience, education, achievements, skills, languages, additional }
}
