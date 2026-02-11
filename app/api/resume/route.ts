import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { dbHelpers } from '@/lib/database'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { user, response } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await dbHelpers.ensureUser(user.id, user.email ?? '')
    const versions = (await dbHelpers.getResumes(user.id)) as any[]

    if (!versions || versions.length === 0) {
      return jsonWithCookies({ success: true, current: null, versions: [] }, response)
    }

    const current = versions[0]
    return jsonWithCookies(
      {
        success: true,
        current: {
          id: current.id,
          created_at: current.created_at,
          file_name: current.file_name,
          parsed_data: current.parsed_data,
        },
        versions: versions.map((v) => ({
          id: v.id,
          created_at: v.created_at,
          file_name: v.file_name,
        })),
      },
      response
    )
  } catch (error: any) {
    console.error('Error loading resume:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await dbHelpers.ensureUser(user.id, user.email ?? '')

    const body = await req.json()
    const { parsed, rawText, fileName, storagePath } = body

    if (!parsed) {
      return NextResponse.json({ success: false, error: 'No parsed data provided' }, { status: 400 })
    }

    const resumeId = uuidv4()
    await dbHelpers.saveResume(
      resumeId,
      user.id,
      rawText || '',
      parsed,
      fileName || 'resume.pdf',
      1,
      storagePath ?? null
    )

    return jsonWithCookies({ success: true, resume: { id: resumeId, ...parsed } }, response)
  } catch (error: any) {
    console.error('Error saving resume:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
