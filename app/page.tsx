'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import AuthForm from './components/AuthForm'
import ResumeUpload from './components/ResumeUpload'
import ResumeEditor, { ResumeData } from './components/ResumeEditor'
import DataTab from './components/DataTab'
import JobsTab from './components/JobsTab'
import CoverLetterTab from './components/CoverLetterTab'

type Tab = 'data' | 'jobs' | 'resume' | 'cover-letter'

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
  const [dataIncompleteCount, setDataIncompleteCount] = useState(0)
  const userIdRef = useRef<string | null>(null)

  const resumeIncompleteCount = current ? 0 : 1
  const totalIncomplete = dataIncompleteCount + resumeIncompleteCount

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
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('earnOS_coverLetter_visited')
        window.sessionStorage.removeItem('earnOS_coverLetter_lastChatId')
      }
    } catch {
      // ignore
    }
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
            {dataIncompleteCount > 0 && (
              <span className="app-tab-badge" aria-label={`${dataIncompleteCount} incomplete`}>
                {dataIncompleteCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`app-tab${tab === 'jobs' ? ' active' : ''}`}
            onClick={() => setTab('jobs')}
          >
            Jobs
          </button>
          <button
            type="button"
            className={`app-tab${tab === 'cover-letter' ? ' active' : ''}`}
            onClick={() => setTab('cover-letter')}
          >
            Cover letter
          </button>
          <button
            type="button"
            className={`app-tab${tab === 'resume' ? ' active' : ''}`}
            onClick={() => setTab('resume')}
          >
            Resume
            {resumeIncompleteCount > 0 && (
              <span className="app-tab-badge" aria-label="1 incomplete">
                {resumeIncompleteCount}
              </span>
            )}
          </button>
        </nav>
        <button type="button" className="secondary-button sign-out" onClick={handleSignOut}>
          Sign out
        </button>
      </header>
      <main className={`app-content${tab === 'cover-letter' ? ' app-content-cover-letter' : ''}`}>
        {totalIncomplete > 0 && (
          <div className="dashboard-incomplete-strip" role="status">
            <span className="dashboard-incomplete-text">
              {totalIncomplete} item{totalIncomplete !== 1 ? 's' : ''} to complete
            </span>
            <button
              type="button"
              className="dashboard-incomplete-view"
              onClick={() => setTab(dataIncompleteCount >= resumeIncompleteCount ? 'data' : 'resume')}
            >
              View
            </button>
          </div>
        )}
        {loading ? (
          <p className="loading-message">Loading…</p>
        ) : tab === 'data' ? (
          <DataTab
            initialData={current?.parsed_data ?? null}
            onSave={(data) => handleSave(data)}
            onDataChange={loadResume}
            onCompletenessChange={setDataIncompleteCount}
          />
        ) : tab === 'jobs' ? (
          <JobsTab />
        ) : tab === 'cover-letter' ? (
          <CoverLetterTab />
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
