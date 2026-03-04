'use client'

import * as React from 'react'
import { Database, Briefcase, Sparkles, FileText, FileCode } from 'lucide-react'
import type { Tab } from './AppSidebar'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { FeatureCard } from './FeatureCard'

const FEATURES: { tab: Tab; title: string; description: string; icon: React.ElementType }[] = [
  { tab: 'data', title: 'Data', description: 'Manage your profile data and keep your resume source up to date.', icon: Database },
  { tab: 'jobs', title: 'Job Board', description: 'Browse and save job listings to track applications.', icon: Briefcase },
  { tab: 'ai-jobs', title: 'Recommended Jobs', description: 'Discover jobs that match your profile with AI-powered recommendations.', icon: Sparkles },
  { tab: 'cover-letter', title: 'Cover Letter', description: 'Generate and manage job-specific cover letters for your applications.', icon: FileText },
  { tab: 'resume', title: 'Resume', description: 'Edit your resume, get AI suggestions, and export to PDF.', icon: FileCode },
]

interface DashboardProps {
  onNavigate: (tab: Tab) => void
  totalIncomplete?: number
  dataIncompleteCount?: number
  resumeIncompleteCount?: number
  onViewIncomplete?: () => void
}

export function Dashboard({
  onNavigate,
  totalIncomplete = 0,
  onViewIncomplete,
}: DashboardProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your job application tools. Open a card to get started.
        </p>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  )
}
