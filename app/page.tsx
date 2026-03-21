'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import AuthForm from './components/AuthForm'
import ResumeUpload from './components/ResumeUpload'
import ResumeEditor, { ResumeData } from './components/ResumeEditor'
import DataTab from './components/DataTab'
import JobsTab from './components/JobsTab'
import AIJobsTab from './components/AIJobsTab'
import ApplicationsTab from './components/ApplicationsTab'
import CoverLetterTab from './components/CoverLetterTab'
import { AppSidebar, type Tab } from './components/AppSidebar'
import { AppTopBar } from './components/AppTopBar'
import { Dashboard } from './components/Dashboard'
import { AppShell, AppLoadingBlock } from './components/shell'
import { listingToSyncBody } from './components/jobs/ApplyTracking'
import { stableExternalId } from '@/lib/jobs/stableExternalId'
import { jdTextFromListing, type DiscoverListingWithApply } from '@/lib/jobs/discoverListing'
import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import type {
  JobsBoardTab,
  ResumeVersionTailoring,
  TailorResumeSession,
} from '@/lib/resumeTailoring'

interface ResumeVersion {
  id: string
  created_at: string
  file_name?: string
  parsed_data?: ResumeData
  tailoring?: ResumeVersionTailoring | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [current, setCurrent] = useState<ResumeVersion | null>(null)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dataIncompleteCount, setDataIncompleteCount] = useState(0)
  const [tailorSession, setTailorSession] = useState<TailorResumeSession | null>(null)
  const [focusListingRequest, setFocusListingRequest] = useState<{
    stable_external_id: string
    tab: JobsBoardTab
  } | null>(null)
  const userIdRef = useRef<string | null>(null)

  const handleNavigate = useCallback((t: Tab) => {
    setTab(t)
    setSheetOpen(false)
  }, [])

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

  const consumeFocusListing = useCallback(() => setFocusListingRequest(null), [])

  const startTailorFromListing = useCallback(
    async (job: DiscoverListingWithApply, sourceTab: JobsBoardTab) => {
      let listingId = job.listing_id
      let stable = job.stable_external_id
      if (!listingId) {
        try {
          const res = await fetch('/api/jobs/sync-discover', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(listingToSyncBody(job)),
          })
          const data = await res.json()
          if (res.ok && data.success && data.listing?.id) {
            const row = data.listing as JobListingRow
            listingId = row.id
            stable = stableExternalId({
              external_id: row.external_id,
              source: row.source,
              title: row.title,
              company: row.company,
              url: row.url,
            })
          }
        } catch {
          // keep listingId null; save can still store JD + denormalized fields
        }
      }
      setTailorSession({
        sourceTab,
        stable_external_id: stable,
        listing_id: listingId,
        title: job.title,
        company: job.company,
        url: job.url,
        jdText: jdTextFromListing(job),
      })
      handleNavigate('resume')
    },
    [handleNavigate]
  )

  const openListingFromTailoring = useCallback(
    (t: ResumeVersionTailoring) => {
      if (t.stable_external_id) {
        setFocusListingRequest({ stable_external_id: t.stable_external_id, tab: t.source_tab ?? 'jobs' })
        handleNavigate((t.source_tab ?? 'jobs') as Tab)
        return
      }
      if (t.url) window.open(t.url, '_blank', 'noopener,noreferrer')
    },
    [handleNavigate]
  )

  const handleSave = useCallback(
    async (parsed: ResumeData) => {
      const attachTailoring =
        tab === 'resume' &&
        tailorSession &&
        (Boolean(tailorSession.listing_id) || Boolean(tailorSession.jdText.trim()))
      const tailoring = attachTailoring
        ? {
            job_listing_id: tailorSession.listing_id,
            jd_snapshot: tailorSession.jdText,
            title: tailorSession.title,
            company: tailorSession.company,
            url: tailorSession.url,
            source_tab: tailorSession.sourceTab,
          }
        : undefined
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed, ...(tailoring ? { tailoring } : {}) }),
        credentials: 'include',
      })
      const data = await res.json()
      if (res.status === 401) setUser(null)
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed')
      if (attachTailoring) setTailorSession(null)
      await loadResume()
    },
    [loadResume, tab, tailorSession]
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
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        currentTab={tab}
        onNavigate={handleNavigate}
        dataIncompleteCount={dataIncompleteCount}
        resumeIncompleteCount={resumeIncompleteCount}
        onSignOut={handleSignOut}
        sheetOpen={sheetOpen}
        onSheetOpenChange={setSheetOpen}
      />
      <div className="flex flex-1 flex-col min-w-0 md:ml-60">
        <AppTopBar onMenuClick={() => setSheetOpen(true)} />
        <main className={`flex-1 flex flex-col min-h-0 ${tab === 'cover-letter' ? ' app-content-cover-letter' : ''}`}>
          <div className={tab === 'cover-letter' ? 'flex-1 flex flex-col min-h-0' : 'flex-1 overflow-y-auto app-content'}>
            {totalIncomplete > 0 && tab !== 'dashboard' && (
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
              <AppShell>
                <AppLoadingBlock message="Loading your workspace…" className="justify-center" />
              </AppShell>
            ) : tab === 'dashboard' ? (
              <Dashboard
                user={user}
                onNavigate={handleNavigate}
                totalIncomplete={totalIncomplete}
                onViewIncomplete={() => setTab(dataIncompleteCount >= resumeIncompleteCount ? 'data' : 'resume')}
              />
            ) : tab === 'data' ? (
              <DataTab
                initialData={current?.parsed_data ?? null}
                onSave={(data) => handleSave(data)}
                onDataChange={loadResume}
                onCompletenessChange={setDataIncompleteCount}
              />
            ) : tab === 'jobs' ? (
              <JobsTab
                onOpenDataTab={() => handleNavigate('data')}
                focusStableExternalId={
                  focusListingRequest?.tab === 'jobs' ? focusListingRequest.stable_external_id : null
                }
                onFocusListingConsumed={consumeFocusListing}
                onStartTailorResume={(job) => void startTailorFromListing(job, 'jobs')}
              />
            ) : tab === 'ai-jobs' ? (
              <AIJobsTab
                onOpenDataTab={() => handleNavigate('data')}
                focusStableExternalId={
                  focusListingRequest?.tab === 'ai-jobs' ? focusListingRequest.stable_external_id : null
                }
                onFocusListingConsumed={consumeFocusListing}
                onStartTailorResume={(job) => void startTailorFromListing(job, 'ai-jobs')}
              />
            ) : tab === 'applications' ? (
              <ApplicationsTab onBrowseJobs={() => setTab('jobs')} onBrowseRecommended={() => setTab('ai-jobs')} />
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
                  tailorSession={tailorSession}
                  onDismissTailor={() => setTailorSession(null)}
                  onOpenJobPosting={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                  onShowListingInBoard={openListingFromTailoring}
                />
              )
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
