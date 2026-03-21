import OpenAI from 'openai'
import { normalizeJobFitPayload, type JobFitSuccessResponse } from '@/lib/jobsFit'

const LISTING_MAX_LEN = 15_000

export interface FitListingInput {
  title?: string
  company?: string
  description?: string | null
  snippet?: string | null
  location?: string | null
  remote?: boolean
}

export const JOB_FIT_SYSTEM_PROMPT = `You compare a job listing to a candidate profile and estimate how well the candidate fits the role. This is a rough, profile-based estimate—not a guarantee of how any employer or ATS will score them. Recruiting stacks and tools vary widely; many systems use keyword filters, structured resume fields, and human review.

Output only valid JSON, no other text. Use exactly this shape:
{
  "score": number,
  "label": string,
  "summary": string,
  "feedback": string,
  "screening_likelihood": string,
  "factors": array,
  "data_actions": array,
  "jd_phrases": array
}

- score: 0–100. Realistic bands: 0–30 poor fit, 31–50 stretch/possible, 51–75 solid, 76–100 strong.
- label: exactly one of "bad", "okay", "good", "great" matching the score bands above.
- summary: at most 2 short sentences; each sentence should carry one clear idea (e.g. main alignment vs main gap). Overall fit in plain language, grounded in the profile and posting—no run-on paragraphs.
- feedback: same substance as summary (duplicate is fine); kept for older clients.
- screening_likelihood: exactly one of "qualified", "borderline", "unlikely". This is your estimate of how the candidate might fare in typical first-pass screening given only this profile and posting—not a prediction of hire. Align with score: higher scores → qualified, mid → borderline, low → unlikely.
- factors: up to 8 objects, each { "category", "sentiment", "detail" }:
  - category: one of "experience_overlap", "keywords", "seniority_tenure", "education", "location_remote", "other"
  - sentiment: one of "strength", "gap", "neutral"
  - detail: one sentence tying something concrete on the candidate profile to something emphasized (or missing) relative to the posting. Do not invent profile facts. Mention location or work authorization only if the posting or profile clearly raises it; otherwise omit those angles.
- data_actions: 2–5 short imperative suggestions for improving the stored profile or resume text (Profile), each grounded in a gap you identified.
- jd_phrases: 0–3 short snippets or close paraphrases from the listing body when citing a requirement (empty array if none are clear).

Avoid false precision, vendor-specific ATS claims, and bullet characters in string values. No markdown in JSON strings.`

export function buildListingTextForFit(listing: FitListingInput): string {
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

/** Single listing fit vs pre-built profile summary (for API route and batch orchestration). */
export async function computeJobFit(args: {
  openai: OpenAI
  profileSummaryForLLM: string
  listing: FitListingInput
}): Promise<JobFitSuccessResponse> {
  const listingText = buildListingTextForFit(args.listing)
  if (!listingText.trim()) {
    throw new Error('Listing must have at least title, company, or description/snippet.')
  }

  const userContent = `Job listing:\n\n${listingText}\n\nCandidate profile:\n\n${args.profileSummaryForLLM}`

  const response = await args.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: JOB_FIT_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) {
    throw new Error('No response from model.')
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>
  return normalizeJobFitPayload(parsed)
}
