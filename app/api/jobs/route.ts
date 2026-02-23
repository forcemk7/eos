import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export interface JobListingRow {
  id: string
  user_id: string
  external_id: string | null
  source: string
  title: string
  company: string
  url: string | null
  location: string | null
  remote: boolean
  description: string | null
  snippet: string | null
  posted_at: string | null
  raw: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

function rowToJson(row: Record<string, unknown>): JobListingRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    external_id: (row.external_id as string) ?? null,
    source: (row.source as string) ?? 'manual',
    title: (row.title as string) ?? '',
    company: (row.company as string) ?? '',
    url: (row.url as string) ?? null,
    location: (row.location as string) ?? null,
    remote: Boolean(row.remote),
    description: (row.description as string) ?? null,
    snippet: (row.snippet as string) ?? null,
    posted_at: (row.posted_at as string) ?? null,
    raw: typeof row.raw === 'object' && row.raw !== null ? (row.raw as Record<string, unknown>) : {},
    status: (row.status as string) ?? 'saved',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

/** GET: list job listings for the user. Query: status, keywords (comma), location, remote (true/false). */
export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const location = searchParams.get('location') ?? undefined
    const remote = searchParams.get('remote')
    const q = searchParams.get('q')?.trim()

    let query = supabase
      .from('job_listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (location) query = query.ilike('location', `%${location}%`)
    if (remote === 'true') query = query.eq('remote', true)
    if (q) {
      const pattern = `%${q}%`
      query = query.or(`title.ilike.${pattern},company.ilike.${pattern},description.ilike.${pattern},snippet.ilike.${pattern}`)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Supabase job_listings list:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const listings = (rows ?? []).map((r) => rowToJson(r as Record<string, unknown>))
    return jsonWithCookies({ success: true, listings }, response)
  } catch (err: unknown) {
    console.error('Error listing jobs:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/** POST: create a job listing. Body: { title, company, url?, location?, remote?, description?, snippet?, source?, external_id? }. */
export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const company = typeof body.company === 'string' ? body.company.trim() : ''
    if (!title && !company) {
      return NextResponse.json({ success: false, error: 'title or company required' }, { status: 400 })
    }

    const insert: Record<string, unknown> = {
      user_id: user.id,
      source: typeof body.source === 'string' ? body.source : 'manual',
      title: title || 'Untitled',
      company: company || 'Unknown',
      url: typeof body.url === 'string' ? body.url.trim() || null : null,
      location: typeof body.location === 'string' ? body.location.trim() || null : null,
      remote: Boolean(body.remote),
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      snippet: typeof body.snippet === 'string' ? body.snippet.trim() || null : null,
      raw: body.raw && typeof body.raw === 'object' ? body.raw : {},
      status: typeof body.status === 'string' ? body.status : 'saved',
    }
    if (body.external_id != null && typeof body.external_id === 'string') {
      insert.external_id = body.external_id.trim() || null
    }
    if (body.posted_at != null) {
      insert.posted_at = typeof body.posted_at === 'string' ? body.posted_at : null
    }

    const { data: row, error } = await supabase
      .from('job_listings')
      .insert(insert)
      .select()
      .single()

    if (error) {
      console.error('Supabase job_listings insert:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, listing: rowToJson(row as Record<string, unknown>) }, response)
  } catch (err: unknown) {
    console.error('Error creating job:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
