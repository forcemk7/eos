import OpenAI from 'openai'
import type { JobSearchAnchor } from '@/lib/jobs/jobSearchAnchor'
import type { JobFitSuccessResponse } from '@/lib/jobsFit'

export interface LoopSearchParams {
  q: string
  location: string
  remote: boolean
  page: number
}

export interface SuggestedNextParams extends LoopSearchParams {
  rationale: string
}

function paramKey(p: LoopSearchParams): string {
  return `${(p.q || 'jobs').trim().toLowerCase()}|${(p.location || '').trim().toLowerCase()}|${p.remote}|${p.page}`
}

function collectTriedKeys(iterations: { search_params: unknown }[]): Set<string> {
  const tried = new Set<string>()
  for (const it of iterations) {
    const sp = it.search_params as Record<string, unknown> | null
    if (!sp || typeof sp !== 'object') continue
    const q = typeof sp.q === 'string' ? sp.q : 'jobs'
    const location = typeof sp.location === 'string' ? sp.location : ''
    const remote = Boolean(sp.remote)
    const page = typeof sp.page === 'number' ? sp.page : parseInt(String(sp.page ?? '1'), 10) || 1
    tried.add(paramKey({ q, location, remote, page }))
  }
  return tried
}

/** Rule-based next search; returns null if exhausted (caller may try LLM). */
export function suggestNextSearchRules(args: {
  anchor: JobSearchAnchor
  iterations: { search_params: unknown }[]
  lastParams: LoopSearchParams
}): SuggestedNextParams | null {
  const tried = collectTriedKeys(args.iterations)
  const loc = args.anchor.location_hint ?? ''
  const rem = args.anchor.remote_default

  const primary = (args.anchor.primary_query || 'jobs').trim() || 'jobs'
  const alternates = [primary, ...args.anchor.alternate_queries.map((q) => q.trim()).filter(Boolean)]
  const uniqueQs = [...new Set(alternates.map((q) => q || 'jobs'))]

  for (const q of uniqueQs) {
    const candidate: LoopSearchParams = { q: q || 'jobs', location: loc, remote: rem, page: 1 }
    if (!tried.has(paramKey(candidate))) {
      return {
        ...candidate,
        rationale: 'Trying another target-role search phrase from your profile.',
      }
    }
  }

  const nextPage: LoopSearchParams = {
    ...args.lastParams,
    page: Math.max(1, args.lastParams.page) + 1,
  }
  if (!tried.has(paramKey(nextPage))) {
    return {
      ...nextPage,
      rationale: 'Loading the next page of results for the same search.',
    }
  }

  const flipRemote: LoopSearchParams = {
    q: args.lastParams.q,
    location: args.lastParams.location,
    remote: !args.lastParams.remote,
    page: 1,
  }
  if (!tried.has(paramKey(flipRemote))) {
    return {
      ...flipRemote,
      rationale: args.lastParams.remote
        ? 'Trying the same role search including non-remote-only results.'
        : 'Narrowing to remote-only listings for the same search.',
    }
  }

  return null
}

const REFINE_SYSTEM = `You suggest the next job board search parameters for a candidate. Output only valid JSON:
{ "q": string, "location": string, "remote": boolean, "page": number, "rationale": string }

Rules:
- q: 2-5 words, job title or role only for a job API (no commas in q).
- location: city/region string or empty string if unknown.
- remote: boolean.
- page: positive integer; use 1 unless you have a strong reason to try a deeper page.
- rationale: one short sentence, plain language.

Do not repeat the exact same q+location+remote+page as the "blocked" combo if provided.`

export async function suggestNextSearchLLM(args: {
  openai: OpenAI
  anchor: JobSearchAnchor
  profileSummary: string
  lastParams: LoopSearchParams
  evaluations: { title: string; company: string; score: number; summary: string }[]
  triedHint: string
}): Promise<SuggestedNextParams> {
  const top = args.evaluations.slice(0, 6)
  const user = `Candidate profile (summary):\n${args.profileSummary.slice(0, 8000)}\n\nTarget context:\n- Primary query: ${args.anchor.primary_query}\n- Alternate queries: ${args.anchor.alternate_queries.join('; ') || 'none'}\n- Sectors: ${args.anchor.sectors.join('; ') || 'none'}\n- Location hint: ${args.anchor.location_hint ?? 'none'}\n\nLast search: q=${args.lastParams.q} location=${args.lastParams.location} remote=${args.lastParams.remote} page=${args.lastParams.page}\n\nAlready tried param keys (do not repeat exactly): ${args.triedHint}\n\nRecent listing fits (title, company, score, summary):\n${top.map((e) => `- ${e.title} @ ${e.company}: ${e.score} — ${e.summary}`).join('\n')}`

  const res = await args.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: REFINE_SYSTEM },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  })

  const raw = res.choices[0]?.message?.content?.trim()
  if (!raw) {
    return {
      q: args.lastParams.q,
      location: args.lastParams.location,
      remote: args.lastParams.remote,
      page: args.lastParams.page + 1,
      rationale: 'Suggested next page after automated refinement.',
    }
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>
  const q = typeof parsed.q === 'string' && parsed.q.trim() ? parsed.q.trim() : args.lastParams.q
  const location = typeof parsed.location === 'string' ? parsed.location.trim() : args.lastParams.location
  const remote = typeof parsed.remote === 'boolean' ? parsed.remote : args.lastParams.remote
  const page = typeof parsed.page === 'number' && parsed.page >= 1 ? Math.floor(parsed.page) : args.lastParams.page + 1
  const rationale =
    typeof parsed.rationale === 'string' && parsed.rationale.trim()
      ? parsed.rationale.trim()
      : 'Adjusted search based on recent fit results.'

  return { q, location, remote, page, rationale }
}

export function compactEvalsForLLM(
  evaluations: { fit: JobFitSuccessResponse; title?: string; company?: string }[]
): { title: string; company: string; score: number; summary: string }[] {
  return evaluations.map((e) => ({
    title: e.title ?? 'Role',
    company: e.company ?? '',
    score: e.fit.score,
    summary: e.fit.summary,
  }))
}
