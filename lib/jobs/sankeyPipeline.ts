import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import {
  PIPELINE_GROUP_COLORS,
  PIPELINE_FORWARD_STAGE_IDS,
  isCustomPipelineStageId,
  pipelineStageColor,
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
  const nodeIndex = new Map<string, number>()

  function addNode(stageKey: string, label: string, fill: string): number {
    const i = nodes.length
    nodes.push({ stageKey, label, fill })
    nodeIndex.set(stageKey, i)
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
      const t = addNode(pid, pid === 'applied_unset' ? 'Stage not set' : pid.replace(/_/g, ' '), fill)
      links.push({ source: appliedIdx, target: t, value: c })
    }

    if (hubTotal > 0) {
      const hubIdx = addNode(SANKEY_FILTER_IN_PROCESS_HUB, 'In progress', '#6366f1')
      links.push({ source: appliedIdx, target: hubIdx, value: hubTotal })
      for (const fid of forwardIds) {
        const c = counts.get(fid) ?? 0
        if (c <= 0) continue
        const t = addNode(fid, fid.replace(/_/g, ' '), pipelineStageColor(fid))
        links.push({ source: hubIdx, target: t, value: c })
      }
      for (const cid of customIds) {
        const c = counts.get(cid) ?? 0
        if (c <= 0) continue
        const t = addNode(cid, cid.slice('custom:'.length), pipelineStageColor(cid))
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
