import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'
import type { ApplicationReportMeta } from '@/lib/jobs/applicationReportMeta'
import { isMissingSchemaObject } from '@/lib/supabase/schemaErrors'

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** GET: listings with apply activity or manual logs + recent events (JSON or ?format=csv). */
export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const meta: ApplicationReportMeta = {
    applyTrackingReady: true,
    eventsReady: true,
    suggestDatabaseMigration: false,
  }

  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')

    let rows: Record<string, unknown>[] | null = null

    const primary = await supabase
      .from('job_listings')
      .select('*')
      .eq('user_id', user.id)
      .or('apply_outbound_at.not.is.null,apply_decision.not.is.null,source.eq.manual')
      .order('updated_at', { ascending: false })
      .limit(500)

    if (primary.error) {
      if (isMissingSchemaObject(primary.error)) {
        meta.applyTrackingReady = false
        meta.suggestDatabaseMigration = true
        const fallback = await supabase
          .from('job_listings')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(500)
        if (fallback.error) {
          console.error('application-report fallback listings:', fallback.error)
          return NextResponse.json({ success: false, error: fallback.error.message }, { status: 500 })
        }
        rows = (fallback.data ?? []) as Record<string, unknown>[]
      } else {
        console.error('application-report listings:', primary.error)
        return NextResponse.json({ success: false, error: primary.error.message }, { status: 500 })
      }
    } else {
      rows = (primary.data ?? []) as Record<string, unknown>[]
    }

    const listings = (rows ?? []).map((r) => rowToJobListing(r))

    let events: Record<string, unknown>[] = []
    const evRes = await supabase
      .from('application_events')
      .select('id, job_listing_id, event_type, details, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (evRes.error) {
      if (isMissingSchemaObject(evRes.error)) {
        meta.eventsReady = false
        meta.suggestDatabaseMigration = true
      } else {
        console.error('application-report events:', evRes.error)
        return NextResponse.json({ success: false, error: evRes.error.message }, { status: 500 })
      }
    } else {
      events = (evRes.data ?? []) as Record<string, unknown>[]
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
        events,
        meta,
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
