import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { runJSearchDiscover } from '@/lib/jobs/jsearchClient'
import type { DiscoverListing, DiscoverListingWithApply } from '@/lib/jobs/discoverListing'

export type { DiscoverListing, DiscoverListingWithApply } from '@/lib/jobs/discoverListing'

/** GET: discover job listings from JSearch. Query: q, location, remote, page. Returns listings + usage. */
export async function GET(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.RAPIDAPI_KEY
  if (!key) {
    return NextResponse.json(
      { success: false, error: 'RAPIDAPI_KEY is not set. Add it to enable job discovery.' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || 'jobs'
  const location = searchParams.get('location')?.trim() || ''
  const remote = searchParams.get('remote') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)

  try {
    const outcome = await runJSearchDiscover({
      supabase,
      userId: user.id,
      rapidApiKey: key,
      bypassCache: false,
      params: { q, location, remote, page },
    })

    if (!outcome.ok) {
      if (outcome.code === 'limit') {
        return NextResponse.json(
          {
            success: false,
            error: outcome.error,
            usage: outcome.usage,
          },
          { status: 429 }
        )
      }
      if (outcome.code === 'api') {
        return NextResponse.json(
          { success: false, error: outcome.error, usage: outcome.usage },
          { status: 502 }
        )
      }
      return NextResponse.json({ success: false, error: outcome.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      listings: outcome.listings,
      usage: outcome.usage,
      fromCache: outcome.fromCache,
    })
  } catch (err: unknown) {
    console.error('Discover jobs error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Discovery failed.',
      },
      { status: 500 }
    )
  }
}
