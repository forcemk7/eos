import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'
import { validatePipelineStageInput } from '@/lib/jobs/pipelineTaxonomy'

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
      .select('id, apply_decision, pipeline_stage')
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

    if (type === 'pipeline_stage_set') {
      const validated = validatePipelineStageInput(body.stage)
      if (!validated.ok) {
        return NextResponse.json({ success: false, error: validated.error }, { status: 400 })
      }
      if (listing.apply_decision !== 'applied') {
        return NextResponse.json(
          { success: false, error: 'pipeline stage can only be set when apply_decision is applied' },
          { status: 400 }
        )
      }
      const previous =
        typeof listing.pipeline_stage === 'string' && listing.pipeline_stage.trim()
          ? listing.pipeline_stage.trim()
          : null
      const next = validated.value

      const { data: row, error: upErr } = await supabase
        .from('job_listings')
        .update({ pipeline_stage: next, updated_at: now })
        .eq('id', listingId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (upErr) {
        if (upErr.message?.includes('pipeline_stage') || upErr.code === '42703') {
          return NextResponse.json(
            {
              success: false,
              error:
                'Database is missing pipeline_stage column. Run backend/migrations/20250320_t8_pipeline_stage.sql (or latest schema.sql).',
            },
            { status: 503 }
          )
        }
        console.error('pipeline_stage_set update:', upErr)
        return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      }

      const { error: evErr } = await supabase.from('application_events').insert({
        user_id: user.id,
        job_listing_id: listingId,
        event_type: 'pipeline_stage_change',
        details: { stage: next, previous },
      })
      if (evErr) {
        console.error('application_events pipeline_stage_change:', evErr)
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
      {
        success: false,
        error: 'type must be apply_outbound_click, apply_decision, pipeline_stage_set, or pipeline_note',
      },
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
