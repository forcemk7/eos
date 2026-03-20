import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { stableExternalId } from '@/lib/jobs/stableExternalId'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'

const JSEARCH_SOURCE = 'jsearch'

function parseDiscoverBody(body: unknown): {
  source: string
  external_id: string | null
  title: string
  company: string
  url: string | null
  location: string | null
  remote: boolean
  description: string | null
  snippet: string | null
  posted_at: string | null
  raw: Record<string, unknown>
} | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const company = typeof o.company === 'string' ? o.company.trim() : ''
  if (!title && !company) return null
  const source = typeof o.source === 'string' && o.source.trim() ? o.source.trim() : JSEARCH_SOURCE
  const external_id =
    o.external_id != null && typeof o.external_id === 'string' ? o.external_id.trim() || null : null
  return {
    source,
    external_id,
    title: title || 'Untitled',
    company: company || 'Unknown',
    url: typeof o.url === 'string' ? o.url.trim() || null : null,
    location: typeof o.location === 'string' ? o.location.trim() || null : null,
    remote: Boolean(o.remote),
    description: typeof o.description === 'string' ? o.description.trim() || null : null,
    snippet: typeof o.snippet === 'string' ? o.snippet.trim() || null : null,
    posted_at: typeof o.posted_at === 'string' ? o.posted_at : null,
    raw: o.raw && typeof o.raw === 'object' && o.raw !== null ? (o.raw as Record<string, unknown>) : {},
  }
}

async function upsertFromDiscover(supabase: SupabaseClient, userId: string, parsed: NonNullable<ReturnType<typeof parseDiscoverBody>>) {
  const ext = stableExternalId({
    external_id: parsed.external_id,
    source: parsed.source,
    title: parsed.title,
    company: parsed.company,
    url: parsed.url,
  })

  const { data: existing, error: selErr } = await supabase
    .from('job_listings')
    .select('*')
    .eq('user_id', userId)
    .eq('source', parsed.source)
    .eq('external_id', ext)
    .maybeSingle()

  if (selErr) throw new Error(selErr.message)

  const now = new Date().toISOString()
  const baseRow = {
    title: parsed.title,
    company: parsed.company,
    url: parsed.url,
    location: parsed.location,
    remote: parsed.remote,
    description: parsed.description,
    snippet: parsed.snippet,
    posted_at: parsed.posted_at,
    raw: parsed.raw,
    external_id: ext,
    updated_at: now,
  }

  if (existing) {
    const { data: row, error } = await supabase
      .from('job_listings')
      .update(baseRow)
      .eq('id', (existing as { id: string }).id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  const insert = {
    ...baseRow,
    user_id: userId,
    source: parsed.source,
    status: 'saved',
    created_at: now,
  }
  const { data: row, error } = await supabase.from('job_listings').insert(insert).select().single()
  if (error) throw new Error(error.message)
  return row
}

/** POST: upsert job_listings row from discover-shaped listing; returns server id for apply-event. */
export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = parseDiscoverBody(body)
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'title or company required' }, { status: 400 })
    }

    const row = await upsertFromDiscover(supabase, user.id, parsed)
    return jsonWithCookies({ success: true, listing: rowToJobListing(row as Record<string, unknown>) }, response)
  } catch (err: unknown) {
    console.error('sync-discover:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
