import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** GET: one session with iterations. Query compare=id1,id2 for two iteration rows (same session). */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: sessionId } = await params
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Missing session id.' }, { status: 400 })
  }

  try {
    const { data: session, error: sErr } = await supabase
      .from('match_loop_sessions')
      .select('id, user_id, title, status, created_at, updated_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sErr || !session) {
      return NextResponse.json({ success: false, error: 'Session not found.' }, { status: 404 })
    }

    const { data: iterations, error: iErr } = await supabase
      .from('match_loop_iterations')
      .select('*')
      .eq('session_id', sessionId)
      .order('iteration_index', { ascending: true })

    if (iErr) {
      return NextResponse.json({ success: false, error: iErr.message }, { status: 500 })
    }

    const compareParam = new URL(req.url).searchParams.get('compare')
    let compare: { a: unknown; b: unknown } | null = null
    if (compareParam) {
      const parts = compareParam.split(',').map((s) => s.trim()).filter(Boolean)
      if (parts.length === 2) {
        const [idA, idB] = parts
        const a = (iterations ?? []).find((it) => it.id === idA)
        const b = (iterations ?? []).find((it) => it.id === idB)
        if (a && b) {
          compare = { a, b }
        }
      }
    }

    return NextResponse.json({
      success: true,
      session,
      iterations: iterations ?? [],
      compare,
    })
  } catch (err: unknown) {
    console.error('match-loop session get:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load session.' },
      { status: 500 }
    )
  }
}
