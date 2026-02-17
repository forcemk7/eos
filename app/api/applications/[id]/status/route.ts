import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'

const VALID_STATUSES = ['applied', 'interview', 'offer', 'rejected']

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = params
    const { status } = await req.json()

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Supabase updateApplicationStatus:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return jsonWithCookies({ success: true, application: { id, status } }, response)
  } catch (error: any) {
    console.error('Error updating application:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
