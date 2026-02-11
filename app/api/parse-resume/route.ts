import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabase } from '@/lib/supabase/server'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

const BUCKET = 'resumes'

async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
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

  throw new Error('Unsupported file type. Please upload PDF or DOCX.')
}

async function parseResumeWithOpenAI(text: string) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not set. Set it in your environment to enable parsing.')
  }

  const systemPrompt =
    'You are a resume parser. Given raw resume text, you output clean, structured JSON with this exact shape: ' +
    '{ identity: { name: string, email: string, location: string, links: string[] }, ' +
    'summary: string, experience: [{ title: string, company: string, dates: string, bullets: string[] }], ' +
    'skills: string[] }. ' +
    'Only output valid JSON. Do not wrap it in markdown.'

  const userPrompt = `Here is the resume text:\n\n${text}\n\nReturn only JSON.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  const parsed = JSON.parse(content || '{}')
  return parsed
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rawText = await extractTextFromFile(buffer, file.type)
    const parsed = await parseResumeWithOpenAI(rawText)

    let storagePath: string | null = null
    try {
      const path = `${user.id}/${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })
      if (!error) storagePath = path
    } catch (storageErr) {
      console.warn('Storage upload failed (bucket may not exist):', storageErr)
    }

    return NextResponse.json({
      success: true,
      rawText,
      parsed,
      fileName: file.name,
      storagePath,
    })
  } catch (err: any) {
    console.error('Error parsing resume:', err)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to parse resume.',
      },
      { status: 500 }
    )
  }
}
