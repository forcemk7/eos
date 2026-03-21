'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AppShell, AppPageHeader } from '@/app/components/shell'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { authCopy } from '@/lib/navCopy'

type Mode = 'signin' | 'signup'

function friendlyAuthMessage(raw: string, mode: Mode): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'That email or password is incorrect. Try again or use Sign up.'
  }
  if (m.includes('email not confirmed')) {
    return 'Confirm your email from the link we sent, then sign in.'
  }
  if (m.includes('user already registered')) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (m.includes('password') && m.includes('least')) {
    return 'Password must be at least 6 characters.'
  }
  if (mode === 'signup' && m.includes('rate limit')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return raw
}

function markFreshSignIn() {
  try {
    sessionStorage.setItem(authCopy.freshSignInStorageKey, '1')
  } catch {
    // ignore
  }
}

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  const header = mode === 'signin' ? authCopy.signIn : authCopy.signUp

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setMessageIsError(false)
    setLoading(true)
    try {
      const supabase = createClient()
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          markFreshSignIn()
        } else {
          setMessage(authCopy.signupCheckEmail)
          setMessageIsError(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        markFreshSignIn()
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Something went wrong'
      setMessage(friendlyAuthMessage(raw, mode))
      setMessageIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="auth-first mx-auto w-full max-w-md">
        <AppPageHeader
          className="mb-6"
          as="h1"
          variant="page"
          title={header.title}
          description={header.description}
        />
        <Card className="mb-6 border-border/80 bg-muted/30 shadow-none">
          <CardContent className="space-y-3 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{authCopy.scopeHeading}</p>
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground leading-snug">
              {authCopy.scopeItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>
          {message && (
            <p className={`auth-message ${messageIsError ? 'error' : ''}`}>{message}</p>
          )}
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
                Working…
              </>
            ) : mode === 'signin' ? (
              'Sign in'
            ) : (
              'Sign up'
            )}
          </Button>
          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMessage('')
              setMessageIsError(false)
            }}
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">{authCopy.privacyOneLiner}</p>
        </form>
      </div>
    </AppShell>
  )
}
