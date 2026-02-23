import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const JOB_EXTRACT_SYSTEM =
  'You are a job listing extractor. From the given job description or paste, extract structured fields. Output valid JSON only, no markdown. ' +
  'Use: title (string), company (string), location (string or null), remote (boolean), description (string, full or summary), snippet (string, short 1-2 sentence summary). ' +
  'If a posted date is mentioned, use posted_at (ISO date string or null). Use empty string or null for missing fields.'

export interface ExtractedJob {
  title: string
  company: string
  url?: string | null
  location?: string | null
  remote?: boolean
  description?: string | null
  snippet?: string | null
  posted_at?: string | null
}

async function extractFromText(text: string): Promise<ExtractedJob> {
  if (!openai) throw new Error('OPENAI_API_KEY is not set.')
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: JOB_EXTRACT_SYSTEM },
      { role: 'user', content: `Job content:\n\n${text.slice(0, 30000)}\n\nReturn only JSON.` },
    ],
    response_format: { type: 'json_object' },
  })
  const content = response.choices[0]?.message?.content
  const raw = JSON.parse(content || '{}') as Record<string, unknown>
  return {
    title: (raw.title as string) ?? '',
    company: (raw.company as string) ?? '',
    location: (raw.location as string) ?? null,
    remote: Boolean(raw.remote),
    description: (raw.description as string) ?? null,
    snippet: (raw.snippet as string) ?? null,
    posted_at: (raw.posted_at as string) ?? null,
  }
}

/** POST: extract structured job listing from pasted text (and optional url). Body: { text, url? }. */
export async function POST(req: NextRequest) {
  const { user } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not set.' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const url = typeof body.url === 'string' ? body.url.trim() || null : null

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'text is required for extraction. Paste the job description.' },
        { status: 400 }
      )
    }

    const extracted = await extractFromText(text)
    if (url) extracted.url = url

    return NextResponse.json({
      success: true,
      listing: extracted,
    })
  } catch (err: unknown) {
    console.error('Job extract error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Extraction failed.' },
      { status: 500 }
    )
  }
}
