'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import { AppShell, AppLoadingBlock, AppErrorState } from './components/shell'
import { humanizeFetchError } from '@/lib/humanizeFetchError'
import { WorkflowGuideStrip } from './components/WorkflowGuideStrip'
import { ensureDiscoverListingSynced } from '@/lib/jobs/syncDiscoverListing'
import { jdTextFromListing, type DiscoverListingWithApply } from '@/lib/jobs/discoverListing'
import type {
  JobsBoardTab,
  ResumeVersionTailoring,
  TailorResumeSession,
} from '@/lib/resumeTailoring'
import { getDataIncompleteCount, getOrderedSetupActions, type SetupAction } from '@/lib/profileCompleteness'
import type { DataSectionId } from '@/lib/dataSection'

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
  const [resumeLoadError, setResumeLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dataIncompleteCount, setDataIncompleteCount] = useState(0)
  const [dataSectionFocus, setDataSectionFocus] = useState<DataSectionId | null>(null)
  const [tailorSession, setTailorSession] = useState<TailorResumeSession | null>(null)
  const [focusListingRequest, setFocusListingRequest] = useState<{
    stable_external_id: string
    tab: JobsBoardTab
  } | null>(null)
  const [coverLetterListingIntent, setCoverLetterListingIntent] = useState<{
    listingId: string
    title: string
    company: string
  } | null>(null)
  const [applicationsListingFocusId, setApplicationsListingFocusId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const handleNavigate = useCallback((t: Tab) => {
    setTab(t)
    setSheetOpen(false)
    if (t === 'data') setDataSectionFocus(null)
  }, [])

  const resumeIncompleteCount = current ? 0 : 1
  const totalIncomplete = dataIncompleteCount + resumeIncompleteCount

  const setupActions = useMemo(
    () => getOrderedSetupActions(current?.parsed_data ?? null, Boolean(current)),
    [current]
  )

  const consumeDataSectionFocus = useCallback(() => setDataSectionFocus(null), [])

  const navigateToSetupAction = useCallback((action: SetupAction) => {
    if (action.tab === 'data' && action.dataSection) setDataSectionFocus(action.dataSection)
    else setDataSectionFocus(null)
    setTab(action.tab as Tab)
    setSheetOpen(false)
  }, [])

  const firstSetupAction = setupActions[0]

  const navigateToFirstIncomplete = useCallback(() => {
    if (firstSetupAction) navigateToSetupAction(firstSetupAction)
    else setTab('data')
  }, [firstSetupAction, navigateToSetupAction])

  useEffect(() => {
    if (tab === 'data') return
    setDataIncompleteCount(getDataIncompleteCount(current?.parsed_data ?? null))
  }, [current, tab])

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
    setResumeLoadError(null)
    try {
      const res = await fetch('/api/resume', { credentials: 'include' })
      let data: {
        success?: boolean
        error?: string
        current?: ResumeVersion | null
        versions?: ResumeVersion[]
      } = {}
      try {
        data = await res.json()
      } catch {
        data = {}
      }
      if (res.status === 401) {
        setUser(null)
        setCurrent(null)
        setVersions([])
        return
      }
      if (data.success) {
        setCurrent(data.current ?? null)
        setVersions(data.versions || [])
      } else {
        setCurrent(null)
        setVersions([])
        setResumeLoadError(
          humanizeFetchError(null, { status: res.status, apiMessage: data.error, fallback: 'Could not load your resume.' })
        )
      }
    } catch (e) {
      console.error('Failed to load resume:', e)
      setCurrent(null)
      setVersions([])
      setResumeLoadError(humanizeFetchError(e, { fallback: 'Could not load your resume.' }))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) void loadResume()
    else {
      setCurrent(null)
      setVersions([])
      setResumeLoadError(null)
    }
  }, [user, loadResume])

  const consumeFocusListing = useCallback(() => setFocusListingRequest(null), [])
  const consumeCoverLetterIntent = useCallback(() => setCoverLetterListingIntent(null), [])
  const consumeApplicationsListingFocus = useCallback(() => setApplicationsListingFocusId(null), [])

  const startTailorFromListing = useCallback(
    async (job: DiscoverListingWithApply, sourceTab: JobsBoardTab) => {
      const synced = await ensureDiscoverListingSynced(job)
      const listingId = synced?.listingId ?? null
      const stable = synced?.stable_external_id ?? job.stable_external_id
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

  const startCoverLetterFromListing = useCallback(
    async (job: DiscoverListingWithApply) => {
      const synced = await ensureDiscoverListingSynced(job)
      if (!synced) {
        alert('Could not save this listing. Try again or add the job from Applications.')
        return
      }
      setCoverLetterListingIntent({
        listingId: synced.listingId,
        title: job.title,
        company: job.company,
      })
      handleNavigate('cover-letter')
    },
    [handleNavigate]
  )

  const openApplicationsForListing = useCallback(
    async (job: DiscoverListingWithApply) => {
      const synced = await ensureDiscoverListingSynced(job)
      if (!synced) {
        alert('Could not save this listing. Try again or add the job from Applications.')
        return
      }
      setApplicationsListingFocusId(synced.listingId)
      handleNavigate('applications')
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
      <div className="app-auth-layout">
        <header className="app-header-simple">
          <span className="app-logo">eOS</span>
          <span className="app-name">eOS</span>
        </header>
        <main className="app-content">
          <AppLoadingBlock message="Checking your session…" className="max-w-md mx-auto" />
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-auth-layout">
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
      <div className="flex flex-1 flex-col min-w-0 md:ml-[15.5rem]">
        <AppTopBar currentTab={tab} onMenuClick={() => setSheetOpen(true)} />
        <main
          className={`flex min-h-0 min-w-0 flex-1 flex-col ${tab === 'cover-letter' ? ' app-content-cover-letter' : ''}`}
        >
          <div
            className={
              tab === 'cover-letter'
                ? 'flex min-h-0 min-w-0 flex-1 flex-col'
                : 'app-content min-w-0 flex-1 overflow-y-auto'
            }
          >
            <WorkflowGuideStrip />
            {totalIncomplete > 0 && tab !== 'dashboard' && (
              <div className="dashboard-incomplete-strip" role="status">
                <span className="dashboard-incomplete-text">
                  {totalIncomplete} item{totalIncomplete !== 1 ? 's' : ''} to complete
                  {firstSetupAction ? (
                    <>
                      {' '}
                      · Next: {firstSetupAction.missingItem.label}
                    </>
                  ) : null}
                </span>
                <button type="button" className="dashboard-incomplete-view" onClick={navigateToFirstIncomplete}>
                  View
                </button>
              </div>
            )}
            {loading ? (
              <AppShell>
                <AppLoadingBlock message="Loading your workspace…" className="justify-center" />
              </AppShell>
            ) : resumeLoadError ? (
              <AppShell>
                <AppErrorState message={resumeLoadError} onRetry={() => void loadResume()} />
              </AppShell>
            ) : tab === 'dashboard' ? (
              <Dashboard
                user={user}
                onNavigate={handleNavigate}
                totalIncomplete={totalIncomplete}
                dataIncompleteCount={dataIncompleteCount}
                resumeIncompleteCount={resumeIncompleteCount}
                setupActions={setupActions}
                onNavigateToSetupAction={navigateToSetupAction}
              />
            ) : tab === 'data' ? (
              <DataTab
                initialData={current?.parsed_data ?? null}
                onSave={(data) => handleSave(data)}
                onDataChange={loadResume}
                onCompletenessChange={setDataIncompleteCount}
                focusSection={dataSectionFocus}
                onFocusSectionConsumed={consumeDataSectionFocus}
              />
            ) : tab === 'jobs' ? (
              <JobsTab
                onOpenDataTab={() => handleNavigate('data')}
                focusStableExternalId={
                  focusListingRequest?.tab === 'jobs' ? focusListingRequest.stable_external_id : null
                }
                onFocusListingConsumed={consumeFocusListing}
                onStartTailorResume={(job) => void startTailorFromListing(job, 'jobs')}
                onStartCoverLetterFromListing={(job) => void startCoverLetterFromListing(job)}
                onOpenApplicationsForListing={(job) => void openApplicationsForListing(job)}
              />
            ) : tab === 'ai-jobs' ? (
              <AIJobsTab
                onOpenDataTab={() => handleNavigate('data')}
                focusStableExternalId={
                  focusListingRequest?.tab === 'ai-jobs' ? focusListingRequest.stable_external_id : null
                }
                onFocusListingConsumed={consumeFocusListing}
                onStartTailorResume={(job) => void startTailorFromListing(job, 'ai-jobs')}
                onStartCoverLetterFromListing={(job) => void startCoverLetterFromListing(job)}
                onOpenApplicationsForListing={(job) => void openApplicationsForListing(job)}
              />
            ) : tab === 'applications' ? (
              <ApplicationsTab
                onBrowseJobs={() => setTab('jobs')}
                onBrowseRecommended={() => setTab('ai-jobs')}
                focusListingId={applicationsListingFocusId}
                onFocusListingConsumed={consumeApplicationsListingFocus}
              />
            ) : tab === 'cover-letter' ? (
              <CoverLetterTab
                listingIntent={coverLetterListingIntent}
                onListingIntentConsumed={consumeCoverLetterIntent}
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
                  resumeSourceId={current.id ?? 'profile'}
                  sourceFileName={current.file_name ?? versions[0]?.file_name ?? null}
                  savedSnapshotAt={
                    (current.id ?? 'profile') === 'profile'
                      ? (versions[0]?.created_at ?? null)
                      : (versions.find((v) => v.id === current.id)?.created_at ?? null)
                  }
                  currentTailoring={
                    current.id && current.id !== 'profile'
                      ? versions.find((v) => v.id === current.id)?.tailoring ?? null
                      : null
                  }
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
