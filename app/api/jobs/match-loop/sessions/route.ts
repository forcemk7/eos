import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/** GET: list strong-match loop sessions for the current user (recent first). */
export async function GET(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('match_loop_sessions')
      .select('id, title, status, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(40)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessions: data ?? [] })
  } catch (err: unknown) {
    console.error('match-loop sessions list:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to list sessions.' },
      { status: 500 }
    )
  }
}
