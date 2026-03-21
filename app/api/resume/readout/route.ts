import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { buildTargetProfileSummaryForLLM } from '@/lib/targetProfileSummaryForLLM'
import { normalizedResumeData, type ResumeData } from '@/lib/profile'
import { listArchetypesForPrompt } from '@/lib/jobs/archetypeTaxonomy'
import {
  candidateReadoutRulesForPrompt,
  parseArtifactReadoutRoot,
  fallbackArtifactReadout,
  toArtifactReadoutResponse,
  type ArtifactReadoutResponse,
} from '@/lib/jobs/candidateReadout'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const ARTIFACT_READOUT_PROMPT = `You output JSON only. Given structured resume fields, describe how recruiters and ATS-style screening might bucket this document as an artifact (what this resume emphasizes), not a full biography.

Output exactly this JSON shape, no other text:
{
  "primary_archetype": string,
  "secondary_archetypes": string[],
  "tags": [
    { "key": string, "label": string, "rationale": string, "evidence_paths": string[] }
  ]
}

Allowed archetype slugs (use exactly these string values):
${listArchetypesForPrompt()}

${candidateReadoutRulesForPrompt().replace(/profile JSON/g, 'resume JSON').replace(/profile facts/g, 'resume fields')}

Frame rationales as how a reader would infer labels from this document only; do not invent employers, degrees, or skills not present.`

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

  try {
    let body: { parsed?: unknown; versionId?: string }
    try {
      body = (await req.json()) as { parsed?: unknown; versionId?: string }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    let resumeData: ResumeData | null = null

    if (typeof body.versionId === 'string' && body.versionId.trim()) {
      const { data: ver, error } = await supabase
        .from('resumes')
        .select('parsed_data')
        .eq('id', body.versionId.trim())
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      if (!ver?.parsed_data) {
        return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
      }
      resumeData = normalizedResumeData(ver.parsed_data as ResumeData)
    } else if (body.parsed && typeof body.parsed === 'object') {
      resumeData = normalizedResumeData(body.parsed as ResumeData)
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide parsed resume data or versionId' },
        { status: 400 }
      )
    }

    const generated_at = new Date().toISOString()
    const summaryText = buildTargetProfileSummaryForLLM(resumeData)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ARTIFACT_READOUT_PROMPT },
        {
          role: 'user',
          content: `Resume fields (for labeling this document):\n\n${summaryText}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    let parsedRoot: Record<string, unknown> = {}
    try {
      if (content) parsedRoot = JSON.parse(content) as Record<string, unknown>
    } catch {
      parsedRoot = {}
    }

    let readout = parseArtifactReadoutRoot(parsedRoot, generated_at)
    if (readout.tags.length === 0) {
      readout = fallbackArtifactReadout(generated_at)
    } else if (!readout.primary_archetype) {
      readout = { ...readout, primary_archetype: 'generalist' }
    }

    const payload: ArtifactReadoutResponse = toArtifactReadoutResponse(readout)
    return NextResponse.json({ success: true, readout: payload })
  } catch (err: unknown) {
    console.error('resume readout error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
