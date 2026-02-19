import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export interface ResumeSuggestion {
  id: string
  path: string
  currentValue: string
  suggestedValue: string
  reason: string
}

/** Paths we support for applying suggestions. */
const VALID_PATHS = new Set([
  'identity.name',
  'identity.email',
  'identity.location',
  'identity.links',
  'summary',
  'skills',
  ...Array.from({ length: 20 }, (_, i) => `experience.${i}.title`),
  ...Array.from({ length: 20 }, (_, i) => `experience.${i}.company`),
  ...Array.from({ length: 20 }, (_, i) => `experience.${i}.dates`),
  ...Array.from({ length: 20 }, (_, i) => `experience.${i}.bullets`),
].flat())

function parseSuggestionsFromResponse(content: string): ResumeSuggestion[] {
  const suggestions: ResumeSuggestion[] = []
  try {
    const parsed = JSON.parse(content)
    const list = Array.isArray(parsed) ? parsed : parsed.suggestions
    if (!Array.isArray(list)) return []
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      const path = (s.path || s.fieldPath || '').trim()
      if (!path || !VALID_PATHS.has(path)) continue
      suggestions.push({
        id: `s-${i}-${path}`,
        path,
        currentValue: typeof s.currentValue === 'string' ? s.currentValue : String(s.currentValue ?? ''),
        suggestedValue: typeof s.suggestedValue === 'string' ? s.suggestedValue : String(s.suggestedValue ?? ''),
        reason: typeof s.reason === 'string' ? s.reason : 'Improve impact and clarity',
      })
    }
  } catch {
    // ignore
  }
  return suggestions
}

export async function POST(req: NextRequest) {
  const { user } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { resumeData, jobDescription } = body as { resumeData: any; jobDescription?: string }

    if (!resumeData) {
      return NextResponse.json(
        { success: false, error: 'resumeData is required.' },
        { status: 400 }
      )
    }

    const hasJob = typeof jobDescription === 'string' && jobDescription.trim().length > 0

    const systemPrompt = `You are an expert resume coach. Your goal is to help the candidate get past screening (including ATS) and look strong to human recruiters. You do NOT rewrite the whole resume; you output a short list of discrete, actionable edits.

Output a JSON array of suggestions. Each suggestion has:
- "path": one of these exact paths: identity.name, identity.email, identity.location, identity.links, summary, skills, experience.0.title, experience.0.company, experience.0.dates, experience.0.bullets, experience.1.title, ... (use the correct index for each experience entry). For "identity.links" use newline-separated values. For "experience.N.bullets" use newline-separated bullet strings. For "skills" use comma-separated.
- "currentValue": the exact current string at that path (as the candidate has it).
- "suggestedValue": your improved version (same format: newline for bullets/links, comma for skills).
- "reason": one short sentence why this change helps (e.g. "Stronger action verb; more quantifiable" or "ATS keyword from job description").

Rules:
- Give 3–8 suggestions. Prefer high-impact edits (summary, bullets, skills).
- Do not invent experience or facts. Only reword and reorder.
- Keep suggestedValue concise. For bullets, one line per bullet.
${hasJob ? '- Prioritize aligning wording and keywords with the job description so the resume passes ATS and resonates with the role.' : '- Focus on clarity, impact, and ATS-friendly wording in general.'}

Output a single JSON object with key "suggestions" (array of the objects above). No markdown. Example:
{"suggestions":[{"path":"summary","currentValue":"...","suggestedValue":"...","reason":"..."}]}`

    const userPrompt = hasJob
      ? `RESUME (JSON):\n${JSON.stringify(resumeData, null, 2)}\n\nJOB DESCRIPTION (use for keyword/role alignment):\n${jobDescription.trim()}\n\nReturn the JSON object with "suggestions" array only.`
      : `RESUME (JSON):\n${JSON.stringify(resumeData, null, 2)}\n\nReturn the JSON object with "suggestions" array only.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ success: true, suggestions: [] })
    }

    // Model may return { "suggestions": [...] } or direct array
    let suggestions = parseSuggestionsFromResponse(content)
    return NextResponse.json({ success: true, suggestions })
  } catch (err: any) {
    console.error('Resume suggest error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to get suggestions' },
      { status: 500 }
    )
  }
}
