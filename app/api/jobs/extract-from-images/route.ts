import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import { rowToJobListing } from '@/lib/jobs/jobListingRow'
import { extractJobListingFromImageUrls } from '@/lib/jobs/extractJobListingFromImages'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'
import { computeJobFit } from '@/lib/jobs/computeJobFit'
import { isMissingSchemaObject } from '@/lib/supabase/schemaErrors'

const BUCKET = 'cover-letter'
const SIGNED_URL_EXPIRY_SEC = 3600
const MAX_IMAGES = 4

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

function isValidUserStoragePath(userId: string, path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false
  const prefix = `${userId}/`
  return path.startsWith(prefix) && path.length > prefix.length
}

/** POST: { storage_paths: string[], run_fit?: boolean } → vision extract → job_listings insert. */
export async function POST(req: NextRequest) {
  const { user, response, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  let body: { storage_paths?: unknown; run_fit?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const pathsRaw = body.storage_paths
  if (!Array.isArray(pathsRaw) || pathsRaw.length === 0) {
    return NextResponse.json(
      { success: false, error: 'storage_paths (non-empty array) required.' },
      { status: 400 }
    )
  }

  const storage_paths = pathsRaw
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim())
    .slice(0, MAX_IMAGES)

  if (storage_paths.length === 0) {
    return NextResponse.json(
      { success: false, error: 'storage_paths must contain non-empty strings.' },
      { status: 400 }
    )
  }

  for (const p of storage_paths) {
    if (!isValidUserStoragePath(user.id, p)) {
      return NextResponse.json(
        { success: false, error: 'Invalid storage path (must be under your user folder).' },
        { status: 400 }
      )
    }
  }

  const run_fit = Boolean(body.run_fit)

  try {
    const signedUrls: string[] = []
    for (const path of storage_paths) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC)
      if (error || !data?.signedUrl) {
        console.error('extract-from-images signed URL:', error)
        return NextResponse.json(
          { success: false, error: 'Could not read one or more images from storage.' },
          { status: 400 }
        )
      }
      signedUrls.push(data.signedUrl)
    }

    const extracted = await extractJobListingFromImageUrls(openai, signedUrls)

    const insert: Record<string, unknown> = {
      user_id: user.id,
      source: 'off_platform',
      title: extracted.title,
      company: extracted.company,
      url: extracted.url,
      location: extracted.location,
      remote: extracted.remote,
      description: extracted.description,
      snippet: null,
      raw: {
        origin: 'off_platform',
        import_method: 'vision_extract',
        storage_paths: storage_paths,
      },
      status: 'saved',
    }

    const { data: row, error: insErr } = await supabase
      .from('job_listings')
      .insert(insert)
      .select()
      .single()

    if (insErr) {
      console.error('extract-from-images insert:', insErr)
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
    }

    if (!row?.id) {
      return NextResponse.json({ success: false, error: 'Insert failed' }, { status: 500 })
    }

    const listingId = row.id as string

    const { error: evErr } = await supabase.from('application_events').insert({
      user_id: user.id,
      job_listing_id: listingId,
      event_type: 'imported_external',
      details: {
        import_method: 'vision_extract',
        storage_paths,
      },
    })

    if (evErr && !isMissingSchemaObject(evErr)) {
      console.error('extract-from-images event:', evErr)
    }

    const { data: fresh } = await supabase.from('job_listings').select('*').eq('id', listingId).single()
    const listing = rowToJobListing((fresh ?? row) as Record<string, unknown>)

    let fit: Awaited<ReturnType<typeof computeJobFit>> | null = null
    if (run_fit) {
      const profile = await assembleProfile(supabase, user.id)
      if (profile) {
        const summary = buildProfileSummaryForLLM(profile)
        try {
          fit = await computeJobFit({
            openai,
            profileSummaryForLLM: summary,
            listing: {
              title: listing.title,
              company: listing.company,
              description: listing.description,
              snippet: listing.snippet,
              location: listing.location,
              remote: listing.remote,
            },
          })
        } catch (e) {
          console.error('extract-from-images fit:', e)
        }
      }
    }

    return jsonWithCookies({ success: true, listing, extracted, fit }, response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Extraction failed.'
    console.error('extract-from-images:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
