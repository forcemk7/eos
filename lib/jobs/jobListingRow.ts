export interface JobListingRow {
  id: string
  user_id: string
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
  status: string
  created_at: string
  updated_at: string
  apply_outbound_at: string | null
  apply_decision: string | null
  apply_decision_at: string | null
  apply_notes: string | null
  apply_remind_at: string | null
}

export function rowToJobListing(row: Record<string, unknown>): JobListingRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    external_id: (row.external_id as string) ?? null,
    source: (row.source as string) ?? 'manual',
    title: (row.title as string) ?? '',
    company: (row.company as string) ?? '',
    url: (row.url as string) ?? null,
    location: (row.location as string) ?? null,
    remote: Boolean(row.remote),
    description: (row.description as string) ?? null,
    snippet: (row.snippet as string) ?? null,
    posted_at: (row.posted_at as string) ?? null,
    raw: typeof row.raw === 'object' && row.raw !== null ? (row.raw as Record<string, unknown>) : {},
    status: (row.status as string) ?? 'saved',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    apply_outbound_at: (row.apply_outbound_at as string) ?? null,
    apply_decision: (row.apply_decision as string) ?? null,
    apply_decision_at: (row.apply_decision_at as string) ?? null,
    apply_notes: (row.apply_notes as string) ?? null,
    apply_remind_at: (row.apply_remind_at as string) ?? null,
  }
}
