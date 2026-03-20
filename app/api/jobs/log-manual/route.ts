import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'
import { isMissingSchemaObject } from '@/lib/supabase/schemaErrors'

/** POST: log an off-platform application (manual listing + optional apply state + events). */
export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const company = typeof body.company === 'string' ? body.company.trim() : ''
    if (!title || !company) {
      return NextResponse.json({ success: false, error: 'Title and company are required.' }, { status: 400 })
    }

    const url = typeof body.url === 'string' ? body.url.trim() || null : null
    const location = typeof body.location === 'string' ? body.location.trim() || null : null
    const note = typeof body.note === 'string' ? body.note.trim() || null : null
    const markApplied = Boolean(body.mark_applied)

    const now = new Date().toISOString()

    const baseInsert: Record<string, unknown> = {
      user_id: user.id,
      source: 'manual',
      title,
      company,
      url,
      location,
      remote: Boolean(body.remote),
      description: null,
      snippet: null,
      raw: { logged_via: 'manual_application' },
      status: 'saved',
    }

    const richInsert = {
      ...baseInsert,
      apply_outbound_at: markApplied ? now : null,
      apply_decision: markApplied ? 'applied' : null,
      apply_decision_at: markApplied ? now : null,
      apply_notes: note,
      apply_remind_at: null,
    }

    let row: Record<string, unknown> | null = null
    let insErr = null as { message?: string; code?: string } | null

    const attempt = await supabase.from('job_listings').insert(richInsert).select().single()
    row = (attempt.data as Record<string, unknown>) ?? null
    insErr = attempt.error

    if (insErr && isMissingSchemaObject(insErr)) {
      const fallback = await supabase.from('job_listings').insert(baseInsert).select().single()
      if (fallback.error) {
        console.error('log-manual insert fallback:', fallback.error)
        return NextResponse.json({ success: false, error: fallback.error.message }, { status: 500 })
      }
      row = fallback.data as Record<string, unknown>
      insErr = null
    } else if (insErr) {
      console.error('log-manual insert:', insErr)
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
    }

    if (!row?.id) {
      return NextResponse.json({ success: false, error: 'Insert failed' }, { status: 500 })
    }

    const listingId = row.id as string

    const { error: evErr } = await supabase.from('application_events').insert({
      user_id: user.id,
      job_listing_id: listingId,
      event_type: 'manual_entry',
      details: {
        mark_applied: markApplied,
        note: note ?? undefined,
      },
    })

    if (evErr && !isMissingSchemaObject(evErr)) {
      console.error('log-manual event:', evErr)
    }

    const { data: fresh } = await supabase.from('job_listings').select('*').eq('id', listingId).single()

    return jsonWithCookies(
      {
        success: true,
        listing: rowToJobListing((fresh ?? row) as Record<string, unknown>),
      },
      response
    )
  } catch (err: unknown) {
    console.error('log-manual:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
