import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

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
    const { resumeData, jobDescription } = body

    if (!resumeData || !jobDescription) {
      return NextResponse.json(
        { success: false, error: 'Both resumeData and jobDescription are required.' },
        { status: 400 }
      )
    }

    const systemPrompt = `You are an expert career coach. You receive a candidate's resume as JSON and a job description.

Your job:
1. Rewrite the resume to be strongly tailored to the job description. Keep it truthful — do not invent experience — but reword bullets, reorder skills, and adjust the summary to emphasise what this specific role values. Output the tailored resume as JSON with the exact same shape as the input.
2. Write a concise, professional cover letter (3-4 paragraphs) addressed to the hiring team. Reference specific requirements from the job description and connect them to the candidate's experience.

Return a single JSON object with two keys:
{
  "tailoredResume": { /* same shape as input resumeData */ },
  "coverLetter": "string — the full cover letter text"
}

Only output valid JSON. Do not wrap it in markdown.`

    const userPrompt = `RESUME:\n${JSON.stringify(resumeData, null, 2)}\n\nJOB DESCRIPTION:\n${jobDescription}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const content = response.choices[0].message.content
    const parsed = JSON.parse(content || '{}')

    if (!parsed.tailoredResume || !parsed.coverLetter) {
      return NextResponse.json(
        { success: false, error: 'AI returned an unexpected format.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tailoredResume: parsed.tailoredResume,
      coverLetter: parsed.coverLetter,
    })
  } catch (err: any) {
    console.error('Error in /api/tailor:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to tailor resume.' },
      { status: 500 }
    )
  }
}
