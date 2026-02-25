import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const DEFAULT_JSEARCH_HOST = 'jsearch.p.rapidapi.com'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const DEFAULT_MONTHLY_LIMIT = 200

/** Normalized listing returned by discover (no id, user_id, created_at, updated_at, status). */
export interface DiscoverListing {
  external_id: string | null
  source: string
  title: string
  company: string
  url: string | null
  location: string | null
  remote: boolean
  description: string | null
  snippet: string | null
  posted_at: string | null
  raw: Record<string, unknown>
}

interface JSearchJob {
  job_id?: string
  job_title?: string
  employer_name?: string
  job_apply_link?: string
  job_description?: string
  job_city?: string
  job_country?: string
  job_is_remote?: boolean
  job_posted_at_timestamp?: number
  job_min_salary?: unknown
  job_max_salary?: unknown
  [key: string]: unknown
}

interface SearchParams {
  q: string
  location: string
  remote: boolean
  page: number
}

function normalizeJob(hit: JSearchJob): DiscoverListing {
  const desc = typeof hit.job_description === 'string' ? hit.job_description : ''
  const snippet = desc.length > 300 ? desc.slice(0, 297) + '...' : desc || null
  const locationParts = [
    typeof hit.job_city === 'string' ? hit.job_city : '',
    typeof hit.job_country === 'string' ? hit.job_country : '',
  ].filter(Boolean)
  const location = locationParts.length ? locationParts.join(', ') : null
  const postedAt =
    typeof hit.job_posted_at_timestamp === 'number' && hit.job_posted_at_timestamp > 0
      ? new Date(hit.job_posted_at_timestamp * 1000).toISOString()
      : null

  return {
    external_id: typeof hit.job_id === 'string' ? hit.job_id : null,
    source: 'jsearch',
    title: typeof hit.job_title === 'string' ? hit.job_title : 'Untitled',
    company: typeof hit.employer_name === 'string' ? hit.employer_name : 'Unknown',
    url: typeof hit.job_apply_link === 'string' ? hit.job_apply_link : null,
    location,
    remote: Boolean(hit.job_is_remote),
    description: desc || null,
    snippet,
    posted_at: postedAt,
    raw: hit && typeof hit === 'object' ? { ...hit } : {},
  }
}

function paramsMatch(a: SearchParams, b: Record<string, unknown>): boolean {
  return (
    (a.q || 'jobs') === (b.q ?? 'jobs') &&
    (a.location || '') === (b.location ?? '') &&
    a.remote === Boolean(b.remote)
  )
}

/** GET: discover job listings from JSearch. Query: q, location, remote, page. Returns listings + usage. */
export async function GET(req: NextRequest) {
  const { user, supabase, response } = await createServerSupabase(req)
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

  const host = process.env.RAPIDAPI_JSEARCH_HOST?.trim() || DEFAULT_JSEARCH_HOST
  const limit = Math.max(1, parseInt(process.env.JSEARCH_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT), 10) || DEFAULT_MONTHLY_LIMIT)

  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || 'jobs'
    const location = searchParams.get('location')?.trim() || ''
    const remote = searchParams.get('remote') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)

    const params: SearchParams = { q, location, remote, page }
    const paramsForCache = { q, location, remote }

    // 1. Get current usage (for all responses)
    const { data: usageRow } = await supabase
      .from('jsearch_usage')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle()

    const used = usageRow?.request_count ?? 0

    // 2. Enforce limit before calling JSearch (cache hit does not consume a request)
    if (used >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Monthly request limit reached. Upgrade for more.',
          usage: { used, limit },
        },
        { status: 429 }
      )
    }

    // 3. Check DB cache: same user, same params, not expired
    const { data: cacheRow } = await supabase
      .from('jsearch_cache')
      .select('search_params, listings, expires_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (cacheRow && cacheRow.expires_at) {
      const expiresAt = new Date(cacheRow.expires_at as string).getTime()
      if (expiresAt > Date.now() && paramsMatch(params, (cacheRow.search_params as Record<string, unknown>) ?? {})) {
        const listings = Array.isArray(cacheRow.listings) ? cacheRow.listings as DiscoverListing[] : []
        return NextResponse.json({
          success: true,
          listings,
          usage: { used, limit },
          fromCache: true,
        })
      }
      // Expired: optionally delete so we don't keep stale row
      await supabase.from('jsearch_cache').delete().eq('user_id', user.id).lt('expires_at', now.toISOString())
    }

    // 4. Cache miss: call JSearch
    const query = location ? `${q} in ${location}` : q
    const apiParams = new URLSearchParams({
      query,
      page: String(page),
      num_pages: '1',
    })
    if (remote) {
      apiParams.set('remote_jobs_only', 'true')
    }

    const res = await fetch(`https://${host}/search?${apiParams.toString()}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('JSearch API error:', res.status, text)
      let userMessage: string
      try {
        const errBody = JSON.parse(text) as { message?: string }
        const msg = typeof errBody.message === 'string' ? errBody.message : ''
        if (res.status === 403) {
          userMessage = msg.toLowerCase().includes('subscribed')
            ? 'JSearch API: subscribe to the API on RapidAPI (free tier is enough). See README.'
            : msg || 'JSearch API access denied. Check RAPIDAPI_KEY and subscription.'
        } else if (res.status === 429) {
          userMessage = msg || 'Too many requests. Wait a moment and try again.'
        } else {
          userMessage = msg || `Job search failed (${res.status}). Try again later.`
        }
      } catch {
        userMessage = res.status === 403
          ? 'JSearch API: subscribe on RapidAPI (free tier). See README.'
          : res.status === 429
            ? 'Too many requests. Wait and try again.'
            : `Job search failed (${res.status}). Try again later.`
      }
      return NextResponse.json(
        { success: false, error: userMessage, usage: { used, limit } },
        { status: 502 }
      )
    }

    const json = (await res.json()) as { data?: JSearchJob[] }
    const hits = Array.isArray(json.data) ? json.data : []
    const listings = hits.map(normalizeJob)

    const expiresAt = new Date(Date.now() + CACHE_TTL_MS)

    // 5. Increment usage and upsert cache
    await supabase.from('jsearch_usage').upsert(
      {
        user_id: user.id,
        month,
        request_count: used + 1,
      },
      { onConflict: 'user_id,month' }
    )

    await supabase.from('jsearch_cache').upsert(
      {
        user_id: user.id,
        search_params: paramsForCache,
        listings,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.json({
      success: true,
      listings,
      usage: { used: used + 1, limit },
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
