import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: rows, error } = await supabase
      .from('resumes')
      .select('id, created_at, file_name, parsed_data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase getResumes:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!rows?.length) {
      return jsonWithCookies({ success: true, current: null, versions: [] }, response)
    }

    const current = rows[0]
    return jsonWithCookies(
      {
        success: true,
        current: {
          id: current.id,
          created_at: current.created_at,
          file_name: current.file_name,
          parsed_data: current.parsed_data ?? {},
        },
        versions: rows.map((v) => ({
          id: v.id,
          created_at: v.created_at,
          file_name: v.file_name,
        })),
      },
      response
    )
  } catch (err: any) {
    console.error('Error loading resume:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { parsed, rawText, fileName, storagePath } = body

    if (!parsed) {
      return NextResponse.json({ success: false, error: 'No parsed data provided' }, { status: 400 })
    }

    const resumeId = uuidv4()
    const { error } = await supabase.from('resumes').insert({
      id: resumeId,
      user_id: user.id,
      version: 1,
      raw_text: rawText ?? '',
      parsed_data: parsed,
      file_name: fileName ?? 'resume.pdf',
      storage_path: storagePath ?? null,
    })

    if (error) {
      console.error('Supabase saveResume:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, resume: { id: resumeId, ...parsed } }, response)
  } catch (err: any) {
    console.error('Error saving resume:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
