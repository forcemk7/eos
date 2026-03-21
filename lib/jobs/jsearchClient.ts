import type { SupabaseClient } from '@supabase/supabase-js'
import type { DiscoverListing } from '@/lib/jobs/discoverListing'
import { mergeDiscoverApplyState } from '@/lib/jobs/mergeDiscoverApplyState'
import type { DiscoverListingWithApply } from '@/lib/jobs/discoverListing'

export const DEFAULT_JSEARCH_HOST = 'jsearch.p.rapidapi.com'
export const JSEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const JSEARCH_DEFAULT_MONTHLY_LIMIT = 200

export interface JSearchDiscoverParams {
  q: string
  location: string
  remote: boolean
  page: number
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
  [key: string]: unknown
}

export function normalizeJSearchJob(hit: JSearchJob): DiscoverListing {
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

export function jsearchParamsMatch(a: JSearchDiscoverParams, b: Record<string, unknown>): boolean {
  const bPage = typeof b.page === 'number' ? b.page : parseInt(String(b.page ?? '1'), 10) || 1
  return (
    (a.q || 'jobs') === (b.q ?? 'jobs') &&
    (a.location || '') === (b.location ?? '') &&
    a.remote === Boolean(b.remote) &&
    a.page === bPage
  )
}

function jsearchErrorMessage(status: number, text: string): string {
  try {
    const errBody = JSON.parse(text) as { message?: string }
    const msg = typeof errBody.message === 'string' ? errBody.message : ''
    if (status === 403) {
      return msg.toLowerCase().includes('subscribed')
        ? 'JSearch API: subscribe to the API on RapidAPI (free tier is enough). See README.'
        : msg || 'JSearch API access denied. Check RAPIDAPI_KEY and subscription.'
    }
    if (status === 429) {
      return msg || 'Too many requests. Wait a moment and try again.'
    }
    return msg || `Job search failed (${status}). Try again later.`
  } catch {
    if (status === 403) return 'JSearch API: subscribe on RapidAPI (free tier). See README.'
    if (status === 429) return 'Too many requests. Wait and try again.'
    return `Job search failed (${status}). Try again later.`
  }
}

export async function fetchJSearchListings(
  host: string,
  apiKey: string,
  params: JSearchDiscoverParams
): Promise<{ ok: true; listings: DiscoverListing[] } | { ok: false; status: number; message: string }> {
  const q = params.q.trim() || 'jobs'
  const location = params.location.trim()
  const query = location ? `${q} in ${location}` : q
  const apiParams = new URLSearchParams({
    query,
    page: String(Math.max(1, params.page)),
    num_pages: '1',
  })
  if (params.remote) {
    apiParams.set('remote_jobs_only', 'true')
  }

  const res = await fetch(`https://${host}/search?${apiParams.toString()}`, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': host,
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('JSearch API error:', res.status, text)
    return { ok: false, status: res.status, message: jsearchErrorMessage(res.status, text) }
  }

  const json = (await res.json()) as { data?: JSearchJob[] }
  const hits = Array.isArray(json.data) ? json.data : []
  return { ok: true, listings: hits.map(normalizeJSearchJob) }
}

export type RunJSearchDiscoverOutcome =
  | {
      ok: true
      listings: DiscoverListingWithApply[]
      usage: { used: number; limit: number }
      fromCache: boolean
      jsearchRequestsDelta: 0 | 1
    }
  | { ok: false; error: string; usage?: { used: number; limit: number }; code: 'limit' | 'api' | 'internal' }

export async function runJSearchDiscover(args: {
  supabase: SupabaseClient
  userId: string
  rapidApiKey: string
  host?: string
  monthlyLimit?: number
  params: JSearchDiscoverParams
  /** Skip cache read; still updates cache after a live API call. */
  bypassCache?: boolean
}): Promise<RunJSearchDiscoverOutcome> {
  const host = args.host?.trim() || DEFAULT_JSEARCH_HOST
  const envLimit = parseInt(
    process.env.JSEARCH_MONTHLY_LIMIT ?? String(JSEARCH_DEFAULT_MONTHLY_LIMIT),
    10
  )
  const resolvedLimit =
    args.monthlyLimit ?? (Number.isFinite(envLimit) && envLimit > 0 ? envLimit : JSEARCH_DEFAULT_MONTHLY_LIMIT)
  const limit = Math.max(1, resolvedLimit)

  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  const paramsForCache = {
    q: args.params.q.trim() || 'jobs',
    location: args.params.location.trim(),
    remote: args.params.remote,
    page: Math.max(1, args.params.page),
  }
  const params: JSearchDiscoverParams = {
    q: paramsForCache.q,
    location: paramsForCache.location,
    remote: paramsForCache.remote,
    page: paramsForCache.page,
  }

  const { data: usageRow } = await args.supabase
    .from('jsearch_usage')
    .select('request_count')
    .eq('user_id', args.userId)
    .eq('month', month)
    .maybeSingle()

  const used = usageRow?.request_count ?? 0

  if (used >= limit) {
    return {
      ok: false,
      error: 'Monthly request limit reached. Upgrade for more.',
      usage: { used, limit },
      code: 'limit',
    }
  }

  if (!args.bypassCache) {
    const { data: cacheRow } = await args.supabase
      .from('jsearch_cache')
      .select('search_params, listings, expires_at')
      .eq('user_id', args.userId)
      .maybeSingle()

    if (cacheRow && cacheRow.expires_at) {
      const expiresAt = new Date(cacheRow.expires_at as string).getTime()
      if (expiresAt > Date.now() && jsearchParamsMatch(params, (cacheRow.search_params as Record<string, unknown>) ?? {})) {
        const rawListings = Array.isArray(cacheRow.listings) ? (cacheRow.listings as DiscoverListing[]) : []
        const listings = await mergeDiscoverApplyState(args.supabase, args.userId, rawListings)
        return {
          ok: true,
          listings,
          usage: { used, limit },
          fromCache: true,
          jsearchRequestsDelta: 0,
        }
      }
      await args.supabase.from('jsearch_cache').delete().eq('user_id', args.userId).lt('expires_at', now.toISOString())
    }
  }

  const fetched = await fetchJSearchListings(host, args.rapidApiKey, params)
  if (!fetched.ok) {
    return {
      ok: false,
      error: fetched.message,
      usage: { used, limit },
      code: 'api',
    }
  }

  const expiresAt = new Date(Date.now() + JSEARCH_CACHE_TTL_MS)

  await args.supabase.from('jsearch_usage').upsert(
    {
      user_id: args.userId,
      month,
      request_count: used + 1,
    },
    { onConflict: 'user_id,month' }
  )

  await args.supabase.from('jsearch_cache').upsert(
    {
      user_id: args.userId,
      search_params: paramsForCache,
      listings: fetched.listings,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'user_id' }
  )

  const listings = await mergeDiscoverApplyState(args.supabase, args.userId, fetched.listings)

  return {
    ok: true,
    listings,
    usage: { used: used + 1, limit },
    fromCache: false,
    jsearchRequestsDelta: 1,
  }
}
