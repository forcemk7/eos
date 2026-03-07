import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'

const LISTING_MAX_LEN = 15_000

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** Minimal listing shape for the request body. */
interface FitListingBody {
  title?: string
  company?: string
  description?: string | null
  snippet?: string | null
  location?: string | null
  remote?: boolean
}

const SYSTEM_PROMPT = `You compare a job listing to a candidate profile and estimate how well the candidate fits the role. This is a light ATS-style fit indicator, not a guarantee.

Output only valid JSON, no other text. Use exactly this shape:
{ "score": number, "label": string, "feedback": string }

- score: number from 0 to 100. How well the candidate's experience, skills, and background match the job requirements. Be realistic: 0–30 poor fit, 31–50 okay/stretch, 51–75 good fit, 76–100 strong fit.
- label: exactly one of "bad", "okay", "good", "great". bad = poor fit (score ~0–30), okay = stretch/possible (31–50), good = solid match (51–75), great = strong match (76–100).
- feedback: 1–3 sentences in plain language explaining why this score: what matches well, what’s missing or is a stretch, and any concrete suggestion. Be specific to the listing and the candidate (e.g. "Your 5 years in X align with the role’s requirement; the posting asks for Y which isn’t on your profile."). No bullet points or markdown.`

function buildListingText(listing: FitListingBody): string {
  const parts: string[] = []
  if (listing.title) parts.push(`Title: ${listing.title}`)
  if (listing.company) parts.push(`Company: ${listing.company}`)
  if (listing.location) parts.push(`Location: ${listing.location}`)
  if (listing.remote) parts.push('Remote: Yes')
  const body = listing.description?.trim() || listing.snippet?.trim() || ''
  if (body) parts.push('\nDescription:\n' + body)
  const text = parts.join('\n')
  return text.length > LISTING_MAX_LEN
    ? text.slice(0, LISTING_MAX_LEN) + '\n\n[Listing truncated for length.]'
    : text
}

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

  let body: FitListingBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const listingText = buildListingText(body)
  if (!listingText.trim()) {
    return NextResponse.json(
      { success: false, error: 'Listing must have at least title, company, or description/snippet.' },
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
    const userContent = `Job listing:\n\n${listingText}\n\nCandidate profile:\n\n${summary}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content?.trim()
    if (!raw) {
      return NextResponse.json(
        { success: false, error: 'No response from model.' },
        { status: 500 }
      )
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    let score = typeof parsed.score === 'number' ? Math.round(Math.max(0, Math.min(100, parsed.score))) : 50
    let label = typeof parsed.label === 'string' ? parsed.label.toLowerCase() : 'okay'
    const allowed = ['bad', 'okay', 'good', 'great']
    if (!allowed.includes(label)) {
      if (score <= 30) label = 'bad'
      else if (score <= 50) label = 'okay'
      else if (score <= 75) label = 'good'
      else label = 'great'
    }
    const feedback =
      typeof parsed.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : typeof (parsed as { brief_reason?: string }).brief_reason === 'string'
          ? (parsed as { brief_reason: string }).brief_reason.trim()
          : null

    return NextResponse.json({ success: true, score, label, feedback: feedback ?? null })
  } catch (err: unknown) {
    console.error('Job fit error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fit check failed.' },
      { status: 500 }
    )
  }
}
