import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { assembleProfile, syncProfile } from '@/lib/profileDb'
import type { AssembledProfilePayload } from '@/lib/profile'
import { legacyToAssembled, legacyToPayload } from '@/lib/profile'

type ParsedInput = Record<string, unknown> & {
  identity?: Record<string, unknown>
  summary?: unknown
  experience?: Array<Record<string, unknown>>
  education?: Array<Record<string, unknown>>
  achievements?: Array<Record<string, unknown>>
  skills?: unknown[]
  languages?: Array<Record<string, unknown>>
  additional?: Array<Record<string, unknown>>
}

/** Normalize incoming body to AssembledProfilePayload (handle legacy bullets: string[] and skills: string[]). */
function normalizePayload(body: { parsed?: unknown } | ParsedInput): AssembledProfilePayload | null {
  const parsed = (body as { parsed?: ParsedInput }).parsed ?? (body as ParsedInput)
  if (!parsed || !parsed.identity || typeof parsed.identity !== 'object') return null
  const identity = parsed.identity as Record<string, unknown>
  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  const experience = ((parsed.experience ?? []) as Array<Record<string, unknown>>).map((exp, i) => ({
    id: exp.id as string | undefined,
    title: (exp.title as string) ?? '',
    company: (exp.company as string) ?? '',
    dates: (exp.dates as string) ?? '',
    sort_order: i,
    bullets: ((exp.bullets as unknown[]) ?? []).map((b, j) =>
      typeof b === 'string' ? { text: b, sort_order: j } : { id: (b as Record<string, unknown>).id as string | undefined, text: ((b as Record<string, unknown>).text as string) ?? '', sort_order: j }
    ),
  }))
  const education = ((parsed.education ?? []) as Array<Record<string, unknown>>).map((e, i) => ({
    id: e.id as string | undefined,
    institution: (e.institution as string) ?? '',
    degree: (e.degree as string) ?? '',
    field_of_study: (e.field_of_study as string) ?? '',
    dates: (e.dates as string) ?? '',
    sort_order: i,
  }))
  const achievements = ((parsed.achievements ?? []) as Array<Record<string, unknown>>).map((a, i) => ({
    id: a.id as string | undefined,
    title: (a.title as string) ?? '',
    issuer: (a.issuer as string) ?? '',
    date: (a.date as string) ?? '',
    sort_order: i,
  }))
  const skills = ((parsed.skills ?? []) as unknown[]).map((s, i) =>
    typeof s === 'string' ? { name: s, sort_order: i } : { id: (s as Record<string, unknown>).id as string | undefined, name: ((s as Record<string, unknown>).name as string) ?? '', sort_order: i }
  )
  const languages = ((parsed.languages ?? []) as Array<Record<string, unknown>>).map((l, i) => ({
    id: l.id as string | undefined,
    language: (l.language as string) ?? '',
    level: (l.level as string) ?? '',
    sort_order: i,
  }))
  const additional = ((parsed.additional ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: s.id as string | undefined,
    title: (s.title as string) ?? '',
    content: Array.isArray(s.content) ? (s.content as string[]) : [],
  }))
  const identityOnly = {
    name: (identity.name as string) ?? '',
    email: (identity.email as string) ?? '',
    phone: (identity.phone as string) ?? '',
    location: (identity.location as string) ?? '',
  }
  const rawLinks = (parsed.links ?? identity.links) ?? []
  const links = Array.isArray(rawLinks)
    ? rawLinks.map((item: unknown) => {
        const url = typeof item === 'string' ? item : (item && typeof item === 'object' && 'url' in item ? (item as { url: string }).url : '')
        return { url: typeof url === 'string' ? url : '' }
      })
    : []
  return { identity: identityOnly, links, summary, experience, education, achievements, skills, languages, additional }
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

    let current: { id: string; created_at: string; file_name?: string; parsed_data: unknown } | null = null

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
  } catch (err: unknown) {
    console.error('Error loading resume:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
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
  } catch (err: unknown) {
    console.error('Error saving resume:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
