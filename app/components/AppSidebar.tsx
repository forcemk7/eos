'use client'

import * as React from 'react'
import { LayoutDashboard, Database, Briefcase, Sparkles, FileText, FileCode, GitBranch, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetHeader,
} from '@/app/components/ui/sheet'

export type Tab =
  | 'dashboard'
  | 'data'
  | 'jobs'
  | 'ai-jobs'
  | 'applications'
  | 'cover-letter'
  | 'resume'

const NAV_ITEMS: { tab: Tab; label: string; icon: React.ElementType }[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'data', label: 'Data', icon: Database },
  { tab: 'jobs', label: 'Job Board', icon: Briefcase },
  { tab: 'ai-jobs', label: 'Recommended Jobs', icon: Sparkles },
  { tab: 'applications', label: 'Applications', icon: GitBranch },
  { tab: 'cover-letter', label: 'Cover Letter', icon: FileText },
  { tab: 'resume', label: 'Resume', icon: FileCode },
]

interface AppSidebarProps {
  currentTab: Tab
  onNavigate: (tab: Tab) => void
  dataIncompleteCount: number
  resumeIncompleteCount: number
  onSignOut: () => void
  /** Mobile: sheet open state */
  sheetOpen?: boolean
  onSheetOpenChange?: (open: boolean) => void
}

function NavContent({
  currentTab,
  onNavigate,
  dataIncompleteCount,
  resumeIncompleteCount,
}: {
  currentTab: Tab
  onNavigate: (tab: Tab) => void
  dataIncompleteCount: number
  resumeIncompleteCount: number
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
        const badge =
          tab === 'data' ? dataIncompleteCount : tab === 'resume' ? resumeIncompleteCount : 0
        const isActive = currentTab === tab
        return (
          <Button
            key={tab}
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3 font-normal min-h-[44px] py-3 transition-colors duration-150',
              isActive
                ? 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground'
                : 'hover:bg-muted/80 hover:text-foreground'
            )}
            onClick={() => onNavigate(tab)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {badge > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-amber-500/90 text-[10px] font-semibold text-black"
                aria-label={`${badge} incomplete`}
              >
                {badge}
              </span>
            )}
          </Button>
        )
      })}
    </nav>
  )
}

export function AppSidebar({
  currentTab,
  onNavigate,
  dataIncompleteCount,
  resumeIncompleteCount,
  onSignOut,
  sheetOpen = false,
  onSheetOpenChange,
}: AppSidebarProps) {
  const navContent = (
    <NavContent
      currentTab={currentTab}
      onNavigate={onNavigate}
      dataIncompleteCount={dataIncompleteCount}
      resumeIncompleteCount={resumeIncompleteCount}
    />
  )

  return (
    <>
      {/* Desktop sidebar: fixed left, hidden on mobile */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 md:border-r md:border-border/50 md:bg-card z-30'
        )}
      >
        <div className="flex h-14 items-center gap-2 px-4 border-b border-border shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wide">
            eOS
          </span>
          <span className="font-semibold text-sm text-foreground">eOS</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
          {navContent}
        </div>
        <div className="p-3 border-t border-border shrink-0">
          <Button variant="ghost" className="w-full justify-start gap-3 font-normal min-h-[44px] py-3 transition-colors duration-150 hover:bg-muted/80" onClick={onSignOut}>
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile: Sheet with same nav */}
      {onSheetOpenChange != null && (
        <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
          <SheetContent side="left" className="w-60 max-w-[85vw] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border text-left">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wide">
                  eOS
                </span>
                <span className="font-semibold">eOS</span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
              {navContent}
            </div>
            <div className="p-3 border-t border-border shrink-0">
              <Button variant="ghost" className="w-full justify-start gap-3 font-normal min-h-[44px] py-3 transition-colors duration-150 hover:bg-muted/80" onClick={onSignOut}>
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
