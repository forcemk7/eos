import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** GET: listings with any apply activity + recent events (JSON or ?format=csv). */
export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')

    const { data: rows, error: listErr } = await supabase
      .from('job_listings')
      .select('*')
      .eq('user_id', user.id)
      .or('apply_outbound_at.not.is.null,apply_decision.not.is.null')
      .order('updated_at', { ascending: false })
      .limit(500)

    if (listErr) {
      console.error('application-report listings:', listErr)
      return NextResponse.json({ success: false, error: listErr.message }, { status: 500 })
    }

    const listings = (rows ?? []).map((r) => rowToJobListing(r as Record<string, unknown>))

    const { data: events, error: evErr } = await supabase
      .from('application_events')
      .select('id, job_listing_id, event_type, details, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (evErr) {
      console.error('application-report events:', evErr)
      return NextResponse.json({ success: false, error: evErr.message }, { status: 500 })
    }

    if (format === 'csv') {
      const header = [
        'id',
        'title',
        'company',
        'url',
        'source',
        'apply_outbound_at',
        'apply_decision',
        'apply_decision_at',
        'apply_notes',
        'apply_remind_at',
      ]
      const lines = [
        header.join(','),
        ...listings.map((L) =>
          [
            L.id,
            L.title,
            L.company,
            L.url ?? '',
            L.source,
            L.apply_outbound_at ?? '',
            L.apply_decision ?? '',
            L.apply_decision_at ?? '',
            L.apply_notes ?? '',
            L.apply_remind_at ?? '',
          ]
            .map((c) => csvEscape(String(c)))
            .join(',')
        ),
      ]
      const csv = lines.join('\r\n')
      const headers = new Headers(response.headers)
      headers.set('Content-Type', 'text/csv; charset=utf-8')
      headers.set('Content-Disposition', 'attachment; filename="earnOS-application-report.csv"')
      return new NextResponse(csv, { status: 200, headers })
    }

    return jsonWithCookies(
      {
        success: true,
        listings,
        events: events ?? [],
      },
      response
    )
  } catch (err: unknown) {
    console.error('application-report:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
