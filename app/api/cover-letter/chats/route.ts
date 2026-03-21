import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

/** GET: list current user's cover letter chats, newest first. */
export async function GET(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('cover_letter_chats')
      .select('id, title, job_listing_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('cover_letter_chats list:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, chats: data ?? [] })
  } catch (err: unknown) {
    console.error('Cover letter chats GET:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

async function assertUserOwnsListing(
  supabase: SupabaseClient,
  userId: string,
  jobListingId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('job_listings')
    .select('id')
    .eq('id', jobListingId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

/** POST: create a new cover letter chat. Body: { job_listing_id?: string | null } */
export async function POST(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let job_listing_id: string | null = null
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  if (body && typeof body.job_listing_id === 'string' && body.job_listing_id.trim()) {
    const id = body.job_listing_id.trim()
    const ok = await assertUserOwnsListing(supabase, user.id, id)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Job listing not found.' }, { status: 400 })
    }
    job_listing_id = id
  }

  try {
    const { data: chat, error } = await supabase
      .from('cover_letter_chats')
      .insert({ user_id: user.id, job_listing_id })
      .select('id, title, job_listing_id, created_at, updated_at')
      .single()

    if (error) {
      console.error('cover_letter_chats insert:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, chat })
  } catch (err: unknown) {
    console.error('Cover letter chats POST:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
