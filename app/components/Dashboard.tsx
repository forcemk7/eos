'use client'

import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import { Database, Briefcase, Sparkles, FileText, FileCode, GitBranch } from 'lucide-react'
import type { Tab } from './AppSidebar'
import { ApplicationPipelineDashboardStrip } from '@/app/components/applications/ApplicationPipelineDashboardStrip'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { AppShell, AppPageHeader } from '@/app/components/shell'
import { FeatureCard } from './FeatureCard'

const FEATURES: { tab: Tab; title: string; description: string; icon: React.ElementType }[] = [
  { tab: 'data', title: 'Data', description: 'Manage your profile data and keep your resume source up to date.', icon: Database },
  { tab: 'jobs', title: 'Job Board', description: 'Browse and save job listings to track applications.', icon: Briefcase },
  { tab: 'ai-jobs', title: 'Recommended Jobs', description: 'Discover jobs that match your profile with AI-powered recommendations.', icon: Sparkles },
  { tab: 'cover-letter', title: 'Cover Letter', description: 'Generate and manage job-specific cover letters for your applications.', icon: FileText },
  { tab: 'resume', title: 'Resume', description: 'Edit your resume, get AI suggestions, and export to PDF.', icon: FileCode },
]

interface DashboardProps {
  user: User | null
  onNavigate: (tab: Tab) => void
  totalIncomplete?: number
  dataIncompleteCount?: number
  resumeIncompleteCount?: number
  onViewIncomplete?: () => void
}

export function Dashboard({
  user,
  onNavigate,
  totalIncomplete = 0,
  onViewIncomplete,
}: DashboardProps) {
  return (
    <AppShell className="dashboard-page">
      <AppPageHeader
        as="h1"
        variant="page"
        title="Dashboard"
        description="Overview of your job application tools. Open a card to get started."
      />

      {totalIncomplete > 0 && onViewIncomplete && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-row items-center justify-between gap-4 py-4">
            <span className="text-sm text-muted-foreground">
              {totalIncomplete} item{totalIncomplete !== 1 ? 's' : ''} to complete
            </span>
            <Button variant="link" size="sm" className="shrink-0 text-primary" onClick={onViewIncomplete}>
              View
            </Button>
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
              <h2 className="text-base font-semibold text-foreground">Application pipeline &amp; log</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Boards, off-platform applies, Sankey pipeline view, and timeline updates—with CSV export for deeper
                analysis.
              </p>
            </div>
          </div>
          <Button className="shrink-0 w-full sm:w-auto" onClick={() => onNavigate('applications')}>
            Open application log
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
            onClick={() => onNavigate(tab)}
          />
        ))}
      </div>
    </AppShell>
  )
}
