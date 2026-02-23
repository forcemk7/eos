import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { createServerSupabase } from '@/lib/supabase/server'
import { normalizeParsedOutput } from '@/lib/profile'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const PARSER_SYSTEM =
  'You are a career/resume data extractor. From the given content, extract structured information. Output valid JSON only, no markdown. ' +
  'identity: { name, email, phone, location, links: string[] } — links is an array of URLs only (e.g. LinkedIn, portfolio, GitHub). ' +
  'experience: [{ title, company, dates (display string), start_date (YYYY-MM-DD or null), end_date (YYYY-MM-DD or null), bullets: string[] }]. ' +
  'education: [{ institution, degree, field_of_study, dates, start_date, end_date }]. ' +
  'achievements: [{ title, issuer, date (ISO YYYY-MM-DD when possible) }]. ' +
  'skills: string[]. languages: [{ language, level }] where level is exactly one of: native, fluent, advanced, intermediate, basic, other. ' +
  'additional: [{ title, content: string[] }]. summary: string. Use empty strings or empty arrays for missing fields.'

const VISION_SYSTEM =
  'You are a career/resume data extractor. Extract all career information from this image. Output valid JSON only, no markdown. ' +
  'identity: { name, email, phone, location, links: string[] } — links is an array of URLs only. ' +
  'experience: [{ title, company, dates, start_date (YYYY-MM-DD or null), end_date, bullets }]. ' +
  'education: [{ institution, degree, field_of_study, dates, start_date, end_date }]. ' +
  'achievements: [{ title, issuer, date }]. skills: string[]. languages: [{ language, level }] with level one of: native, fluent, advanced, intermediate, basic, other. ' +
  'additional: [{ title, content: string[] }]. summary: string. Use empty strings or empty arrays for missing fields.'

async function parseTextWithLLM(text: string): Promise<Record<string, unknown>> {
  if (!openai) throw new Error('OPENAI_API_KEY is not set.')
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PARSER_SYSTEM },
      { role: 'user', content: `Content:\n\n${text.slice(0, 120000)}\n\nReturn only JSON.` },
    ],
    response_format: { type: 'json_object' },
  })
  const content = response.choices[0]?.message?.content
  return normalizeParsedOutput(JSON.parse(content || '{}') as Record<string, unknown>)
}

async function parseImageWithLLM(buffer: Buffer, mimeType: string): Promise<Record<string, unknown>> {
  if (!openai) throw new Error('OPENAI_API_KEY is not set.')
  const base64 = buffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VISION_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all career/resume information from this image. Return only valid JSON.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 4096,
  })
  const content = response.choices[0]?.message?.content
  if (!content) return {}
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : {}
  return normalizeParsedOutput(parsed)
}

async function extractTextFromDocument(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer)
    return data.text
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  throw new Error(`Unsupported document type: ${mimeType}`)
}

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const AUDIO_VIDEO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/webm',
  'audio/x-wav',
  'video/mp4',
  'video/webm',
  'video/mpeg',
])

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
    const contentType = req.headers.get('content-type') || ''
    let parsed: Record<string, unknown>
    let source = 'unknown'

    if (contentType.includes('application/json')) {
      const body = await req.json()
      const text = body.text ?? body.paste ?? ''
      if (!text || typeof text !== 'string') {
        return NextResponse.json({ success: false, error: 'No text provided.' }, { status: 400 })
      }
      parsed = await parseTextWithLLM(text)
      source = 'text'
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const pastedText = formData.get('text') as string | null

      if (pastedText && pastedText.trim()) {
        parsed = await parseTextWithLLM(pastedText.trim())
        source = 'text'
      } else if (!file) {
        return NextResponse.json({ success: false, error: 'No file or text provided.' }, { status: 400 })
      } else {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mime = (file.type || '').toLowerCase()

        if (mime === 'text/plain' || file.name?.toLowerCase().endsWith('.txt')) {
          const text = buffer.toString('utf-8')
          parsed = await parseTextWithLLM(text)
          source = 'text'
        } else if (IMAGE_TYPES.has(mime)) {
          parsed = await parseImageWithLLM(buffer, mime)
          source = 'image'
        } else if (AUDIO_VIDEO_TYPES.has(mime) || mime.startsWith('audio/') || mime.startsWith('video/')) {
          const ext = mime.includes('m4a') ? 'm4a' : mime.includes('webm') ? 'webm' : mime.includes('wav') ? 'wav' : 'mp3'
          const transcript = await openai.audio.transcriptions.create({
            file: await toFile(buffer, `audio.${ext}`),
            model: 'whisper-1',
          })
          const text = typeof transcript === 'object' && transcript?.text ? transcript.text : String(transcript)
          parsed = await parseTextWithLLM(text || '(No speech detected)')
          source = 'audio'
        } else if (mime === 'application/pdf' || mime.includes('wordprocessingml') || mime === 'application/msword') {
          const text = await extractTextFromDocument(buffer, mime)
          parsed = await parseTextWithLLM(text)
          source = 'document'
        } else {
          return NextResponse.json(
            { success: false, error: `Unsupported type: ${mime}. Use document (PDF, DOCX), text, image, or audio.` },
            { status: 400 }
          )
        }
      }
    } else {
      return NextResponse.json({ success: false, error: 'Send multipart/form-data with a file or JSON with text.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      parsed,
      source,
    })
  } catch (err: unknown) {
    console.error('Ingest error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Ingest failed.' },
      { status: 500 }
    )
  }
}
