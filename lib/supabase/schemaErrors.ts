/** Heuristics for PostgREST / Postgres errors when migrations are missing. */
export function isMissingSchemaObject(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  const m = (err.message || '').toLowerCase()
  const c = String(err.code || '')
  return (
    m.includes('does not exist') ||
    m.includes('42703') ||
    m.includes('42p01') ||
    c === '42703' ||
    c === '42P01'
  )
}
