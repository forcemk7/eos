/**
 * Read/write profile-centric model. Assemble from DB; sync payload to DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AssembledProfile,
  AssembledProfilePayload,
  Identity,
  ProfileLink,
} from './profile'
import { DEFAULT_IDENTITY, formatDateRange, inferLinkKindFromUrl, normalizeLanguageLevel, normalizeLinkKind, normalizeLinks } from './profile'
import { runSyncProfile } from './profileDbSync'

/** Merge identity (contact only): fill empty fields from incoming. */
function mergeIdentity(current: Identity | null, incoming: Identity): Identity {
  const cur = current ?? DEFAULT_IDENTITY
  return {
    name: (cur.name?.trim() ? cur.name : incoming.name?.trim()) || cur.name || '',
    email: (cur.email?.trim() ? cur.email : incoming.email?.trim()) || cur.email || '',
    phone: (cur.phone?.trim() ? cur.phone : incoming.phone?.trim()) || cur.phone || '',
    location: (cur.location?.trim() ? cur.location : incoming.location?.trim()) || cur.location || '',
  }
}

export async function assembleProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<AssembledProfile | null> {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('identity, summary, additional')
    .eq('user_id', userId)
    .single()

  if (profileError || !profileRow) return null

  const rawIdentity = (profileRow.identity as Record<string, unknown>) ?? {}
  const identity: Identity = {
    name: (rawIdentity.name as string) ?? '',
    email: (rawIdentity.email as string) ?? '',
    phone: (rawIdentity.phone as string) ?? '',
    location: (rawIdentity.location as string) ?? '',
  }

  const { data: linkRows, error: linkError } = await supabase
    .from('profile_links')
    .select('id, url, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
  const links: ProfileLink[] = linkError ? [] : (linkRows ?? []).map((r) => ({ url: r.url ?? '', kind: inferLinkKindFromUrl(r.url ?? '') }))

  const { data: workRows, error: workError } = await supabase
    .from('experience')
    .select('id, company, title, dates, start_date, end_date, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (workError) return null
  const works = workRows ?? []

  const experience: AssembledProfile['experience'] = []
  for (const w of works) {
    const row = w as { id: string; company: string; title: string; dates?: string; start_date?: string | null; end_date?: string | null; sort_order: number }
    const datesStr = formatDateRange({
      dates: row.dates,
      start_date: row.start_date,
      end_date: row.end_date,
    })
    const { data: bulletRows } = await supabase
      .from('bullets')
      .select('id, text, sort_order')
      .eq('experience_id', w.id)
      .order('sort_order', { ascending: true })
    const bullets = (bulletRows ?? []).map((b) => ({
      id: b.id,
      text: b.text,
      sort_order: b.sort_order,
    }))
    experience.push({
      id: w.id,
      title: row.title,
      company: row.company,
      dates: (datesStr || row.dates) ?? '',
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      dates_display: row.dates?.trim() && !row.start_date && !row.end_date ? row.dates : undefined,
      sort_order: row.sort_order,
      bullets,
    })
  }

  const { data: skillRows, error: skillError } = await supabase
    .from('skills')
    .select('id, name, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (skillError) return null
  const skills = (skillRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    sort_order: s.sort_order,
  }))

  const { data: educationRows, error: educationError } = await supabase
    .from('education')
    .select('id, institution, degree, field_of_study, dates, start_date, end_date, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (educationError) return null
  const education = (educationRows ?? []).map((e) => {
    const row = e as { id: string; institution?: string; degree?: string; field_of_study?: string; dates?: string; start_date?: string | null; end_date?: string | null; sort_order: number }
    const datesStr = formatDateRange({
      dates: row.dates,
      start_date: row.start_date,
      end_date: row.end_date,
    })
    return {
      id: row.id,
      institution: row.institution ?? '',
      degree: row.degree ?? '',
      field_of_study: row.field_of_study ?? '',
      dates: (datesStr || row.dates) ?? '',
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      dates_display: row.dates?.trim() && !row.start_date && !row.end_date ? row.dates : undefined,
      sort_order: row.sort_order,
    }
  })

  const { data: achievementRows, error: achievementError } = await supabase
    .from('achievements')
    .select('id, title, issuer, date, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (achievementError) return null
  const achievements = (achievementRows ?? []).map((a) => ({
    id: a.id,
    title: a.title ?? '',
    issuer: a.issuer ?? '',
    date: a.date ?? '',
    sort_order: a.sort_order,
  }))

  const { data: languageRows, error: languageError } = await supabase
    .from('languages')
    .select('id, language, level, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (languageError) return null
  const languages = (languageRows ?? []).map((l) => ({
    id: l.id,
    language: l.language ?? '',
    level: normalizeLanguageLevel(l.level),
    sort_order: l.sort_order,
  }))

  type RawSection = { id?: string; title?: string; content?: unknown }
  const rawAdditional = (profileRow as { additional?: RawSection[] }).additional
  const additional = Array.isArray(rawAdditional)
    ? rawAdditional.map((s: RawSection, i: number) => ({
        id: s.id ?? `section-${i}`,
        title: typeof s.title === 'string' ? s.title : '',
        content: Array.isArray(s.content) ? s.content : [],
      }))
    : []

  return {
    identity,
    links,
    summary: profileRow.summary ?? '',
    experience,
    education,
    achievements,
    skills,
    languages,
    additional,
  }
}

/** Sync payload to profile + experience + bullets + skills + education + achievements + languages + additional. Replaces user's data with payload. */
export async function syncProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: AssembledProfilePayload
): Promise<AssembledProfile | null> {
  try {
    await runSyncProfile(supabase, userId, payload)
    return assembleProfile(supabase, userId)
  } catch {
    return null
  }
}

/**
 * Merge parsed document into existing profile.
 * Semantics: Identity — fill empty fields from incoming; links matched by kind (update or append).
 * Summary — overwrite if incoming non-empty. Experience — match by company+title (update or append).
 * Education — match by institution+degree (update or append). Skills/Languages/Achievements — append if not present.
 * Additional — merge by section title (append new sections, append items to existing).
 */
export async function mergeIntoProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: AssembledProfilePayload
): Promise<AssembledProfile | null> {
  const current = await assembleProfile(supabase, userId)
  const { identity: incomingIdentity, links: payloadLinks = [], summary, experience, skills, education = [], achievements = [], languages = [], additional = [] } = payload

  const mergedIdentity = mergeIdentity(current?.identity ?? null, incomingIdentity)
  const mergedSummary = ((summary?.trim() ? summary : current?.summary?.trim()) || current?.summary) ?? ''

  const existingTitles = new Set((current?.additional ?? []).map((s) => s.title.toLowerCase()))
  const mergedAdditional = [...(current?.additional ?? [])]
  for (const s of additional) {
    const title = (typeof s === 'object' ? s.title : '').trim()
    if (!title) continue
    const existing = mergedAdditional.find((x) => x.title.toLowerCase() === title.toLowerCase())
    if (existing) {
      const sec = s as { content?: string[] }
      existing.content = [...existing.content, ...(Array.isArray(sec.content) ? sec.content : [])]
    } else {
      existingTitles.add(title.toLowerCase())
      const sec = s as { id?: string; content?: string[] }
      mergedAdditional.push({
        id: sec.id ?? crypto.randomUUID(),
        title,
        content: Array.isArray(sec.content) ? sec.content : [],
      })
    }
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      identity: mergedIdentity,
      summary: mergedSummary,
      additional: mergedAdditional,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (profileError) {
    console.error('profile merge error:', profileError)
    return null
  }

  const curLinks = current?.links ?? []
  const inLinks = normalizeLinks(payloadLinks)
  const kindToIndex = new Map<string, number>()
  curLinks.forEach((l, i) => kindToIndex.set(normalizeLinkKind(l), i))
  const mergedLinks: ProfileLink[] = [...curLinks]
  for (const link of inLinks) {
    const k = normalizeLinkKind(link)
    const linkWithKind: ProfileLink = { url: link.url, kind: k }
    if (kindToIndex.has(k)) mergedLinks[kindToIndex.get(k)!] = linkWithKind
    else {
      mergedLinks.push(linkWithKind)
      kindToIndex.set(k, mergedLinks.length - 1)
    }
  }
  await supabase.from('profile_links').delete().eq('user_id', userId)
  for (let i = 0; i < mergedLinks.length; i++) {
    const l = mergedLinks[i]
    if (!l.url?.trim()) continue
    await supabase.from('profile_links').insert({
      user_id: userId,
      url: l.url.trim(),
      sort_order: i,
    })
  }

  const curExp = current?.experience ?? []
  const expKey = (company: string, title: string) => `${(company ?? '').trim().toLowerCase()}|${(title ?? '').trim().toLowerCase()}`
  const existingExpKeys = new Map(curExp.map((e, i) => [expKey(e.company, e.title), { id: e.id, sort_order: i }]))
  let expSort = curExp.length

  for (let i = 0; i < experience.length; i++) {
    const exp = experience[i]
    const company = exp.company ?? ''
    const title = exp.title ?? ''
    const key = expKey(company, title)
    const existing = existingExpKeys.get(key)
    const datesStr = exp.dates ?? formatDateRange(exp)

    if (existing) {
      await supabase
        .from('experience')
        .update({
          company,
          title,
          dates: datesStr,
          start_date: exp.start_date ?? null,
          end_date: exp.end_date ?? null,
          sort_order: existing.sort_order,
        })
        .eq('id', existing.id)
        .eq('user_id', userId)

      const { data: existingBullets } = await supabase.from('bullets').select('id').eq('experience_id', existing.id)
      const nextBulletOrder = (existingBullets ?? []).length
      const bulletPayload = exp.bullets ?? []
      for (let j = 0; j < bulletPayload.length; j++) {
        const b = bulletPayload[j]
        const text = typeof b === 'string' ? b : (b.text ?? '')
        if (!text.trim()) continue
        await supabase.from('bullets').insert({
          id: crypto.randomUUID(),
          experience_id: existing.id,
          text,
          sort_order: nextBulletOrder + j,
        })
      }
    } else {
      const workId = crypto.randomUUID()
      existingExpKeys.set(key, { id: workId, sort_order: expSort })
      await supabase.from('experience').insert({
        id: workId,
        user_id: userId,
        company,
        title,
        dates: datesStr,
        start_date: exp.start_date ?? null,
        end_date: exp.end_date ?? null,
        sort_order: expSort++,
      })
      for (let j = 0; j < (exp.bullets ?? []).length; j++) {
        const b = exp.bullets![j]
        await supabase.from('bullets').insert({
          id: crypto.randomUUID(),
          experience_id: workId,
          text: typeof b === 'string' ? b : (b.text ?? ''),
          sort_order: j,
        })
      }
    }
  }

  const existingNames = new Set((current?.skills ?? []).map((s) => s.name.toLowerCase()))
  let skillSort = (current?.skills?.length ?? 0)
  for (const s of skills) {
    const name = (typeof s === 'string' ? s : s.name) ?? ''
    if (!name.trim() || existingNames.has(name.toLowerCase())) continue
    existingNames.add(name.toLowerCase())
    await supabase.from('skills').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      sort_order: skillSort++,
    })
  }

  const curEdu = current?.education ?? []
  const eduKey = (inst: string, degree: string) => `${(inst ?? '').trim().toLowerCase()}|${(degree ?? '').trim().toLowerCase()}`
  const existingEduKeys = new Map(curEdu.map((e, i) => [eduKey(e.institution, e.degree), { id: e.id, sort_order: i }]))
  let eduSort = curEdu.length

  for (const e of education) {
    const ed = (typeof e === 'object' && e !== null ? e : {}) as {
      institution?: string
      degree?: string
      field_of_study?: string
      dates?: string
      start_date?: string | null
      end_date?: string | null
    }
    const inst = (ed.institution ?? '').trim()
    if (!inst) continue
    const degree = (ed.degree ?? '').trim()
    const key = eduKey(inst, degree)
    const existing = existingEduKeys.get(key)
    const datesStr = ed.dates ?? formatDateRange(ed)

    if (existing) {
      await supabase
        .from('education')
        .update({
          institution: inst,
          degree: ed.degree ?? '',
          field_of_study: ed.field_of_study ?? '',
          dates: datesStr,
          start_date: ed.start_date ?? null,
          end_date: ed.end_date ?? null,
          sort_order: existing.sort_order,
        })
        .eq('id', existing.id)
        .eq('user_id', userId)
    } else {
      const eid = crypto.randomUUID()
      existingEduKeys.set(key, { id: eid, sort_order: eduSort })
      await supabase.from('education').insert({
        id: eid,
        user_id: userId,
        institution: inst,
        degree: ed.degree ?? '',
        field_of_study: ed.field_of_study ?? '',
        dates: datesStr,
        start_date: ed.start_date ?? null,
        end_date: ed.end_date ?? null,
        sort_order: eduSort++,
      })
    }
  }

  let achSort = (current?.achievements?.length ?? 0)
  for (const a of achievements) {
    const title = (typeof a === 'object' ? a.title : '') ?? ''
    if (!title.trim()) continue
    await supabase.from('achievements').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.trim(),
      issuer: (typeof a === 'object' ? a.issuer : '') ?? '',
      date: (typeof a === 'object' ? a.date : '') ?? '',
      sort_order: achSort++,
    })
  }

  let langSort = (current?.languages?.length ?? 0)
  const existingLangs = new Set((current?.languages ?? []).map((l) => `${l.language.toLowerCase()}:${l.level.toLowerCase()}`))
  for (const l of languages) {
    const lang = (typeof l === 'object' ? l.language : '') ?? ''
    const levelRaw = (typeof l === 'object' ? l.level : '') ?? ''
    const level = normalizeLanguageLevel(levelRaw)
    if (!lang.trim()) continue
    const key = `${lang.toLowerCase()}:${level.toLowerCase()}`
    if (existingLangs.has(key)) continue
    existingLangs.add(key)
    await supabase.from('languages').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      language: lang.trim(),
      level,
      sort_order: langSort++,
    })
  }

  return assembleProfile(supabase, userId)
}
