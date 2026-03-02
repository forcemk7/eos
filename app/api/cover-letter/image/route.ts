import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const BUCKET = 'cover-letter'
const SIGNED_URL_EXPIRY_SEC = 3600

/** GET: return a signed URL for an image in the cover-letter bucket. Query: path=userId/... (storage path). */
export async function GET(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ success: false, error: 'path required.' }, { status: 400 })
  }
  if (!path.startsWith(user.id + '/')) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY_SEC)
    if (error) {
      console.error('Cover letter image signed URL:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!data?.signedUrl) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, url: data.signedUrl })
  } catch (err: unknown) {
    console.error('Cover letter image GET:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
