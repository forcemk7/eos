/**
 * Read/write profile-centric model. Assemble from DB; sync payload to DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AssembledProfile,
  AssembledProfilePayload,
  Identity,
} from './profile'
import { DEFAULT_IDENTITY, normalizeLinks } from './profile'

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

  const rawIdentity = (profileRow.identity as Identity) ?? DEFAULT_IDENTITY
  const identity = {
    ...DEFAULT_IDENTITY,
    ...rawIdentity,
    phone: (rawIdentity as any).phone ?? '',
    links: normalizeLinks((rawIdentity as any).links ?? []),
  }

  const { data: workRows, error: workError } = await supabase
    .from('experience')
    .select('id, company, title, dates, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (workError) return null
  const works = workRows ?? []

  const experience: AssembledProfile['experience'] = []
  for (const w of works) {
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
      title: w.title,
      company: w.company,
      dates: w.dates,
      sort_order: w.sort_order,
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
    .select('id, institution, degree, field_of_study, dates, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (educationError) return null
  const education = (educationRows ?? []).map((e) => ({
    id: e.id,
    institution: e.institution ?? '',
    degree: e.degree ?? '',
    field_of_study: e.field_of_study ?? '',
    dates: e.dates ?? '',
    sort_order: e.sort_order,
  }))

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
    level: l.level ?? '',
    sort_order: l.sort_order,
  }))

  const rawAdditional = (profileRow as any).additional
  const additional = Array.isArray(rawAdditional)
    ? rawAdditional.map((s: any, i: number) => ({
        id: s.id ?? `section-${i}`,
        title: typeof s.title === 'string' ? s.title : '',
        content: Array.isArray(s.content) ? s.content : [],
      }))
    : []

  return {
    identity,
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
  const { identity, summary, experience, skills, education = [], achievements = [], languages = [], additional = [] } = payload

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      identity,
      summary: summary ?? '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (profileError) {
    console.error('profile sync error:', profileError)
    return null
  }

  const { data: existingWorkRows } = await supabase
    .from('experience')
    .select('id')
    .eq('user_id', userId)
  const existingWorkIds = new Set((existingWorkRows ?? []).map((r) => r.id))

  const payloadWorkIds: string[] = []
  for (let i = 0; i < experience.length; i++) {
    const exp = experience[i]
    const workId = exp.id && existingWorkIds.has(exp.id) ? exp.id : crypto.randomUUID()
    payloadWorkIds.push(workId)

    if (existingWorkIds.has(workId)) {
      await supabase
        .from('experience')
        .update({
          company: exp.company ?? '',
          title: exp.title ?? '',
          dates: exp.dates ?? '',
          sort_order: i,
        })
        .eq('id', workId)
        .eq('user_id', userId)
    } else {
      await supabase.from('experience').insert({
        id: workId,
        user_id: userId,
        company: exp.company ?? '',
        title: exp.title ?? '',
        dates: exp.dates ?? '',
        sort_order: i,
      })
    }

    const { data: existingBulletRows } = await supabase
      .from('bullets')
      .select('id')
      .eq('experience_id', workId)
    const existingBulletIds = new Set((existingBulletRows ?? []).map((r) => r.id))

    const bulletPayload = exp.bullets ?? []
    const bulletIdsToKeep: string[] = []
    for (let j = 0; j < bulletPayload.length; j++) {
      const b = bulletPayload[j]
      const bulletId =
        b.id && existingBulletIds.has(b.id) ? b.id : crypto.randomUUID()
      bulletIdsToKeep.push(bulletId)

      if (existingBulletIds.has(bulletId)) {
        await supabase
          .from('bullets')
          .update({ text: b.text ?? '', sort_order: j })
          .eq('id', bulletId)
      } else {
        await supabase.from('bullets').insert({
          id: bulletId,
          experience_id: workId,
          text: b.text ?? '',
          sort_order: j,
        })
      }
    }
    const bulletsToDelete = (existingBulletRows ?? [])
      .map((r) => r.id)
      .filter((id) => !bulletIdsToKeep.includes(id))
    for (const bid of bulletsToDelete) {
      await supabase.from('bullets').delete().eq('id', bid)
    }
  }

  const workToDelete = [...existingWorkIds].filter((id) => !payloadWorkIds.includes(id))
  for (const wid of workToDelete) {
    await supabase.from('experience').delete().eq('id', wid).eq('user_id', userId)
  }

  const { data: existingSkillRows } = await supabase
    .from('skills')
    .select('id')
    .eq('user_id', userId)
  const existingSkillIds = new Set((existingSkillRows ?? []).map((r) => r.id))

  const skillIdsToKeep: string[] = []
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i]
    const skillId = s.id && existingSkillIds.has(s.id) ? s.id : crypto.randomUUID()
    skillIdsToKeep.push(skillId)

    if (existingSkillIds.has(skillId)) {
      await supabase
        .from('skills')
        .update({ name: s.name ?? '', sort_order: i })
        .eq('id', skillId)
        .eq('user_id', userId)
    } else {
      await supabase.from('skills').insert({
        id: skillId,
        user_id: userId,
        name: s.name ?? '',
        sort_order: i,
      })
    }
  }
  const skillsToDelete = [...existingSkillIds].filter((id) => !skillIdsToKeep.includes(id))
  for (const sid of skillsToDelete) {
    await supabase.from('skills').delete().eq('id', sid).eq('user_id', userId)
  }

  const { data: existingEduRows } = await supabase
    .from('education')
    .select('id')
    .eq('user_id', userId)
  const existingEduIds = new Set((existingEduRows ?? []).map((r) => r.id))
  const eduPayload = education
  const eduIdsToKeep: string[] = []
  for (let i = 0; i < eduPayload.length; i++) {
    const e = eduPayload[i]
    const eid = e.id && existingEduIds.has(e.id) ? e.id : crypto.randomUUID()
    eduIdsToKeep.push(eid)
    if (existingEduIds.has(eid)) {
      await supabase
        .from('education')
        .update({
          institution: e.institution ?? '',
          degree: e.degree ?? '',
          field_of_study: e.field_of_study ?? '',
          dates: e.dates ?? '',
          sort_order: i,
        })
        .eq('id', eid)
        .eq('user_id', userId)
    } else {
      await supabase.from('education').insert({
        id: eid,
        user_id: userId,
        institution: e.institution ?? '',
        degree: e.degree ?? '',
        field_of_study: e.field_of_study ?? '',
        dates: e.dates ?? '',
        sort_order: i,
      })
    }
  }
  for (const eid of existingEduIds) {
    if (!eduIdsToKeep.includes(eid)) {
      await supabase.from('education').delete().eq('id', eid).eq('user_id', userId)
    }
  }

  const { data: existingAchRows } = await supabase
    .from('achievements')
    .select('id')
    .eq('user_id', userId)
  const existingAchIds = new Set((existingAchRows ?? []).map((r) => r.id))
  const achPayload = achievements
  const achIdsToKeep: string[] = []
  for (let i = 0; i < achPayload.length; i++) {
    const a = achPayload[i]
    const aid = a.id && existingAchIds.has(a.id) ? a.id : crypto.randomUUID()
    achIdsToKeep.push(aid)
    if (existingAchIds.has(aid)) {
      await supabase
        .from('achievements')
        .update({
          title: a.title ?? '',
          issuer: a.issuer ?? '',
          date: a.date ?? '',
          sort_order: i,
        })
        .eq('id', aid)
        .eq('user_id', userId)
    } else {
      await supabase.from('achievements').insert({
        id: aid,
        user_id: userId,
        title: a.title ?? '',
        issuer: a.issuer ?? '',
        date: a.date ?? '',
        sort_order: i,
      })
    }
  }
  for (const aid of existingAchIds) {
    if (!achIdsToKeep.includes(aid)) {
      await supabase.from('achievements').delete().eq('id', aid).eq('user_id', userId)
    }
  }

  const { data: existingLangRows } = await supabase
    .from('languages')
    .select('id')
    .eq('user_id', userId)
  const existingLangIds = new Set((existingLangRows ?? []).map((r) => r.id))
  const langPayload = languages
  const langIdsToKeep: string[] = []
  for (let i = 0; i < langPayload.length; i++) {
    const l = langPayload[i]
    const lid = l.id && existingLangIds.has(l.id) ? l.id : crypto.randomUUID()
    langIdsToKeep.push(lid)
    if (existingLangIds.has(lid)) {
      await supabase
        .from('languages')
        .update({ language: l.language ?? '', level: l.level ?? '', sort_order: i })
        .eq('id', lid)
        .eq('user_id', userId)
    } else {
      await supabase.from('languages').insert({
        id: lid,
        user_id: userId,
        language: l.language ?? '',
        level: l.level ?? '',
        sort_order: i,
      })
    }
  }
  for (const lid of existingLangIds) {
    if (!langIdsToKeep.includes(lid)) {
      await supabase.from('languages').delete().eq('id', lid).eq('user_id', userId)
    }
  }

  const additionalJson = additional.map((s) => ({
    id: s.id ?? crypto.randomUUID(),
    title: s.title ?? '',
    content: s.content ?? [],
  }))
  await supabase
    .from('profiles')
    .update({ additional: additionalJson, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return assembleProfile(supabase, userId)
}

/** Merge parsed document into existing profile. Adds new experience/bullets/skills/education/achievements/languages; updates identity/summary/additional. */
export async function mergeIntoProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: AssembledProfilePayload
): Promise<AssembledProfile | null> {
  const current = await assembleProfile(supabase, userId)
  const { identity, summary, experience, skills, education = [], achievements = [], languages = [], additional = [] } = payload

  const existingTitles = new Set((current?.additional ?? []).map((s) => s.title.toLowerCase()))
  const mergedAdditional = [...(current?.additional ?? [])]
  for (const s of additional) {
    const title = (typeof s === 'object' ? s.title : '').trim()
    if (!title || existingTitles.has(title.toLowerCase())) continue
    existingTitles.add(title.toLowerCase())
    mergedAdditional.push({
      id: (s as any).id ?? crypto.randomUUID(),
      title,
      content: Array.isArray((s as any).content) ? (s as any).content : [],
    })
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      identity,
      summary: summary ?? '',
      additional: mergedAdditional,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (profileError) {
    console.error('profile merge error:', profileError)
    return null
  }

  const maxSort = current?.experience?.length ?? 0
  for (let i = 0; i < experience.length; i++) {
    const exp = experience[i]
    const workId = crypto.randomUUID()
    await supabase.from('experience').insert({
      id: workId,
      user_id: userId,
      company: exp.company ?? '',
      title: exp.title ?? '',
      dates: exp.dates ?? '',
      sort_order: maxSort + i,
    })
    const bulletPayload = exp.bullets ?? []
    for (let j = 0; j < bulletPayload.length; j++) {
      const b = bulletPayload[j]
      await supabase.from('bullets').insert({
        id: crypto.randomUUID(),
        experience_id: workId,
        text: typeof b === 'string' ? b : (b.text ?? ''),
        sort_order: j,
      })
    }
  }

  const existingNames = new Set((current?.skills ?? []).map((s) => s.name.toLowerCase()))
  let skillSort = (current?.skills?.length ?? 0)
  for (const s of skills) {
    const name = (typeof s === 'string' ? s : s.name) ?? ''
    if (!name.trim()) continue
    if (existingNames.has(name.toLowerCase())) continue
    existingNames.add(name.toLowerCase())
    await supabase.from('skills').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      sort_order: skillSort++,
    })
  }

  let eduSort = (current?.education?.length ?? 0)
  for (const e of education) {
    const inst = (typeof e === 'object' ? e.institution : '') ?? ''
    if (!inst.trim()) continue
    await supabase.from('education').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      institution: inst.trim(),
      degree: (typeof e === 'object' ? e.degree : '') ?? '',
      field_of_study: (typeof e === 'object' ? e.field_of_study : '') ?? '',
      dates: (typeof e === 'object' ? e.dates : '') ?? '',
      sort_order: eduSort++,
    })
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
    const level = (typeof l === 'object' ? l.level : '') ?? ''
    if (!lang.trim()) continue
    const key = `${lang.toLowerCase()}:${level.toLowerCase()}`
    if (existingLangs.has(key)) continue
    existingLangs.add(key)
    await supabase.from('languages').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      language: lang.trim(),
      level: level.trim(),
      sort_order: langSort++,
    })
  }

  return assembleProfile(supabase, userId)
}
