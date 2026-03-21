import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'
import { isMissingSchemaObject } from '@/lib/supabase/schemaErrors'

/** POST: create off_platform job_listings row + imported_external application_event. */
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
    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null
    const snippet = typeof body.snippet === 'string' ? body.snippet.trim() || null : null
    const note = typeof body.note === 'string' ? body.note.trim() || null : null

    const rawBase: Record<string, unknown> = {
      origin: 'off_platform',
      import_method:
        typeof body.import_method === 'string' ? body.import_method : 'api',
    }
    if (note) rawBase.note = note
    if (body.raw && typeof body.raw === 'object' && body.raw !== null) {
      Object.assign(rawBase, body.raw as Record<string, unknown>)
    }

    const insert: Record<string, unknown> = {
      user_id: user.id,
      source: 'off_platform',
      title,
      company,
      url,
      location,
      remote: Boolean(body.remote),
      description,
      snippet,
      raw: rawBase,
      status: typeof body.status === 'string' ? body.status : 'saved',
    }
    if (body.external_id != null && typeof body.external_id === 'string') {
      insert.external_id = body.external_id.trim() || null
    }
    if (body.posted_at != null) {
      insert.posted_at = typeof body.posted_at === 'string' ? body.posted_at : null
    }

    const { data: row, error: insErr } = await supabase
      .from('job_listings')
      .insert(insert)
      .select()
      .single()

    if (insErr) {
      console.error('import-off-platform insert:', insErr)
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
    }

    if (!row?.id) {
      return NextResponse.json({ success: false, error: 'Insert failed' }, { status: 500 })
    }

    const listingId = row.id as string

    const { error: evErr } = await supabase.from('application_events').insert({
      user_id: user.id,
      job_listing_id: listingId,
      event_type: 'imported_external',
      details: {
        note: note ?? undefined,
      },
    })

    if (evErr && !isMissingSchemaObject(evErr)) {
      console.error('import-off-platform event:', evErr)
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
    console.error('import-off-platform:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
