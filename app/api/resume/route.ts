import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { assembleProfile, syncProfile } from '@/lib/profileDb'
import type { AssembledProfilePayload } from '@/lib/profile'
import { legacyToAssembled, legacyToPayload } from '@/lib/profile'

/** Normalize incoming body to AssembledProfilePayload (handle legacy bullets: string[] and skills: string[]). */
function normalizePayload(body: any): AssembledProfilePayload | null {
  const parsed = body.parsed ?? body
  if (!parsed || !parsed.identity) return null
  const identity = parsed.identity
  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  const experience = (parsed.experience ?? []).map((exp: any, i: number) => ({
    id: exp.id,
    title: exp.title ?? '',
    company: exp.company ?? '',
    dates: exp.dates ?? '',
    sort_order: i,
    bullets: (exp.bullets ?? []).map((b: any, j: number) =>
      typeof b === 'string' ? { text: b, sort_order: j } : { id: b.id, text: b.text ?? '', sort_order: j }
    ),
  }))
  const education = (parsed.education ?? []).map((e: any, i: number) => ({
    id: e.id,
    institution: e.institution ?? '',
    degree: e.degree ?? '',
    field_of_study: e.field_of_study ?? '',
    dates: e.dates ?? '',
    sort_order: i,
  }))
  const achievements = (parsed.achievements ?? []).map((a: any, i: number) => ({
    id: a.id,
    title: a.title ?? '',
    issuer: a.issuer ?? '',
    date: a.date ?? '',
    sort_order: i,
  }))
  const skills = (parsed.skills ?? []).map((s: any, i: number) =>
    typeof s === 'string' ? { name: s, sort_order: i } : { id: s.id, name: s.name ?? '', sort_order: i }
  )
  const languages = (parsed.languages ?? []).map((l: any, i: number) => ({
    id: l.id,
    language: l.language ?? '',
    level: l.level ?? '',
    sort_order: i,
  }))
  const additional = (parsed.additional ?? []).map((s: any) => ({
    id: s.id,
    title: s.title ?? '',
    content: Array.isArray(s.content) ? s.content : [],
  }))
  const identityWithPhone = { ...identity, phone: identity.phone ?? '' }
  return { identity: identityWithPhone, summary, experience, education, achievements, skills, languages, additional }
}

export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const assembled = await assembleProfile(supabase, user.id)

    const { data: resumeRows, error } = await supabase
      .from('resumes')
      .select('id, created_at, file_name, parsed_data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase getResumes:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const versions = (resumeRows ?? []).map((v) => ({
      id: v.id,
      created_at: v.created_at,
      file_name: v.file_name,
    }))

    let current: { id: string; created_at: string; file_name?: string; parsed_data: any } | null = null

    if (assembled) {
      current = {
        id: 'profile',
        created_at: new Date().toISOString(),
        parsed_data: assembled,
      }
    } else if (resumeRows?.length) {
      const legacy = resumeRows[0].parsed_data
      const fromLegacy = legacyToAssembled(legacy)
      if (fromLegacy) {
        current = {
          id: resumeRows[0].id,
          created_at: resumeRows[0].created_at,
          file_name: resumeRows[0].file_name,
          parsed_data: fromLegacy,
        }
      }
    }

    return jsonWithCookies({ success: true, current, versions }, response)
  } catch (err: any) {
    console.error('Error loading resume:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const payload = normalizePayload(body)
    if (!payload) {
      const legacy = body.parsed ? legacyToPayload(body.parsed) : null
      if (!legacy) {
        return NextResponse.json({ success: false, error: 'No parsed data provided' }, { status: 400 })
      }
    }

    const toSync = payload ?? legacyToPayload(body.parsed)
    if (!toSync) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }

    const assembled = await syncProfile(supabase, user.id, toSync)
    if (!assembled) {
      return NextResponse.json({ success: false, error: 'Failed to sync profile' }, { status: 500 })
    }

    const resumeId = uuidv4()
    await supabase.from('resumes').insert({
      id: resumeId,
      user_id: user.id,
      version: 1,
      raw_text: '',
      parsed_data: assembled,
      file_name: body.fileName ?? body.file_name ?? 'resume.pdf',
      storage_path: null,
    })

    return jsonWithCookies(
      {
        success: true,
        current: { id: 'profile', created_at: new Date().toISOString(), parsed_data: assembled },
      },
      response
    )
  } catch (err: any) {
    console.error('Error saving resume:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
