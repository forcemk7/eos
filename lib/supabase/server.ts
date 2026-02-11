import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!url || !key) {
  console.warn('Supabase env vars missing. Auth and Storage will not work.')
}

/**
 * Create a Supabase server client for Route Handlers.
 * Reads session from request cookies; optionally writes refreshed session to response.
 * Returns { supabase, user, response }. If no user, user is null (caller should 401).
 */
export async function createServerSupabase(req: NextRequest) {
  // Use a plain response as cookie sink (NextResponse.next() is not allowed in Route Handlers)
  const response = new NextResponse(undefined, { status: 200 })
  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user, response }
}

/**
 * Helper to return JSON with cookies from a Supabase response (e.g. after token refresh).
 */
export function jsonWithCookies(data: unknown, supabaseResponse: NextResponse, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: supabaseResponse.headers,
  })
}
