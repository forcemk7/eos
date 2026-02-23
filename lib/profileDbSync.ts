/**
 * Sync helpers: experience/bullets, skills, education, achievements, languages.
 * Used by syncProfile in profileDb.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssembledProfilePayload } from './profile'
import { formatDateRange, normalizeLanguageLevel } from './profile'

export async function runSyncProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: AssembledProfilePayload
): Promise<void> {
  const { identity, links = [], summary, experience, skills, education = [], achievements = [], languages = [], additional = [] } = payload

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
    throw new Error('Profile sync failed')
  }

  await supabase.from('profile_links').delete().eq('user_id', userId)
  for (let i = 0; i < links.length; i++) {
    const url = (links[i] && typeof links[i] === 'object' && 'url' in links[i] ? (links[i] as { url: string }).url : String(links[i] ?? '')).trim()
    if (!url) continue
    await supabase.from('profile_links').insert({ user_id: userId, url, sort_order: i })
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

    const expDates = exp.dates ?? formatDateRange(exp)
    if (existingWorkIds.has(workId)) {
      await supabase
        .from('experience')
        .update({
          company: exp.company ?? '',
          title: exp.title ?? '',
          dates: expDates,
          start_date: exp.start_date ?? null,
          end_date: exp.end_date ?? null,
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
        dates: expDates,
        start_date: exp.start_date ?? null,
        end_date: exp.end_date ?? null,
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
      const bulletId = b.id && existingBulletIds.has(b.id) ? b.id : crypto.randomUUID()
      bulletIdsToKeep.push(bulletId)
      if (existingBulletIds.has(bulletId)) {
        await supabase.from('bullets').update({ text: b.text ?? '', sort_order: j }).eq('id', bulletId)
      } else {
        await supabase.from('bullets').insert({
          id: bulletId,
          experience_id: workId,
          text: b.text ?? '',
          sort_order: j,
        })
      }
    }
    for (const bid of (existingBulletRows ?? []).map((r) => r.id).filter((id) => !bulletIdsToKeep.includes(id))) {
      await supabase.from('bullets').delete().eq('id', bid)
    }
  }

  for (const wid of [...existingWorkIds].filter((id) => !payloadWorkIds.includes(id))) {
    await supabase.from('experience').delete().eq('id', wid).eq('user_id', userId)
  }

  const { data: existingSkillRows } = await supabase.from('skills').select('id').eq('user_id', userId)
  const existingSkillIds = new Set((existingSkillRows ?? []).map((r) => r.id))
  const skillIdsToKeep: string[] = []
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i]
    const skillId = s.id && existingSkillIds.has(s.id) ? s.id : crypto.randomUUID()
    skillIdsToKeep.push(skillId)
    if (existingSkillIds.has(skillId)) {
      await supabase.from('skills').update({ name: s.name ?? '', sort_order: i }).eq('id', skillId).eq('user_id', userId)
    } else {
      await supabase.from('skills').insert({ id: skillId, user_id: userId, name: s.name ?? '', sort_order: i })
    }
  }
  for (const sid of [...existingSkillIds].filter((id) => !skillIdsToKeep.includes(id))) {
    await supabase.from('skills').delete().eq('id', sid).eq('user_id', userId)
  }

  const { data: existingEduRows } = await supabase.from('education').select('id').eq('user_id', userId)
  const existingEduIds = new Set((existingEduRows ?? []).map((r) => r.id))
  const eduIdsToKeep: string[] = []
  for (let i = 0; i < education.length; i++) {
    const e = education[i]
    const eid = e.id && existingEduIds.has(e.id) ? e.id : crypto.randomUUID()
    eduIdsToKeep.push(eid)
    const eduDates = e.dates ?? formatDateRange(e)
    if (existingEduIds.has(eid)) {
      await supabase
        .from('education')
        .update({
          institution: e.institution ?? '',
          degree: e.degree ?? '',
          field_of_study: e.field_of_study ?? '',
          dates: eduDates,
          start_date: e.start_date ?? null,
          end_date: e.end_date ?? null,
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
        dates: eduDates,
        start_date: e.start_date ?? null,
        end_date: e.end_date ?? null,
        sort_order: i,
      })
    }
  }
  for (const eid of existingEduIds) {
    if (!eduIdsToKeep.includes(eid)) await supabase.from('education').delete().eq('id', eid).eq('user_id', userId)
  }

  const { data: existingAchRows } = await supabase.from('achievements').select('id').eq('user_id', userId)
  const existingAchIds = new Set((existingAchRows ?? []).map((r) => r.id))
  const achIdsToKeep: string[] = []
  for (let i = 0; i < achievements.length; i++) {
    const a = achievements[i]
    const aid = a.id && existingAchIds.has(a.id) ? a.id : crypto.randomUUID()
    achIdsToKeep.push(aid)
    if (existingAchIds.has(aid)) {
      await supabase
        .from('achievements')
        .update({ title: a.title ?? '', issuer: a.issuer ?? '', date: a.date ?? '', sort_order: i })
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
    if (!achIdsToKeep.includes(aid)) await supabase.from('achievements').delete().eq('id', aid).eq('user_id', userId)
  }

  const { data: existingLangRows } = await supabase.from('languages').select('id').eq('user_id', userId)
  const existingLangIds = new Set((existingLangRows ?? []).map((r) => r.id))
  const langIdsToKeep: string[] = []
  for (let i = 0; i < languages.length; i++) {
    const l = languages[i]
    const lid = l.id && existingLangIds.has(l.id) ? l.id : crypto.randomUUID()
    langIdsToKeep.push(lid)
    const levelNorm = normalizeLanguageLevel(l.level)
    if (existingLangIds.has(lid)) {
      await supabase
        .from('languages')
        .update({ language: l.language ?? '', level: levelNorm, sort_order: i })
        .eq('id', lid)
        .eq('user_id', userId)
    } else {
      await supabase.from('languages').insert({
        id: lid,
        user_id: userId,
        language: l.language ?? '',
        level: levelNorm,
        sort_order: i,
      })
    }
  }
  for (const lid of existingLangIds) {
    if (!langIdsToKeep.includes(lid)) await supabase.from('languages').delete().eq('id', lid).eq('user_id', userId)
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
}
