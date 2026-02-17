import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('platform_credentials')
      .select('id, platform, email, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, credentials: data || [] }, response)
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
    const { platform, email, encrypted_password } = body

    if (!platform || !email || !encrypted_password) {
      return NextResponse.json(
        { success: false, error: 'Platform, email, and encrypted_password are required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('platform_credentials')
      .upsert(
        {
          user_id: user.id,
          platform: platform.toLowerCase(),
          email,
          encrypted_password,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' }
      )
      .select('id, platform, email, created_at')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, credential: data }, response, 201)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('platform_credentials')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true }, response)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
