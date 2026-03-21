/**
 * Turn fetch failures and API error payloads into short, user-facing messages.
 */
export function humanizeFetchError(
  err: unknown,
  opts?: { status?: number; fallback?: string; apiMessage?: string }
): string {
  const { status, fallback = 'Something went wrong.', apiMessage } = opts ?? {}

  if (status === 401) {
    return 'Your session expired. Sign in again to continue.'
  }

  if (apiMessage && typeof apiMessage === 'string' && apiMessage.trim()) {
    return apiMessage.trim()
  }

  if (err instanceof TypeError && typeof err.message === 'string') {
    const m = err.message.toLowerCase()
    if (m.includes('fetch') || m.includes('network') || m.includes('failed')) {
      return 'Could not reach the server. Check your connection and try again.'
    }
  }

  if (err instanceof Error && err.message) {
    const m = err.message.toLowerCase()
    if (m.includes('network') || m.includes('fetch')) {
      return 'Could not reach the server. Check your connection and try again.'
    }
    return err.message
  }

  return fallback
}
