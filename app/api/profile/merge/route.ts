import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { assembleProfile, mergeIntoProfile } from '@/lib/profileDb'
import type { AssembledProfilePayload } from '@/lib/profile'
import { legacyToAssembled } from '@/lib/profile'

function toPayload(parsed: any): AssembledProfilePayload | null {
  if (!parsed?.identity) return null
  const assembled = legacyToAssembled(parsed)
  if (!assembled) return null
  return {
    identity: assembled.identity,
    summary: assembled.summary,
    experience: assembled.experience.map((e) => ({
      id: e.id,
      title: e.title,
      company: e.company,
      dates: e.dates,
      sort_order: e.sort_order,
      bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, sort_order: b.sort_order })),
    })),
    education: assembled.education.map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      field_of_study: e.field_of_study,
      dates: e.dates,
      sort_order: e.sort_order,
    })),
    achievements: assembled.achievements.map((a) => ({
      id: a.id,
      title: a.title,
      issuer: a.issuer,
      date: a.date,
      sort_order: a.sort_order,
    })),
    skills: assembled.skills.map((s) => ({ id: s.id, name: s.name, sort_order: s.sort_order })),
    languages: (assembled.languages ?? []).map((l) => ({
      id: l.id,
      language: l.language,
      level: l.level,
      sort_order: l.sort_order,
    })),
    additional: (assembled.additional ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
    })),
  }
}

export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = body.parsed ?? body
    const payload = toPayload(parsed)
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid or missing parsed data' }, { status: 400 })
    }

    const assembled = await mergeIntoProfile(supabase, user.id, payload)
    if (!assembled) {
      return NextResponse.json({ success: false, error: 'Merge failed' }, { status: 500 })
    }

    return jsonWithCookies({ success: true, profile: assembled }, response)
  } catch (err: any) {
    console.error('Profile merge error:', err)
    return NextResponse.json({ success: false, error: err?.message ?? 'Merge failed' }, { status: 500 })
  }
}
