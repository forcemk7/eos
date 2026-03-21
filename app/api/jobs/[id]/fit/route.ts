import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'
import { computeJobFit } from '@/lib/jobs/computeJobFit'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** POST: job fit for a saved listing id (same logic as POST /api/jobs/fit). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, error: 'Listing id required.' }, { status: 400 })
  }

  try {
    const { data: row, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !row) {
      return NextResponse.json({ success: false, error: 'Listing not found.' }, { status: 404 })
    }

    const listing = rowToJobListing(row as Record<string, unknown>)

    const profile = await assembleProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Complete your Data first.' },
        { status: 400 }
      )
    }

    const summary = buildProfileSummaryForLLM(profile)
    const normalized = await computeJobFit({
      openai,
      profileSummaryForLLM: summary,
      listing: {
        title: listing.title,
        company: listing.company,
        description: listing.description,
        snippet: listing.snippet,
        location: listing.location,
        remote: listing.remote,
      },
    })

    return NextResponse.json(normalized)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fit check failed.'
    if (message.includes('Listing must have')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
    console.error('Job fit by id error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
