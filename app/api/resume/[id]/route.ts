import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { mapRowToVersionTailoring } from '@/lib/resumeTailoring'

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
    const { data: version, error } = await supabase
      .from('resumes')
      .select(
        `id, created_at, file_name, parsed_data,
         job_listing_id, tailored_title, tailored_company, tailored_url, jd_snapshot, tailored_source_tab,
         job_listings ( external_id, source, title, company, url )`
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !version) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    const tailoring = mapRowToVersionTailoring({
      job_listing_id: version.job_listing_id ?? null,
      tailored_title: version.tailored_title ?? null,
      tailored_company: version.tailored_company ?? null,
      tailored_url: version.tailored_url ?? null,
      tailored_source_tab: version.tailored_source_tab ?? null,
      job_listings: version.job_listings as unknown,
    })

    return jsonWithCookies(
      {
        success: true,
        version: {
          id: version.id,
          created_at: version.created_at,
          file_name: version.file_name,
          parsed_data: version.parsed_data ?? {},
          tailoring,
        },
      },
      response
    )
  } catch (err: unknown) {
    console.error('Error loading resume version:', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
