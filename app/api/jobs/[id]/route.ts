import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

function rowToJson(row: Record<string, unknown>) {
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { data: row, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !row) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    return jsonWithCookies({ success: true, listing: rowToJson(row as Record<string, unknown>) }, response)
  } catch (err: unknown) {
    console.error('Error fetching job:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/** PATCH: update listing (e.g. status, or any field). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const allowed = ['title', 'company', 'url', 'location', 'remote', 'description', 'snippet', 'status', 'posted_at', 'raw']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'remote') updates[key] = Boolean(body[key])
        else if (key === 'raw' && body[key] != null && typeof body[key] === 'object') updates[key] = body[key]
        else if (typeof body[key] === 'string') updates[key] = body[key].trim() || null
        else if (key === 'posted_at') updates[key] = body[key]
        else updates[key] = body[key]
      }
    }

    const { data: row, error } = await supabase
      .from('job_listings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase job_listings update:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    return jsonWithCookies({ success: true, listing: rowToJson(row as Record<string, unknown>) }, response)
  } catch (err: unknown) {
    console.error('Error updating job:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { error } = await supabase
      .from('job_listings')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Supabase job_listings delete:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true }, response)
  } catch (err: unknown) {
    console.error('Error deleting job:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
