import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'

const DECISIONS = new Set(['applied', 'not_applied', 'later'])

/** POST: log apply outbound click or user decision; append application_events row. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: listingId } = await params
    const body = await req.json()
    const type = typeof body.type === 'string' ? body.type : ''

    const { data: listing, error: findErr } = await supabase
      .from('job_listings')
      .select('id')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findErr || !listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    if (type === 'apply_outbound_click') {
      const { data: row, error: upErr } = await supabase
        .from('job_listings')
        .update({ apply_outbound_at: now, updated_at: now })
        .eq('id', listingId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (upErr) {
        console.error('apply_outbound_click update:', upErr)
        return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      }

      const { error: evErr } = await supabase.from('application_events').insert({
        user_id: user.id,
        job_listing_id: listingId,
        event_type: 'apply_outbound_click',
        details: {},
      })
      if (evErr) {
        console.error('application_events insert:', evErr)
        return NextResponse.json({ success: false, error: evErr.message }, { status: 500 })
      }

      return jsonWithCookies({ success: true, listing: rowToJobListing(row as Record<string, unknown>) }, response)
    }

    if (type === 'apply_decision') {
      const decision = typeof body.decision === 'string' ? body.decision : ''
      if (!DECISIONS.has(decision)) {
        return NextResponse.json(
          { success: false, error: 'decision must be applied, not_applied, or later' },
          { status: 400 }
        )
      }
      const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
      let remindAt: string | null = null
      if (body.remind_at != null) {
        if (typeof body.remind_at === 'string' && body.remind_at.trim()) {
          const d = new Date(body.remind_at)
          remindAt = Number.isNaN(d.getTime()) ? null : d.toISOString()
        }
      }
      if (decision !== 'later') remindAt = null

      const { data: row, error: upErr } = await supabase
        .from('job_listings')
        .update({
          apply_decision: decision,
          apply_decision_at: now,
          apply_notes: notes,
          apply_remind_at: remindAt,
          updated_at: now,
        })
        .eq('id', listingId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (upErr) {
        console.error('apply_decision update:', upErr)
        return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      }

      const { error: evErr } = await supabase.from('application_events').insert({
        user_id: user.id,
        job_listing_id: listingId,
        event_type: 'apply_decision',
        details: { decision, notes: notes ?? undefined, remind_at: remindAt ?? undefined },
      })
      if (evErr) {
        console.error('application_events insert:', evErr)
        return NextResponse.json({ success: false, error: evErr.message }, { status: 500 })
      }

      return jsonWithCookies({ success: true, listing: rowToJobListing(row as Record<string, unknown>) }, response)
    }

    if (type === 'pipeline_note') {
      const note = typeof body.note === 'string' ? body.note.trim() : ''
      if (!note) {
        return NextResponse.json({ success: false, error: 'note is required' }, { status: 400 })
      }

      const { error: evErr } = await supabase.from('application_events').insert({
        user_id: user.id,
        job_listing_id: listingId,
        event_type: 'pipeline_note',
        details: { note },
      })
      if (evErr) {
        console.error('pipeline_note insert:', evErr)
        return NextResponse.json({ success: false, error: evErr.message }, { status: 500 })
      }

      const { data: row, error: upErr } = await supabase
        .from('job_listings')
        .update({ updated_at: now })
        .eq('id', listingId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (upErr || !row) {
        return NextResponse.json({ success: false, error: upErr?.message ?? 'Update failed' }, { status: 500 })
      }

      return jsonWithCookies({ success: true, listing: rowToJobListing(row as Record<string, unknown>) }, response)
    }

    return NextResponse.json(
      { success: false, error: 'type must be apply_outbound_click, apply_decision, or pipeline_note' },
      { status: 400 }
    )
  } catch (err: unknown) {
    console.error('apply-event:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
