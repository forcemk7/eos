import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import {
  PIPELINE_CUSTOM_PREFIX,
  PIPELINE_FORWARD_STAGE_IDS,
  PIPELINE_GROUP_COLORS,
  PIPELINE_POST_APPLY_STAGES,
  isCustomPipelineStageId,
  pipelineStageColor,
  pipelineStageLabel,
  preApplyStageGroup,
  preApplyStageLabel,
  resolveDisplayStage,
} from '@/lib/jobs/pipelineTaxonomy'

/** Clicking the "Applied" aggregate shows every applied listing. */
export const SANKEY_FILTER_ALL_APPLIED = '__all_applied__'
/** In-progress hub: forward canonical stages + any custom:* stage. */
export const SANKEY_FILTER_IN_PROCESS_HUB = '__in_process_hub__'

export type SankeyGraphNode = { stageKey: string; label: string; fill: string }
export type SankeyGraphLink = { source: number; target: number; value: number }

function countBy<T extends string>(items: T[]): Map<T, number> {
  const m = new Map<T, number>()
  for (const k of items) {
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function buildSankeyGraph(listings: JobListingRow[]) {
  const stages = listings.map((L) => resolveDisplayStage(L))
  const counts = countBy(stages)

  const preKeys = ['pre_awaiting', 'pre_later', 'pre_skipped', 'pre_manual_open', 'pre_tracked'] as const
  const appliedTotal = listings.filter((L) => L.apply_decision === 'applied').length

  const postSplitIds = ['rejected', 'no_reply', 'applied_unset'] as const
  const forwardIds = [...PIPELINE_FORWARD_STAGE_IDS] as string[]
  const customIds = [...new Set(stages.filter((s) => isCustomPipelineStageId(s)))].sort()

  let hubTotal = 0
  for (const id of forwardIds) hubTotal += counts.get(id) ?? 0
  for (const id of customIds) hubTotal += counts.get(id) ?? 0

  const nodes: SankeyGraphNode[] = []

  function addNode(stageKey: string, label: string, fill: string): number {
    const i = nodes.length
    nodes.push({ stageKey, label, fill })
    return i
  }

  const links: SankeyGraphLink[] = []

  const rootIdx = addNode('__root__', 'Tracked', '#64748b')
  let hasPre = false
  for (const pk of preKeys) {
    const c = counts.get(pk) ?? 0
    if (c <= 0) continue
    hasPre = true
    const fill = pk === 'pre_skipped' ? '#71717a' : PIPELINE_GROUP_COLORS[preApplyStageGroup(pk)]
    const idx = addNode(pk, preApplyStageLabel(pk), fill)
    links.push({ source: rootIdx, target: idx, value: c })
  }

  if (appliedTotal > 0) {
    const appliedIdx = addNode(SANKEY_FILTER_ALL_APPLIED, 'Applied', '#10b981')
    links.push({ source: rootIdx, target: appliedIdx, value: appliedTotal })

    for (const pid of postSplitIds) {
      const c = counts.get(pid) ?? 0
      if (c <= 0) continue
      const fill = pipelineStageColor(pid)
      const t = addNode(pid, pipelineStageLabel(pid), fill)
      links.push({ source: appliedIdx, target: t, value: c })
    }

    if (hubTotal > 0) {
      const hubIdx = addNode(SANKEY_FILTER_IN_PROCESS_HUB, 'In progress', '#6366f1')
      links.push({ source: appliedIdx, target: hubIdx, value: hubTotal })
      for (const fid of forwardIds) {
        const c = counts.get(fid) ?? 0
        if (c <= 0) continue
        const t = addNode(fid, pipelineStageLabel(fid), pipelineStageColor(fid))
        links.push({ source: hubIdx, target: t, value: c })
      }
      for (const cid of customIds) {
        const c = counts.get(cid) ?? 0
        if (c <= 0) continue
        const t = addNode(cid, cid.slice(PIPELINE_CUSTOM_PREFIX.length), pipelineStageColor(cid))
        links.push({ source: hubIdx, target: t, value: c })
      }
    }
  }

  if (!hasPre && appliedTotal <= 0 && listings.length > 0) {
    const idx = addNode('pre_tracked', preApplyStageLabel('pre_tracked'), '#0ea5e9')
    links.push({ source: rootIdx, target: idx, value: listings.length })
  }

  return { nodes, links, total: listings.length }
}

export function listingMatchesSankeyFilter(listing: JobListingRow, filter: string | null): boolean {
  if (filter == null) return true
  if (filter === SANKEY_FILTER_ALL_APPLIED) return listing.apply_decision === 'applied'
  if (filter === SANKEY_FILTER_IN_PROCESS_HUB) {
    if (listing.apply_decision !== 'applied') return false
    const s = resolveDisplayStage(listing)
    return PIPELINE_FORWARD_STAGE_IDS.has(s) || isCustomPipelineStageId(s)
  }
  return resolveDisplayStage(listing) === filter
}

const PRE_DISPLAY_ORDER = [
  'pre_awaiting',
  'pre_later',
  'pre_skipped',
  'pre_manual_open',
  'pre_tracked',
] as const

const POST_APPLY_ORDER = PIPELINE_POST_APPLY_STAGES.map((s) => s.id)

/** Human label for any sankey filter key (pre-apply, post-apply, custom, or aggregate). */
export function stageFilterLabel(id: string): string {
  if (id === SANKEY_FILTER_ALL_APPLIED) return 'All applied'
  if (id === SANKEY_FILTER_IN_PROCESS_HUB) return 'In progress'
  if (id.startsWith('pre_')) return preApplyStageLabel(id)
  return pipelineStageLabel(id)
}

function compareDisplayStageKeys(a: string, b: string): number {
  const iA = PRE_DISPLAY_ORDER.indexOf(a as (typeof PRE_DISPLAY_ORDER)[number])
  const iB = PRE_DISPLAY_ORDER.indexOf(b as (typeof PRE_DISPLAY_ORDER)[number])
  const inPreA = iA !== -1
  const inPreB = iB !== -1
  if (inPreA && inPreB) return iA - iB
  if (inPreA) return -1
  if (inPreB) return 1

  const custA = isCustomPipelineStageId(a)
  const custB = isCustomPipelineStageId(b)
  const pA = POST_APPLY_ORDER.indexOf(a)
  const pB = POST_APPLY_ORDER.indexOf(b)
  const inPostA = pA !== -1
  const inPostB = pB !== -1

  if (!custA && !custB && inPostA && inPostB) return pA - pB
  if (!custA && inPostA && (custB || !inPostB)) return -1
  if (!custB && inPostB && (custA || !inPostA)) return 1
  if (custA && custB) return a.localeCompare(b)
  if (custA) return 1
  if (custB) return -1
  return a.localeCompare(b)
}

export type StageFilterOption = { stageKey: string | null; count: number }

/** Ordered options for stage filter UI: All, aggregates when non-empty, then concrete display stages. */
export function buildStageFilterOptions(listings: JobListingRow[]): StageFilterOption[] {
  const stages = listings.map((L) => resolveDisplayStage(L))
  const counts = countBy(stages)
  const out: StageFilterOption[] = [{ stageKey: null, count: listings.length }]

  const appliedTotal = listings.filter((L) => L.apply_decision === 'applied').length
  if (appliedTotal > 0) {
    out.push({ stageKey: SANKEY_FILTER_ALL_APPLIED, count: appliedTotal })
  }

  let hubCount = 0
  for (const L of listings) {
    if (listingMatchesSankeyFilter(L, SANKEY_FILTER_IN_PROCESS_HUB)) hubCount += 1
  }
  if (hubCount > 0) {
    out.push({ stageKey: SANKEY_FILTER_IN_PROCESS_HUB, count: hubCount })
  }

  const concrete = [...counts.keys()]
    .filter((k) => (counts.get(k) ?? 0) > 0)
    .sort(compareDisplayStageKeys)
  for (const k of concrete) {
    out.push({ stageKey: k, count: counts.get(k) ?? 0 })
  }

  return out
}
