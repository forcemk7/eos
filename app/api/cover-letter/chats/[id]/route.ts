import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

async function userOwnsJobListing(
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

const BUCKET = 'cover-letter'
const SIGNED_URL_EXPIRY_SEC = 3600

/** GET: fetch one cover letter chat and its messages. Enriches image parts with signed imageUrl. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, error: 'Chat id required.' }, { status: 400 })
  }

  try {
    const { data: chat, error: chatError } = await supabase
      .from('cover_letter_chats')
      .select('id, title, job_listing_id, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ success: false, error: 'Chat not found.' }, { status: 404 })
    }

    const { data: messages, error: msgError } = await supabase
      .from('cover_letter_messages')
      .select('id, role, content, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('cover_letter_messages list:', msgError)
      return NextResponse.json({ success: false, error: msgError.message }, { status: 500 })
    }

    const rawMessages = messages ?? []
    const enrichedMessages = await Promise.all(
      rawMessages.map(async (msg) => {
        const parts = (msg.content as { parts?: Array<{ type?: string; storagePath?: string }> } | null)?.parts ?? []
        const newParts = await Promise.all(
          parts.map(async (p) => {
            if (p.type === 'image' && typeof p.storagePath === 'string') {
              const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.storagePath, SIGNED_URL_EXPIRY_SEC)
              return { ...p, imageUrl: data?.signedUrl ?? null }
            }
            return p
          })
        )
        return { ...msg, content: { parts: newParts } }
      })
    )

    return NextResponse.json({
      success: true,
      chat,
      messages: enrichedMessages,
    })
  } catch (err: unknown) {
    console.error('Cover letter chat GET:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

/** PATCH: rename chat (update title). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, error: 'Chat id required.' }, { status: 400 })
  }

  let body: { title?: unknown; job_listing_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return NextResponse.json({ success: false, error: 'title must be a string.' }, { status: 400 })
    }
    updates.title = body.title.trim().slice(0, 200) || 'Untitled'
  }

  if (body.job_listing_id !== undefined) {
    if (body.job_listing_id === null) {
      updates.job_listing_id = null
    } else if (typeof body.job_listing_id === 'string' && body.job_listing_id.trim()) {
      const ok = await userOwnsJobListing(supabase, user.id, body.job_listing_id.trim())
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Job listing not found.' }, { status: 400 })
      }
      updates.job_listing_id = body.job_listing_id.trim()
    } else {
      return NextResponse.json(
        { success: false, error: 'job_listing_id must be a non-empty string or null.' },
        { status: 400 }
      )
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json(
      { success: false, error: 'Provide title and/or job_listing_id to update.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('cover_letter_chats')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title, job_listing_id, updated_at')
    .single()

  if (error) {
    console.error('cover_letter_chats PATCH:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ success: false, error: 'Chat not found.' }, { status: 404 })
  }
  return NextResponse.json({ success: true, chat: data })
}

/** DELETE: remove chat and its messages. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, error: 'Chat id required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('cover_letter_chats')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('cover_letter_chats DELETE:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
