'use client'

import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import { Database, Briefcase, Sparkles, FileText, FileCode, GitBranch } from 'lucide-react'
import type { Tab } from './AppSidebar'
import { navItemCopy, dashboardPage } from '@/lib/navCopy'
import type { SetupAction } from '@/lib/profileCompleteness'
import { ApplicationPipelineDashboardStrip } from '@/app/components/applications/ApplicationPipelineDashboardStrip'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { AppShell, AppPageHeader } from '@/app/components/shell'
import { FeatureCard } from './FeatureCard'

const FEATURE_TABS = ['data', 'resume', 'jobs', 'ai-jobs', 'cover-letter', 'applications'] as const satisfies readonly Tab[]

type FeatureTab = (typeof FEATURE_TABS)[number]

const FEATURE_ICONS: Record<FeatureTab, React.ElementType> = {
  data: Database,
  resume: FileCode,
  jobs: Briefcase,
  'ai-jobs': Sparkles,
  'cover-letter': FileText,
  applications: GitBranch,
}

const FEATURES = FEATURE_TABS.map((tab) => ({
  tab,
  title: navItemCopy[tab].label,
  description: navItemCopy[tab].title,
  icon: FEATURE_ICONS[tab],
}))

const MAX_NEXT_STEPS = 8

interface DashboardProps {
  user: User | null
  onNavigate: (tab: Tab) => void
  totalIncomplete?: number
  dataIncompleteCount?: number
  resumeIncompleteCount?: number
  setupActions: SetupAction[]
  onNavigateToSetupAction: (action: SetupAction) => void
}

export function Dashboard({
  user,
  onNavigate,
  totalIncomplete = 0,
  dataIncompleteCount = 0,
  resumeIncompleteCount = 0,
  setupActions,
  onNavigateToSetupAction,
}: DashboardProps) {
  const visibleSteps = setupActions.slice(0, MAX_NEXT_STEPS)
  const restCount = setupActions.length - MAX_NEXT_STEPS
  const nextContinuation = restCount > 0 ? setupActions[MAX_NEXT_STEPS] : null

  return (
    <AppShell className="dashboard-page">
      <AppPageHeader
        as="h1"
        variant="page"
        title="Dashboard"
        description={dashboardPage.description}
      />

      {totalIncomplete > 0 && setupActions.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm text-muted-foreground m-0">
              <span className="font-medium text-foreground">Next steps</span>
              {' — '}
              {totalIncomplete} item{totalIncomplete !== 1 ? 's' : ''} to complete
              {dataIncompleteCount > 0 && resumeIncompleteCount > 0 ? (
                <span className="text-muted-foreground/90">
                  {' '}
                  (Profile {dataIncompleteCount} · Resume {resumeIncompleteCount})
                </span>
              ) : null}
            </p>
            <ul className="list-none m-0 p-0 space-y-0 divide-y divide-border/60 rounded-lg border border-border/50 bg-card/40">
              {visibleSteps.map((action) => (
                <li key={action.missingItem.id} className="flex items-center justify-between gap-3 px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg">
                  <span className="text-sm text-foreground">{action.missingItem.label}</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="shrink-0 h-auto py-0 px-2 text-primary"
                    onClick={() => onNavigateToSetupAction(action)}
                  >
                    Go
                  </Button>
                </li>
              ))}
            </ul>
            {nextContinuation && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto self-start"
                onClick={() => onNavigateToSetupAction(nextContinuation)}
              >
                And {restCount} more — continue
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/25 bg-primary/[0.04] shadow-sm">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GitBranch className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold text-foreground">Applications</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Boards, off-platform applies, Sankey pipeline view, and timeline updates—with CSV export for deeper
                analysis.
              </p>
            </div>
          </div>
          <Button className="shrink-0 w-full sm:w-auto" onClick={() => onNavigate('applications')}>
            Open applications
          </Button>
        </CardContent>
      </Card>

      <ApplicationPipelineDashboardStrip user={user} onOpenApplications={() => onNavigate('applications')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ tab, title, description, icon }) => (
          <FeatureCard
            key={tab}
            icon={icon}
            title={title}
            description={description}
            badge={tab === 'data' ? dataIncompleteCount : tab === 'resume' ? resumeIncompleteCount : undefined}
            onClick={() => onNavigate(tab)}
          />
        ))}
      </div>
    </AppShell>
  )
}
