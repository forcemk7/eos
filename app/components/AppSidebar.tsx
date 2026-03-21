'use client'

import * as React from 'react'
import { LayoutDashboard, Database, Briefcase, Sparkles, FileText, FileCode, GitBranch, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItemCopy, type NavTabKey } from '@/lib/navCopy'
import { Button } from '@/app/components/ui/button'
import { ThemeToggle } from '@/app/components/theme-toggle'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetHeader,
  SheetDescription,
} from '@/app/components/ui/sheet'

export type Tab = NavTabKey

const NAV_ITEMS: { tab: Tab; icon: React.ElementType }[] = [
  { tab: 'dashboard', icon: LayoutDashboard },
  { tab: 'data', icon: Database },
  { tab: 'resume', icon: FileCode },
  { tab: 'jobs', icon: Briefcase },
  { tab: 'ai-jobs', icon: Sparkles },
  { tab: 'cover-letter', icon: FileText },
  { tab: 'applications', icon: GitBranch },
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
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV_ITEMS.map(({ tab, icon: Icon }) => {
        const { label, subtitle, title } = navItemCopy[tab]
        const badge =
          tab === 'data' ? dataIncompleteCount : tab === 'resume' ? resumeIncompleteCount : 0
        const isActive = currentTab === tab
        return (
          <Button
            key={tab}
            type="button"
            variant="ghost"
            title={title}
            className={cn(
              'w-full justify-start gap-3 font-normal min-h-[52px] py-2.5 px-3 h-auto transition-colors duration-150',
              isActive
                ? 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground'
                : 'hover:bg-muted/80 hover:text-foreground'
            )}
            onClick={() => onNavigate(tab)}
          >
            <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span className="flex-1 text-left min-w-0">
              <span className="block text-sm font-medium leading-tight">{label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground font-normal mt-0.5">
                {subtitle}
              </span>
            </span>
            {badge > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-warning text-[10px] font-semibold text-warning-foreground shrink-0 self-start mt-0.5"
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

  const currentLabel = navItemCopy[currentTab].label

  return (
    <>
      {/* Desktop sidebar: fixed left, hidden on mobile */}
      <aside
        aria-label="Site"
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[15.5rem] md:border-r md:border-border/50 md:bg-card z-30'
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
        <div className="p-3 border-t border-border shrink-0 flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <ThemeToggle className="min-h-[44px] min-w-[44px]" />
            <span className="text-xs text-muted-foreground">Theme</span>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 font-normal min-h-[44px] py-3 transition-colors duration-150 hover:bg-muted/80" onClick={onSignOut}>
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
        </div>
      </aside>

      {onSheetOpenChange != null && (
        <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
          <SheetContent side="left" className="w-[17rem] max-w-[85vw] p-0 flex flex-col">
            <SheetHeader className="p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-border text-left space-y-1">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wide">
                  eOS
                </span>
                <span className="font-semibold">eOS</span>
              </SheetTitle>
              <SheetDescription>Navigate sections. Current: {currentLabel}.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto overscroll-y-contain p-3 flex flex-col gap-4">
              {navContent}
            </div>
            <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border shrink-0 flex flex-col gap-1">
              <div className="flex items-center gap-1 px-1">
                <ThemeToggle className="min-h-[44px] min-w-[44px]" />
                <span className="text-xs text-muted-foreground">Theme</span>
              </div>
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
