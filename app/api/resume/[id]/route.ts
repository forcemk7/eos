import { NextRequest, NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/database'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const version = await dbHelpers.getResumeById(id)
    if (!version) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    if ((version as any).user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return jsonWithCookies(
      {
        success: true,
        version: {
          id: (version as any).id,
          created_at: (version as any).created_at,
          file_name: (version as any).file_name,
          parsed_data: (version as any).parsed_data,
        },
      },
      response
    )
  } catch (error: any) {
    console.error('Error loading resume version:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
