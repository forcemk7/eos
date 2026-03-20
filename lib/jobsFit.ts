/** Shared types and normalization for POST /api/jobs/fit (client + server). */

export type FitLabel = 'bad' | 'okay' | 'good' | 'great'

export type ScreeningLikelihood = 'qualified' | 'borderline' | 'unlikely'

export type JobFitFactorCategory =
  | 'experience_overlap'
  | 'keywords'
  | 'seniority_tenure'
  | 'education'
  | 'location_remote'
  | 'other'

export type JobFitFactorSentiment = 'strength' | 'gap' | 'neutral'

export interface JobFitFactor {
  category: JobFitFactorCategory
  sentiment: JobFitFactorSentiment
  detail: string
}

/** Successful fit API body (JSON). */
export interface JobFitSuccessResponse {
  success: true
  score: number
  label: FitLabel
  /** Legacy field; mirrors summary when present. */
  feedback: string | null
  summary: string
  screening_likelihood: ScreeningLikelihood
  factors: JobFitFactor[]
  data_actions: string[]
  jd_phrases: string[]
}

/** Fit payload after a successful API call (client-side). */
export type JobFitClientResult = Omit<JobFitSuccessResponse, 'success'>

export function toClientFitResult(r: JobFitSuccessResponse): JobFitClientResult {
  return {
    score: r.score,
    label: r.label,
    feedback: r.feedback,
    summary: r.summary,
    screening_likelihood: r.screening_likelihood,
    factors: r.factors,
    data_actions: r.data_actions,
    jd_phrases: r.jd_phrases,
  }
}

const FIT_LABELS: FitLabel[] = ['bad', 'okay', 'good', 'great']
const SCREENING: ScreeningLikelihood[] = ['qualified', 'borderline', 'unlikely']
const CATEGORIES: JobFitFactorCategory[] = [
  'experience_overlap',
  'keywords',
  'seniority_tenure',
  'education',
  'location_remote',
  'other',
]
const SENTIMENTS: JobFitFactorSentiment[] = ['strength', 'gap', 'neutral']

const MAX_FACTORS = 8
const MAX_ACTIONS = 5
const MAX_JD_PHRASES = 3

function labelFromScore(score: number): FitLabel {
  if (score <= 30) return 'bad'
  if (score <= 50) return 'okay'
  if (score <= 75) return 'good'
  return 'great'
}

function screeningFromScore(score: number): ScreeningLikelihood {
  if (score >= 60) return 'qualified'
  if (score >= 35) return 'borderline'
  return 'unlikely'
}

function parseStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (t && out.length < max) out.push(t)
  }
  return out
}

function parseFactors(raw: unknown): JobFitFactor[] {
  if (!Array.isArray(raw)) return []
  const out: JobFitFactor[] = []
  for (const item of raw) {
    if (out.length >= MAX_FACTORS) break
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const cat = typeof o.category === 'string' ? o.category.toLowerCase() : ''
    const category = CATEGORIES.includes(cat as JobFitFactorCategory)
      ? (cat as JobFitFactorCategory)
      : 'other'
    const sent = typeof o.sentiment === 'string' ? o.sentiment.toLowerCase() : ''
    const sentiment = SENTIMENTS.includes(sent as JobFitFactorSentiment)
      ? (sent as JobFitFactorSentiment)
      : 'neutral'
    const detail = typeof o.detail === 'string' ? o.detail.trim() : ''
    if (!detail) continue
    out.push({ category, sentiment, detail })
  }
  return out
}

/** Normalize OpenAI JSON into a stable API response. */
export function normalizeJobFitPayload(parsed: Record<string, unknown>): JobFitSuccessResponse {
  let score =
    typeof parsed.score === 'number' && Number.isFinite(parsed.score)
      ? Math.round(Math.max(0, Math.min(100, parsed.score)))
      : 50

  let label =
    typeof parsed.label === 'string' ? (parsed.label.toLowerCase() as FitLabel) : labelFromScore(score)
  if (!FIT_LABELS.includes(label)) {
    label = labelFromScore(score)
  }

  const summaryRaw =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : typeof parsed.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : typeof (parsed as { brief_reason?: string }).brief_reason === 'string'
          ? (parsed as { brief_reason: string }).brief_reason.trim()
          : ''
  const summary = summaryRaw || 'Fit estimate based on your saved profile and this posting.'

  let screening: ScreeningLikelihood = screeningFromScore(score)
  if (typeof parsed.screening_likelihood === 'string') {
    const raw = parsed.screening_likelihood.toLowerCase()
    if (raw === 'qualified' || raw === 'borderline' || raw === 'unlikely') {
      screening = raw
    }
  }

  const factors = parseFactors(parsed.factors)
  const data_actions = parseStringArray(parsed.data_actions, MAX_ACTIONS)
  const jd_phrases = parseStringArray(parsed.jd_phrases, MAX_JD_PHRASES)

  const feedback =
    typeof parsed.feedback === 'string' && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : summary

  return {
    success: true,
    score,
    label,
    feedback,
    summary,
    screening_likelihood: screening,
    factors,
    data_actions,
    jd_phrases,
  }
}
