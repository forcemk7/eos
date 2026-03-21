import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'
import { computeJobFit, type FitListingInput } from '@/lib/jobs/computeJobFit'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** POST: get fit score for one job listing vs current user profile. */
export async function POST(req: NextRequest) {
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

  let body: FitListingInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  try {
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
      listing: body,
    })

    return NextResponse.json(normalized)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fit check failed.'
    if (message.includes('Listing must have')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
    console.error('Job fit error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
