import type { SupabaseClient } from '@supabase/supabase-js'
import { stableExternalId } from '@/lib/jobs/stableExternalId'
import type { DiscoverListing, DiscoverListingWithApply } from '@/lib/jobs/discoverListing'

const JSEARCH = 'jsearch'

export async function mergeDiscoverApplyState(
  supabase: SupabaseClient,
  userId: string,
  listings: DiscoverListing[]
): Promise<DiscoverListingWithApply[]> {
  if (listings.length === 0) return []

  const keys = [
    ...new Set(
      listings.map((l) =>
        stableExternalId({
          external_id: l.external_id,
          source: l.source || JSEARCH,
          title: l.title,
          company: l.company,
          url: l.url,
        })
      )
    ),
  ]
  if (keys.length === 0) {
    return listings.map((l) => emptyApplyMerge(l))
  }

  const { data: rows, error } = await supabase
    .from('job_listings')
    .select(
      'id, external_id, apply_outbound_at, apply_decision, apply_decision_at, apply_notes, apply_remind_at, pipeline_stage'
    )
    .eq('user_id', userId)
    .eq('source', JSEARCH)
    .in('external_id', keys)

  if (error) {
    console.error('mergeDiscoverApplyState:', error)
    return listings.map(emptyApplyMerge)
  }

  const byExternal = new Map<string, Record<string, unknown>>()
  for (const r of rows ?? []) {
    const ex = r.external_id as string
    if (ex) byExternal.set(ex, r as Record<string, unknown>)
  }

  return listings.map((l) => {
    const k = stableExternalId({
      external_id: l.external_id,
      source: l.source || JSEARCH,
      title: l.title,
      company: l.company,
      url: l.url,
    })
    const row = byExternal.get(k)
    if (!row) return { ...l, ...nullApplyFields(k) }
    return {
      ...l,
      stable_external_id: k,
      listing_id: (row.id as string) ?? null,
      apply_outbound_at: (row.apply_outbound_at as string) ?? null,
      apply_decision: (row.apply_decision as string) ?? null,
      apply_decision_at: (row.apply_decision_at as string) ?? null,
      apply_notes: (row.apply_notes as string) ?? null,
      apply_remind_at: (row.apply_remind_at as string) ?? null,
      pipeline_stage: (row.pipeline_stage as string) ?? null,
    }
  })
}

function nullApplyFields(stable: string) {
  return {
    stable_external_id: stable,
    listing_id: null as string | null,
    apply_outbound_at: null as string | null,
    apply_decision: null as string | null,
    apply_decision_at: null as string | null,
    apply_notes: null as string | null,
    apply_remind_at: null as string | null,
    pipeline_stage: null as string | null,
  }
}

function emptyApplyMerge(l: DiscoverListing): DiscoverListingWithApply {
  const k = stableExternalId({
    external_id: l.external_id,
    source: l.source || JSEARCH,
    title: l.title,
    company: l.company,
    url: l.url,
  })
  return { ...l, ...nullApplyFields(k) }
}
