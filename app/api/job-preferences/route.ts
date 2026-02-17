import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('job_preferences')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({
      success: true,
      preferences: data || {
        titles: [],
        keywords: [],
        locations: [],
        remote_only: false,
        max_applications_per_run: 10,
      },
    }, response)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { titles, keywords, locations, remote_only, max_applications_per_run } = body

    const { data, error } = await supabase
      .from('job_preferences')
      .upsert(
        {
          user_id: user.id,
          titles: titles || [],
          keywords: keywords || [],
          locations: locations || [],
          remote_only: remote_only ?? false,
          max_applications_per_run: max_applications_per_run ?? 10,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, preferences: data }, response)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
