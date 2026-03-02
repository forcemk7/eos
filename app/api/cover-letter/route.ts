import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'

const LISTING_MAX_LEN = 15_000

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const SYSTEM_PROMPT = `You write a professional, tailored cover letter. Output plain text only — no markdown, no JSON, no extra commentary.

Rules:
- Use only the facts provided in the candidate profile; do not invent experience, skills, or qualifications.
- Address the role and company mentioned in the job listing. Match tone and key requirements where the candidate fits.
- Keep it concise (one page when printed). Start with a brief hook, then 2–3 short paragraphs, then a closing line.`

/** POST: generate a first-draft cover letter from job listing + user Data. */
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

  let body: { listingText?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const raw = typeof body.listingText === 'string' ? body.listingText : ''
  const listingText = raw.trim()
  if (!listingText) {
    return NextResponse.json(
      { success: false, error: 'listingText is required and cannot be empty.' },
      { status: 400 }
    )
  }
  const truncated =
    listingText.length > LISTING_MAX_LEN
      ? listingText.slice(0, LISTING_MAX_LEN) + '\n\n[Listing truncated for length.]'
      : listingText

  try {
    const profile = await assembleProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Complete your Data first.' },
        { status: 400 }
      )
    }

    const summary = buildProfileSummaryForLLM(profile)
    const userContent = `Job listing:\n\n${truncated}\n\nCandidate profile:\n\n${summary}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    const draft = response.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ success: true, draft })
  } catch (err: unknown) {
    console.error('Cover letter generate error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Generate failed.' },
      { status: 500 }
    )
  }
}
