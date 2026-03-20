import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'

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

    return jsonWithCookies({ success: true, listing: rowToJobListing(row as Record<string, unknown>) }, response)
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

    return jsonWithCookies({ success: true, listing: rowToJobListing(row as Record<string, unknown>) }, response)
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
