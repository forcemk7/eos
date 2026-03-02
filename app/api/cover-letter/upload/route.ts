import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Cover letter image uploads: create a Storage bucket named "cover-letter" in Supabase Dashboard.
 * Private bucket; the app uses signed URLs for reads. Add Storage policies so authenticated
 * users can upload (e.g. path prefix = auth.uid()) and read/create signed URLs as needed.
 */
const BUCKET = 'cover-letter'
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** POST: upload an image for a cover letter chat. Returns { storagePath }. */
export async function POST(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('image') ?? formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json(
      { success: false, error: 'No image file. Use form field "image" or "file".' },
      { status: 400 }
    )
  }

  const f = file as File
  if (!ALLOWED_TYPES.includes(f.type)) {
    return NextResponse.json(
      { success: false, error: 'Allowed types: JPEG, PNG, WebP, GIF.' },
      { status: 400 }
    )
  }
  if (f.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ success: false, error: 'Image too large (max 10 MB).' }, { status: 400 })
  }

  const ext = f.name.split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'png'
  const path = `${user.id}/${uuidv4()}.${safeExt}`

  try {
    const buffer = Buffer.from(await f.arrayBuffer())
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: f.type,
      upsert: false,
    })
    if (error) {
      console.error('Cover letter image upload:', error)
      return NextResponse.json(
        { success: false, error: error.message || 'Upload failed. Ensure bucket "cover-letter" exists.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, storagePath: path })
  } catch (err: unknown) {
    console.error('Cover letter upload error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Upload failed.' },
      { status: 500 }
    )
  }
}
