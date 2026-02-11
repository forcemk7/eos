import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { data: version, error } = await supabase
      .from('resumes')
      .select('id, created_at, file_name, parsed_data')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !version) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    return jsonWithCookies(
      {
        success: true,
        version: {
          id: version.id,
          created_at: version.created_at,
          file_name: version.file_name,
          parsed_data: version.parsed_data ?? {},
        },
      },
      response
    )
  } catch (err: any) {
    console.error('Error loading resume version:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
