'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import AuthForm from './components/AuthForm'
import ResumeUpload from './components/ResumeUpload'
import ResumeEditor, { ResumeData } from './components/ResumeEditor'
import DataTab from './components/DataTab'

type Tab = 'data' | 'resume'

interface ResumeVersion {
  id: string
  created_at: string
  file_name?: string
  parsed_data?: ResumeData
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [current, setCurrent] = useState<ResumeVersion | null>(null)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('data')
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        const u = session?.user ?? null
        userIdRef.current = u?.id ?? null
        setUser(u)
        setAuthLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const nextId = session?.user?.id ?? null
      if (nextId === userIdRef.current) return
      userIdRef.current = nextId
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const loadResume = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/api/resume', { credentials: 'include' })
      const data = await res.json()
      if (res.status === 401) {
        setUser(null)
        setCurrent(null)
        setVersions([])
        return
      }
      if (data.success) {
        setCurrent(data.current ?? null)
        setVersions(data.versions || [])
      }
    } catch (e) {
      console.error('Failed to load resume:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) loadResume()
    else setCurrent(null)
  }, [user, loadResume])

  const handleSave = useCallback(
    async (parsed: ResumeData) => {
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed }),
        credentials: 'include',
      })
      const data = await res.json()
      if (res.status === 401) setUser(null)
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed')
      await loadResume()
    },
    [loadResume]
  )

  const handleRestore = useCallback(async (versionId: string) => {
    const res = await fetch(`/api/resume/${versionId}`, { credentials: 'include' })
    const data = await res.json()
    if (res.status === 401) setUser(null)
    if (!res.ok || !data.success) throw new Error(data.error || 'Restore failed')
    setCurrent({
      id: data.version.id,
      created_at: data.version.created_at,
      file_name: data.version.file_name,
      parsed_data: data.version.parsed_data,
    })
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  const resumeData = current?.parsed_data || null

  if (authLoading) {
    return (
      <div className="app-shell">
        <header className="app-header-simple">
          <span className="app-logo">eOS</span>
          <span className="app-name">eOS</span>
        </header>
        <main className="app-content">
          <p className="loading-message">Loading…</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell">
        <header className="app-header-simple">
          <span className="app-logo">eOS</span>
          <span className="app-name">eOS</span>
        </header>
        <main className="app-content">
          <AuthForm />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header-simple">
        <span className="app-logo">eOS</span>
        <span className="app-name">eOS</span>
        <nav className="app-tabs">
          <button
            type="button"
            className={`app-tab${tab === 'data' ? ' active' : ''}`}
            onClick={() => setTab('data')}
          >
            Data
          </button>
          <button
            type="button"
            className={`app-tab${tab === 'resume' ? ' active' : ''}`}
            onClick={() => setTab('resume')}
          >
            Resume
          </button>
        </nav>
        <button type="button" className="secondary-button sign-out" onClick={handleSignOut}>
          Sign out
        </button>
      </header>
      <main className="app-content">
        {loading ? (
          <p className="loading-message">Loading…</p>
        ) : tab === 'data' ? (
          <DataTab
            initialData={current?.parsed_data ?? null}
            onSave={(data) => handleSave(data)}
            onDataChange={loadResume}
          />
        ) : tab === 'resume' ? (
          !current ? (
            <ResumeUpload onSuccess={loadResume} />
          ) : (
            <ResumeEditor
              initialData={current.parsed_data || ({} as ResumeData)}
              versions={versions}
              onSave={(data) => handleSave(data)}
              onRestore={handleRestore}
            />
          )
        ) : null}
      </main>
    </div>
  )
}
