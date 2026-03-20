import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildTargetProfileSummaryForLLM } from '@/lib/targetProfileSummaryForLLM'
import {
  toJobSearchAnchor,
  parseRoles,
  parseSectors,
  parseStringArray,
  filterRolesByDismissed,
  filterSectorsByDismissed,
  type TargetRoleRow,
  type TargetSectorRow,
  type JobQualificationsDbRow,
} from '@/lib/jobs/jobSearchAnchor'
import { normalizeTargetKey } from '@/lib/jobs/targetProfileTypes'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export interface JobQualificationsRow {
  search_query: string
  location: string | null
  remote: boolean
  generated_at: string
}

const TARGET_SYSTEM_PROMPT = `You output JSON only. Given a candidate profile, recommend target job roles and industry sectors they should hunt JDs for, including reasonable stretch or adjacent roles.

Output exactly this JSON shape, no other text:
{
  "roles": [
    { "title": string, "rationale": string, "search_terms": string, "stretch": boolean }
  ],
  "sectors": [
    { "name": string, "rationale": string }
  ],
  "location": string | null,
  "remote": boolean
}

Rules:
- roles: 3 to 6 items. Each rationale: 1–3 short sentences explaining why this role fits the profile (reference experience, skills, or education when relevant).
- sectors: 2 to 5 items. Each rationale: 1–2 sentences on why this sector fits.
- search_terms: 2–5 words for a job search API — job title or role only (e.g. "software engineer", "product manager"). No location, commas, or punctuation.
- location: city or region for display if inferable from the profile; otherwise null. Never put location inside search_terms.
- remote: true if they should prioritize remote-friendly search (default true when in doubt).
- stretch: true for reach/adjacent roles, false for core fits.`

function clampWords(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean).slice(0, maxWords)
  return words.join(' ')
}

function sanitizeSearchTerms(raw: string): string {
  const cleaned = raw.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  return clampWords(cleaned, 5) || 'jobs'
}

function computeSearchQueryFromRoles(
  roles: TargetRoleRow[],
  pinnedKey: string | null
): string {
  if (roles.length === 0) return 'jobs'
  if (pinnedKey) {
    const k = normalizeTargetKey(pinnedKey)
    const hit = roles.find((r) => normalizeTargetKey(r.title) === k)
    if (hit) return sanitizeSearchTerms(hit.search_terms)
  }
  return sanitizeSearchTerms(roles[0].search_terms)
}

function parseLLMTargets(content: string | null): {
  roles: Omit<TargetRoleRow, 'id'>[]
  sectors: Omit<TargetSectorRow, 'id'>[]
  location: string | null
  remote: boolean
} {
  const empty = {
    roles: [] as Omit<TargetRoleRow, 'id'>[],
    sectors: [] as Omit<TargetSectorRow, 'id'>[],
    location: null as string | null,
    remote: true,
  }
  if (!content) return empty
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    const rawRoles = Array.isArray(parsed.roles) ? parsed.roles : []
    const rawSectors = Array.isArray(parsed.sectors) ? parsed.sectors : []
    const roles: Omit<TargetRoleRow, 'id'>[] = []
    for (const item of rawRoles.slice(0, 8)) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const title = typeof o.title === 'string' ? o.title.trim() : ''
      const rationale = typeof o.rationale === 'string' ? o.rationale.trim() : ''
      const search_terms = typeof o.search_terms === 'string' ? o.search_terms.trim() : ''
      if (!title || !rationale) continue
      roles.push({
        title,
        rationale,
        search_terms: search_terms || title,
        stretch: typeof o.stretch === 'boolean' ? o.stretch : false,
      })
    }
    while (roles.length > 6) roles.pop()
    while (roles.length < 3 && roles.length > 0) {
      /* keep as-is if LLM returned fewer than 3 */
      break
    }

    const sectors: Omit<TargetSectorRow, 'id'>[] = []
    for (const item of rawSectors.slice(0, 8)) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const rationale = typeof o.rationale === 'string' ? o.rationale.trim() : ''
      if (!name || !rationale) continue
      sectors.push({ name, rationale })
    }
    while (sectors.length > 5) sectors.pop()

    let location: string | null = null
    if (parsed.location === null || typeof parsed.location === 'string') {
      location = parsed.location === null ? null : (parsed.location as string).trim() || null
    }
    const remote = typeof parsed.remote === 'boolean' ? parsed.remote : true

    return { roles, sectors, location, remote }
  } catch {
    return empty
  }
}

function assignIds(
  roles: Omit<TargetRoleRow, 'id'>[],
  sectors: Omit<TargetSectorRow, 'id'>[]
): { roles: TargetRoleRow[]; sectors: TargetSectorRow[] } {
  return {
    roles: roles.map((r) => ({
      ...r,
      id: randomUUID(),
      search_terms: sanitizeSearchTerms(r.search_terms),
    })),
    sectors: sectors.map((s) => ({ ...s, id: randomUUID() })),
  }
}

async function buildGetPayload(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>['supabase'],
  userId: string,
  row: Record<string, unknown> | null
) {
  const { data: prof } = await supabase.from('profiles').select('updated_at').eq('user_id', userId).maybeSingle()
  const profileUpdated = prof?.updated_at ? String(prof.updated_at) : null

  if (!row) {
    return {
      success: true as const,
      qualifications: null,
      stale: false,
      target_roles: [] as TargetRoleRow[],
      target_sectors: [] as TargetSectorRow[],
      dismissed_role_keys: [] as string[],
      dismissed_sector_keys: [] as string[],
      pinned_role_key: null as string | null,
      anchor: null,
    }
  }

  const dbRow = row as JobQualificationsDbRow
  const dismissedRoleKeys = parseStringArray(row.dismissed_role_keys).map(normalizeTargetKey)
  const dismissedSectorKeys = parseStringArray(row.dismissed_sector_keys).map(normalizeTargetKey)
  const allRoles = parseRoles(row.target_roles)
  const allSectors = parseSectors(row.target_sectors)
  const profile_as_of = typeof row.profile_as_of === 'string' ? row.profile_as_of : null
  const stale = Boolean(profileUpdated && profile_as_of && profileUpdated > profile_as_of)

  const qualifications: JobQualificationsRow = {
    search_query: typeof row.search_query === 'string' ? row.search_query : 'jobs',
    location: typeof row.location === 'string' ? row.location : null,
    remote: Boolean(row.remote ?? true),
    generated_at: typeof row.generated_at === 'string' ? row.generated_at : new Date().toISOString(),
  }

  return {
    success: true as const,
    qualifications,
    stale,
    target_roles: filterRolesByDismissed(allRoles, dismissedRoleKeys),
    target_sectors: filterSectorsByDismissed(allSectors, dismissedSectorKeys),
    dismissed_role_keys: dismissedRoleKeys,
    dismissed_sector_keys: dismissedSectorKeys,
    pinned_role_key: typeof row.pinned_role_key === 'string' ? row.pinned_role_key : null,
    anchor: toJobSearchAnchor(dbRow),
  }
}

/** GET: job_qualifications + target lists + stale + anchor */
export async function GET(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: row, error } = await supabase
      .from('job_qualifications')
      .select(
        'search_query, location, remote, generated_at, target_roles, target_sectors, profile_as_of, dismissed_role_keys, dismissed_sector_keys, pinned_role_key'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('job_qualifications GET:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const payload = await buildGetPayload(supabase, user.id, row as Record<string, unknown> | null)
    return NextResponse.json(payload)
  } catch (err: unknown) {
    console.error('Qualifications GET error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

/** POST: regenerate targets from profile via LLM */
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

  try {
    const profile = await assembleProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Complete your Data first.' },
        { status: 400 }
      )
    }

    const { data: profRow } = await supabase.from('profiles').select('updated_at').eq('user_id', user.id).single()
    const profile_as_of = profRow?.updated_at
      ? typeof profRow.updated_at === 'string'
        ? profRow.updated_at
        : new Date(profRow.updated_at as string).toISOString()
      : new Date().toISOString()

    const { data: existing } = await supabase
      .from('job_qualifications')
      .select('dismissed_role_keys, dismissed_sector_keys, pinned_role_key')
      .eq('user_id', user.id)
      .maybeSingle()

    const dismissedRoleKeys = parseStringArray(existing?.dismissed_role_keys).map(normalizeTargetKey)
    const dismissedSectorKeys = parseStringArray(existing?.dismissed_sector_keys).map(normalizeTargetKey)
    let pinned_role_key =
      typeof existing?.pinned_role_key === 'string' && existing.pinned_role_key
        ? normalizeTargetKey(existing.pinned_role_key)
        : null

    const summaryText = buildTargetProfileSummaryForLLM(profile)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: TARGET_SYSTEM_PROMPT },
        { role: 'user', content: summaryText },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    let { roles: rawRoles, sectors: rawSectors, location, remote } = parseLLMTargets(content ?? null)

    if (rawRoles.length === 0) {
      rawRoles = [
        {
          title: 'Professional role',
          rationale: 'We could not infer specific titles; add more experience or skills and regenerate.',
          search_terms: 'jobs',
          stretch: false,
        },
      ]
    }

    let { roles: withIds, sectors: sectorsWithIds } = assignIds(rawRoles, rawSectors)

    const dismissedRoleSet = new Set(dismissedRoleKeys)
    const dismissedSectorSet = new Set(dismissedSectorKeys)
    withIds = withIds.filter((r) => !dismissedRoleSet.has(normalizeTargetKey(r.title)))
    sectorsWithIds = sectorsWithIds.filter((s) => !dismissedSectorSet.has(normalizeTargetKey(s.name)))

    if (pinned_role_key && !withIds.some((r) => normalizeTargetKey(r.title) === pinned_role_key)) {
      pinned_role_key = null
    }

    const search_query = computeSearchQueryFromRoles(withIds, pinned_role_key)
    const generated_at = new Date().toISOString()

    const { error: upsertError } = await supabase.from('job_qualifications').upsert(
      {
        user_id: user.id,
        search_query,
        location,
        remote,
        generated_at,
        target_roles: withIds,
        target_sectors: sectorsWithIds,
        profile_as_of,
        dismissed_role_keys: dismissedRoleKeys,
        dismissed_sector_keys: dismissedSectorKeys,
        pinned_role_key,
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      console.error('job_qualifications upsert:', upsertError)
      return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 })
    }

    const { data: row } = await supabase
      .from('job_qualifications')
      .select(
        'search_query, location, remote, generated_at, target_roles, target_sectors, profile_as_of, dismissed_role_keys, dismissed_sector_keys, pinned_role_key'
      )
      .eq('user_id', user.id)
      .single()

    const payload = await buildGetPayload(supabase, user.id, row as Record<string, unknown>)
    return NextResponse.json({ ...payload, success: true })
  } catch (err: unknown) {
    console.error('Qualifications generate error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Generate failed.' },
      { status: 500 }
    )
  }
}

type PatchAction =
  | 'pin'
  | 'unpin'
  | 'dismiss_role'
  | 'dismiss_sector'
  | 'undismiss_role'
  | 'undismiss_sector'

/** PATCH: pin / dismiss / undismiss */
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: { action?: PatchAction; key?: string }
    try {
      body = (await req.json()) as { action?: PatchAction; key?: string }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const action = body.action
    const keyRaw = typeof body.key === 'string' ? body.key : ''
    const key = normalizeTargetKey(keyRaw)

    if (!action || (action !== 'unpin' && !key)) {
      return NextResponse.json({ success: false, error: 'Missing action or key' }, { status: 400 })
    }

    const { data: row, error: fetchError } = await supabase
      .from('job_qualifications')
      .select(
        'search_query, location, remote, generated_at, target_roles, target_sectors, profile_as_of, dismissed_role_keys, dismissed_sector_keys, pinned_role_key'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ success: false, error: 'No target profile yet. Generate from Data first.' }, { status: 400 })
    }

    let dismissedRoleKeys = parseStringArray(row.dismissed_role_keys).map(normalizeTargetKey)
    let dismissedSectorKeys = parseStringArray(row.dismissed_sector_keys).map(normalizeTargetKey)
    let pinned_role_key =
      typeof row.pinned_role_key === 'string' && row.pinned_role_key
        ? normalizeTargetKey(row.pinned_role_key)
        : null

    const allRoles = parseRoles(row.target_roles)

    if (action === 'dismiss_role') {
      if (!dismissedRoleKeys.includes(key)) dismissedRoleKeys = [...dismissedRoleKeys, key]
      if (pinned_role_key === key) pinned_role_key = null
    } else if (action === 'undismiss_role') {
      dismissedRoleKeys = dismissedRoleKeys.filter((k) => k !== key)
    } else if (action === 'dismiss_sector') {
      if (!dismissedSectorKeys.includes(key)) dismissedSectorKeys = [...dismissedSectorKeys, key]
    } else if (action === 'undismiss_sector') {
      dismissedSectorKeys = dismissedSectorKeys.filter((k) => k !== key)
    } else if (action === 'pin') {
      const visible = filterRolesByDismissed(allRoles, dismissedRoleKeys)
      if (!visible.some((r) => normalizeTargetKey(r.title) === key)) {
        return NextResponse.json({ success: false, error: 'Unknown role' }, { status: 400 })
      }
      pinned_role_key = key
    } else if (action === 'unpin') {
      pinned_role_key = null
    }

    const visibleRoles = filterRolesByDismissed(allRoles, dismissedRoleKeys)
    const search_query = computeSearchQueryFromRoles(visibleRoles, pinned_role_key)

    const { error: upError } = await supabase
      .from('job_qualifications')
      .update({
        dismissed_role_keys: dismissedRoleKeys,
        dismissed_sector_keys: dismissedSectorKeys,
        pinned_role_key,
        search_query,
      })
      .eq('user_id', user.id)

    if (upError) {
      return NextResponse.json({ success: false, error: upError.message }, { status: 500 })
    }

    const { data: nextRow } = await supabase
      .from('job_qualifications')
      .select(
        'search_query, location, remote, generated_at, target_roles, target_sectors, profile_as_of, dismissed_role_keys, dismissed_sector_keys, pinned_role_key'
      )
      .eq('user_id', user.id)
      .single()

    const payload = await buildGetPayload(supabase, user.id, nextRow as Record<string, unknown>)
    return NextResponse.json({ ...payload, success: true })
  } catch (err: unknown) {
    console.error('Qualifications PATCH error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
