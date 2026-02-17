import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const run_id = searchParams.get('run_id')

    let query = supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (run_id) {
      query = query.eq('run_id', run_id)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, entries: data || [] }, response)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
