import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'
import { runJSearchDiscover } from '@/lib/jobs/jsearchClient'
import { computeJobFit } from '@/lib/jobs/computeJobFit'
import {
  isStrongMatch,
  STRONG_MATCH_CRITERIA,
  STRONG_MATCH_CRITERIA_DESCRIPTION,
  type JobFitSuccessResponse,
} from '@/lib/jobsFit'
import type { DiscoverListingWithApply } from '@/lib/jobs/discoverListing'
import {
  toJobSearchAnchor,
  type JobQualificationsDbRow,
} from '@/lib/jobs/jobSearchAnchor'
import {
  suggestNextSearchRules,
  suggestNextSearchLLM,
  compactEvalsForLLM,
  type LoopSearchParams,
} from '@/lib/jobs/matchLoopSuggest'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const DEFAULT_MAX_EVALUATE = 10
const FIT_CONCURRENCY = 3

interface StepBody {
  action: 'start' | 'continue'
  session_id?: string | null
  overrides?: Partial<LoopSearchParams>
  max_evaluate?: number
  force_refresh?: boolean
}

function defaultParamsFromQual(row: Record<string, unknown> | null): LoopSearchParams {
  if (!row) return { q: 'jobs', location: '', remote: true, page: 1 }
  return {
    q: typeof row.search_query === 'string' && row.search_query.trim() ? row.search_query.trim() : 'jobs',
    location: typeof row.location === 'string' ? row.location.trim() : '',
    remote: Boolean(row.remote ?? true),
    page: 1,
  }
}

function applyOverrides(base: LoopSearchParams, o?: Partial<LoopSearchParams>): LoopSearchParams {
  if (!o) return base
  return {
    q: o.q !== undefined ? (o.q.trim() || base.q) : base.q,
    location: o.location !== undefined ? o.location.trim() : base.location,
    remote: o.remote !== undefined ? o.remote : base.remote,
    page: o.page !== undefined ? Math.max(1, o.page) : base.page,
  }
}

async function runPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) break
      results[i] = await fn(items[i], i)
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1))
  await Promise.all(Array.from({ length: items.length ? n : 0 }, worker))
  return results
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  const rapidKey = process.env.RAPIDAPI_KEY
  if (!rapidKey) {
    return NextResponse.json(
      { success: false, error: 'RAPIDAPI_KEY is not set. Add it to enable job discovery.' },
      { status: 500 }
    )
  }

  let body: StepBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (body.action !== 'start' && body.action !== 'continue') {
    return NextResponse.json({ success: false, error: 'action must be "start" or "continue".' }, { status: 400 })
  }

  const maxEvaluate = Math.min(
    25,
    Math.max(1, typeof body.max_evaluate === 'number' ? body.max_evaluate : DEFAULT_MAX_EVALUATE)
  )

  try {
    const profile = await assembleProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Complete your Data first.' },
        { status: 400 }
      )
    }

    const profileSummary = buildProfileSummaryForLLM(profile)

    const { data: qualRow } = await supabase
      .from('job_qualifications')
      .select(
        'search_query, location, remote, generated_at, target_roles, target_sectors, profile_as_of, dismissed_role_keys, dismissed_sector_keys, pinned_role_key'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    const anchor = qualRow ? toJobSearchAnchor(qualRow as JobQualificationsDbRow) : null
    const fallbackAnchor = anchor ?? {
      primary_query: 'jobs',
      alternate_queries: [] as string[],
      sectors: [] as string[],
      remote_default: true,
      location_hint: null as string | null,
      pinned_role_key: null as string | null,
      dismissed_role_keys: [] as string[],
      dismissed_sector_keys: [] as string[],
      generated_at: new Date().toISOString(),
      profile_as_of: null as string | null,
    }

    let sessionId: string
    let iterationIndex: number
    let refinementSource: 'initial' | 'rules' | 'llm' | 'user_override'
    let searchParams: LoopSearchParams
    const priorIterations: {
      id: string
      iteration_index: number
      search_params: unknown
      suggested_next: unknown
      evaluations: unknown
    }[] = []

    if (body.action === 'start') {
      const { data: session, error: sErr } = await supabase
        .from('match_loop_sessions')
        .insert({
          user_id: user.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (sErr || !session) {
        console.error('match_loop_sessions insert:', sErr)
        return NextResponse.json({ success: false, error: sErr?.message || 'Could not start session.' }, { status: 500 })
      }

      sessionId = session.id as string
      iterationIndex = 1
      const base = defaultParamsFromQual(qualRow as Record<string, unknown> | null)
      searchParams = applyOverrides(base, body.overrides)
      refinementSource = body.overrides && Object.keys(body.overrides).length > 0 ? 'user_override' : 'initial'
    } else {
      if (!body.session_id || typeof body.session_id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'continue requires session_id.' },
          { status: 400 }
        )
      }

      const { data: session, error: sessErr } = await supabase
        .from('match_loop_sessions')
        .select('id')
        .eq('id', body.session_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (sessErr || !session) {
        return NextResponse.json({ success: false, error: 'Session not found.' }, { status: 404 })
      }

      sessionId = session.id as string

      const { data: iters, error: itErr } = await supabase
        .from('match_loop_iterations')
        .select('id, iteration_index, search_params, suggested_next, evaluations')
        .eq('session_id', sessionId)
        .order('iteration_index', { ascending: true })

      if (itErr) {
        return NextResponse.json({ success: false, error: itErr.message }, { status: 500 })
      }

      priorIterations.push(...(iters ?? []))
      const last = priorIterations[priorIterations.length - 1]
      if (!last) {
        return NextResponse.json(
          { success: false, error: 'Session has no iterations; use action start.' },
          { status: 400 }
        )
      }

      iterationIndex = last.iteration_index + 1

      const lastExecuted = last.search_params as LoopSearchParams
      const snRaw = last.suggested_next as Record<string, unknown> | null
      const fromSuggested: LoopSearchParams | null =
        snRaw && typeof snRaw === 'object' && typeof snRaw.q === 'string'
          ? {
              q: snRaw.q.trim() || 'jobs',
              location: typeof snRaw.location === 'string' ? snRaw.location : '',
              remote: Boolean(snRaw.remote),
              page: typeof snRaw.page === 'number' && snRaw.page >= 1 ? snRaw.page : 1,
            }
          : null

      if (body.overrides && Object.keys(body.overrides).length > 0) {
        const base = fromSuggested ?? lastExecuted
        searchParams = applyOverrides(base, body.overrides)
        refinementSource = 'user_override'
      } else {
        if (fromSuggested) {
          searchParams = fromSuggested
          const src = typeof snRaw?.params_source === 'string' ? snRaw.params_source : 'rules'
          refinementSource = src === 'llm' ? 'llm' : 'rules'
        } else {
          const baseLast = lastExecuted
          const rules = suggestNextSearchRules({
            anchor: fallbackAnchor,
            iterations: priorIterations,
            lastParams: baseLast,
          })
          if (rules) {
            searchParams = rules
            refinementSource = 'rules'
          } else if (openai) {
            const evals = (last.evaluations as { fit?: JobFitSuccessResponse; title?: string; company?: string }[]) ?? []
            const compact = compactEvalsForLLM(
              evals.filter((e): e is { fit: JobFitSuccessResponse; title?: string; company?: string } => Boolean(e.fit))
            )
            const tried = priorIterations.map((i) => JSON.stringify(i.search_params)).join(' | ')
            searchParams = await suggestNextSearchLLM({
              openai,
              anchor: fallbackAnchor,
              profileSummary,
              lastParams: baseLast,
              evaluations: compact,
              triedHint: tried.slice(0, 2000),
            })
            refinementSource = 'llm'
          } else {
            searchParams = { ...baseLast, page: baseLast.page + 1 }
            refinementSource = 'rules'
          }
        }
      }
    }

    const discover = await runJSearchDiscover({
      supabase,
      userId: user.id,
      rapidApiKey: rapidKey,
      bypassCache: Boolean(body.force_refresh),
      params: {
        q: searchParams.q,
        location: searchParams.location,
        remote: searchParams.remote,
        page: searchParams.page,
      },
    })

    if (!discover.ok) {
      if (discover.code === 'limit') {
        return NextResponse.json(
          { success: false, error: discover.error, usage: discover.usage },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { success: false, error: discover.error, usage: discover.usage },
        { status: discover.code === 'api' ? 502 : 500 }
      )
    }

    const listings: DiscoverListingWithApply[] = discover.listings.slice(0, maxEvaluate)

    type EvalRow =
      | {
          stable_external_id: string
          title: string
          company: string
          fit: JobFitSuccessResponse
        }
      | {
          stable_external_id: string
          title: string
          company: string
          error: string
        }

    const evalResults = await runPool(listings, FIT_CONCURRENCY, async (listing) => {
      try {
        const fit = await computeJobFit({
          openai,
          profileSummaryForLLM: profileSummary,
          listing: {
            title: listing.title,
            company: listing.company,
            description: listing.description,
            snippet: listing.snippet,
            location: listing.location,
            remote: listing.remote,
          },
        })
        return {
          stable_external_id: listing.stable_external_id,
          title: listing.title,
          company: listing.company,
          fit,
        } satisfies EvalRow
      } catch (e) {
        return {
          stable_external_id: listing.stable_external_id,
          title: listing.title,
          company: listing.company,
          error: e instanceof Error ? e.message : 'Fit failed',
        } satisfies EvalRow
      }
    })

    const strongIds: string[] = []
    for (const row of evalResults) {
      if ('fit' in row && row.fit && isStrongMatch(row.fit)) {
        strongIds.push(row.stable_external_id)
      }
    }

    const iterationsForSuggest = [
      ...priorIterations,
      { search_params: searchParams as unknown as Record<string, unknown> },
    ]

    let suggested = suggestNextSearchRules({
      anchor: fallbackAnchor,
      iterations: iterationsForSuggest,
      lastParams: searchParams,
    })
    let nextParamsSource: 'rules' | 'llm' = 'rules'

    if (!suggested && openai) {
      const okEvals = evalResults.filter((r): r is Extract<EvalRow, { fit: JobFitSuccessResponse }> => 'fit' in r)
      const compact = compactEvalsForLLM(okEvals.map((r) => ({ fit: r.fit, title: r.title, company: r.company })))
      const tried = iterationsForSuggest.map((i) => JSON.stringify(i.search_params)).join(' | ')
      suggested = await suggestNextSearchLLM({
        openai,
        anchor: fallbackAnchor,
        profileSummary,
        lastParams: searchParams,
        evaluations: compact,
        triedHint: tried.slice(0, 2000),
      })
      nextParamsSource = 'llm'
    }

    if (!suggested) {
      suggested = {
        q: searchParams.q,
        location: searchParams.location,
        remote: searchParams.remote,
        page: searchParams.page + 1,
        rationale: 'No other rule-based variant found; trying the next page.',
      }
      nextParamsSource = 'rules'
    }

    const suggested_next = {
      q: suggested.q,
      location: suggested.location,
      remote: suggested.remote,
      page: suggested.page,
      rationale: suggested.rationale,
      params_source: nextParamsSource,
    }

    const listingsJson = listings.map((l) => ({ ...l }))
    const evaluationsJson = evalResults.map((r) =>
      'fit' in r ? { stable_external_id: r.stable_external_id, title: r.title, company: r.company, fit: r.fit } : r
    )

    const { data: inserted, error: insErr } = await supabase
      .from('match_loop_iterations')
      .insert({
        session_id: sessionId,
        iteration_index: iterationIndex,
        search_params: searchParams,
        listings: listingsJson,
        evaluations: evaluationsJson,
        strong_match_ids: strongIds.length ? strongIds : null,
        refinement_source: refinementSource,
        refinement_note: null,
        suggested_next,
        jsearch_requests_delta: discover.jsearchRequestsDelta,
      })
      .select()
      .single()

    if (insErr || !inserted) {
      console.error('match_loop_iterations insert:', insErr)
      return NextResponse.json({ success: false, error: insErr?.message || 'Could not save iteration.' }, { status: 500 })
    }

    await supabase
      .from('match_loop_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    const byStable = new Map(listings.map((l) => [l.stable_external_id, l]))
    const listingsOut = evalResults.map((r) => {
      const base = byStable.get(r.stable_external_id)
      return {
        ...(base ?? {}),
        stable_external_id: r.stable_external_id,
        fit_evaluation: 'fit' in r ? r.fit : null,
        fit_error: 'error' in r ? r.error : null,
        strong_match: 'fit' in r && r.fit ? isStrongMatch(r.fit) : false,
      }
    })

    const strong_matches = evalResults
      .filter((r): r is Extract<EvalRow, { fit: JobFitSuccessResponse }> => 'fit' in r && !!r.fit && isStrongMatch(r.fit))
      .map((r) => ({
        stable_external_id: r.stable_external_id,
        title: r.title,
        company: r.company,
        fit: r.fit,
        listing: byStable.get(r.stable_external_id) ?? null,
      }))

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      iteration: inserted,
      listings: listingsOut,
      strong_matches,
      suggested_next,
      strong_match_criteria: STRONG_MATCH_CRITERIA_DESCRIPTION,
      strong_match_criteria_fields: STRONG_MATCH_CRITERIA,
      usage: {
        jsearch: discover.usage,
        fit_checks: evalResults.length,
      },
    })
  } catch (err: unknown) {
    console.error('match-loop step:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Step failed.' },
      { status: 500 }
    )
  }
}
