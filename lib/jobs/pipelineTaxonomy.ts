import type { JobListingRow } from '@/lib/jobs/jobListingRow'

/** User-defined label stored as `custom:My HireVue step` */
export const PIPELINE_CUSTOM_PREFIX = 'custom:' as const

export type PipelineStageGroup =
  | 'progress'
  | 'reject'
  | 'ghost'
  | 'neutral'
  | 'pre_apply'
  | 'hub'

export type PipelineStageDef = {
  id: string
  label: string
  group: PipelineStageGroup
  /** Shown in apply-decision=applied stage dropdown */
  selectable?: boolean
}

/** Post-apply stages the user can set (plus custom:…). */
export const PIPELINE_POST_APPLY_STAGES: PipelineStageDef[] = [
  { id: 'applied_unset', label: 'Applied — set stage', group: 'neutral', selectable: false },
  { id: 'no_reply', label: 'No reply / ghosted', group: 'ghost', selectable: true },
  { id: 'rejected', label: 'Rejected', group: 'reject', selectable: true },
  { id: 'screening', label: 'Screening / recruiter', group: 'progress', selectable: true },
  { id: 'assessment', label: 'Assessment / test', group: 'progress', selectable: true },
  { id: 'async_video', label: 'Async video (HireVue, etc.)', group: 'progress', selectable: true },
  { id: 'interview', label: 'Interview', group: 'progress', selectable: true },
  { id: 'final_round', label: 'Final round', group: 'progress', selectable: true },
  { id: 'offer', label: 'Offer', group: 'progress', selectable: true },
]

const POST_BY_ID = new Map(PIPELINE_POST_APPLY_STAGES.map((s) => [s.id, s]))
export const PIPELINE_FORWARD_STAGE_IDS = new Set(
  PIPELINE_POST_APPLY_STAGES.filter((s) => s.group === 'progress').map((s) => s.id)
)

const CANONICAL_PIPELINE_STAGE_IDS = new Set(PIPELINE_POST_APPLY_STAGES.map((s) => s.id))

/** Hex colors for SVG (aligned with Tailwind-ish semantics). */
export const PIPELINE_GROUP_COLORS: Record<PipelineStageGroup, string> = {
  progress: '#14b8a6',
  reject: '#f43f5e',
  ghost: '#94a3b8',
  neutral: '#f59e0b',
  pre_apply: '#0ea5e9',
  hub: '#6366f1',
}

export function isCustomPipelineStageId(id: string): boolean {
  return id.startsWith(PIPELINE_CUSTOM_PREFIX) && id.length > PIPELINE_CUSTOM_PREFIX.length
}

export function pipelineStageLabel(id: string): string {
  if (isCustomPipelineStageId(id)) return id.slice(PIPELINE_CUSTOM_PREFIX.length).trim() || 'Custom'
  return POST_BY_ID.get(id)?.label ?? id.replace(/_/g, ' ')
}

export function pipelineStageGroup(id: string): PipelineStageGroup {
  if (isCustomPipelineStageId(id)) return 'progress'
  return POST_BY_ID.get(id)?.group ?? 'neutral'
}

export function pipelineStageColor(id: string): string {
  return PIPELINE_GROUP_COLORS[pipelineStageGroup(id)]
}

/** Validate body.stage for API: clear, canonical id, or custom:label */
export function validatePipelineStageInput(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null }
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'stage must be a string or null' }
  }
  const s = raw.trim()
  if (s === '') return { ok: true, value: null }
  if (CANONICAL_PIPELINE_STAGE_IDS.has(s)) {
    if (s === 'applied_unset') {
      return { ok: false, error: 'cannot set stage to applied_unset; clear stage instead' }
    }
    return { ok: true, value: s }
  }
  if (!s.startsWith(PIPELINE_CUSTOM_PREFIX)) {
    return { ok: false, error: 'unknown stage id' }
  }
  const label = s.slice(PIPELINE_CUSTOM_PREFIX.length).trim()
  if (!label) return { ok: false, error: 'custom stage label is required after custom:' }
  if (label.length > 200) return { ok: false, error: 'custom stage label too long' }
  if (/[\r\n]/.test(label)) return { ok: false, error: 'invalid characters in custom label' }
  return { ok: true, value: `${PIPELINE_CUSTOM_PREFIX}${label}` }
}

/**
 * Single resolved id per listing for charts, drill-down, and filters.
 * Pre-apply pseudo ids: pre_awaiting, pre_later, pre_skipped, pre_manual_open, pre_tracked.
 * Applied: DB pipeline_stage or applied_unset.
 */
export function resolveDisplayStage(listing: JobListingRow): string {
  const d = listing.apply_decision
  if (d === 'applied') {
    const ps = listing.pipeline_stage?.trim()
    if (!ps) return 'applied_unset'
    return ps
  }
  if (d === 'later') return 'pre_later'
  if (d === 'not_applied') return 'pre_skipped'
  if (listing.apply_outbound_at) return 'pre_awaiting'
  if (listing.source === 'manual') return 'pre_manual_open'
  return 'pre_tracked'
}

export function preApplyStageLabel(id: string): string {
  switch (id) {
    case 'pre_awaiting':
      return 'In flight (opened apply)'
    case 'pre_later':
      return 'Decide later'
    case 'pre_skipped':
      return 'Skipped'
    case 'pre_manual_open':
      return 'Logged off-platform'
    case 'pre_tracked':
      return 'Tracked'
    default:
      return id
  }
}

export function preApplyStageGroup(id: string): PipelineStageGroup {
  if (id === 'pre_skipped') return 'neutral'
  return 'pre_apply'
}
