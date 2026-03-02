import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export interface JobQualificationsRow {
  search_query: string
  location: string | null
  remote: boolean
  generated_at: string
}

const SYSTEM_PROMPT = `You output JSON only. Given a candidate profile, suggest job search parameters that would surface roles they are qualified for, including reasonable stretch or adjacent roles (not only exact title matches).

Output exactly this JSON shape, no other text:
{ "search_query": string, "location": string | null, "remote": boolean }

- search_query: Keywords only for the job search API. Use 2–5 words: job title or role (e.g. "software engineer", "product manager", "technical project manager"). No location, no punctuation, no symbols, no "in" or commas. The API will use this string as the sole search query; location and remote are applied separately.
- location: city or region for display only if they have a location (e.g. "Sandnes, Norway"); otherwise null. Do not put location inside search_query.
- remote: true if they should see remote jobs (default true when in doubt).`

/** GET: return current job_qualifications for the user. */
export async function GET(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: row, error } = await supabase
      .from('job_qualifications')
      .select('search_query, location, remote, generated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('job_qualifications GET:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!row) {
      return NextResponse.json({ success: true, qualifications: null })
    }

    const qualifications: JobQualificationsRow = {
      search_query: typeof row.search_query === 'string' ? row.search_query : 'jobs',
      location: typeof row.location === 'string' ? row.location : null,
      remote: Boolean(row.remote),
      generated_at: typeof row.generated_at === 'string' ? row.generated_at : new Date().toISOString(),
    }
    return NextResponse.json({ success: true, qualifications })
  } catch (err: unknown) {
    console.error('Qualifications GET error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

/** POST: generate job_qualifications from user Data via LLM and upsert. */
export async function POST(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  try {
    const profile = await assembleProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Complete your Data first.' },
        { status: 400 }
      )
    }

    const summaryText = buildProfileSummaryForLLM(profile)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: summaryText },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    let search_query = 'jobs'
    let location: string | null = null
    let remote = true

    if (content) {
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>
        if (typeof parsed.search_query === 'string' && parsed.search_query.trim()) {
          search_query = parsed.search_query.trim()
        }
        if (parsed.location === null || typeof parsed.location === 'string') {
          location = parsed.location === null ? null : (parsed.location as string).trim() || null
        }
        if (typeof parsed.remote === 'boolean') {
          remote = parsed.remote
        }
      } catch {
        // use fallbacks above
      }
    }

    const generated_at = new Date().toISOString()
    const { error: upsertError } = await supabase.from('job_qualifications').upsert(
      {
        user_id: user.id,
        search_query,
        location,
        remote,
        generated_at,
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      console.error('job_qualifications upsert:', upsertError)
      return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 })
    }

    const qualifications: JobQualificationsRow = {
      search_query,
      location,
      remote,
      generated_at,
    }
    return NextResponse.json({ success: true, qualifications })
  } catch (err: unknown) {
    console.error('Qualifications generate error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Generate failed.' },
      { status: 500 }
    )
  }
}
