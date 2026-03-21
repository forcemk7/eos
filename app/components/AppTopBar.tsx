'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { navItemCopy } from '@/lib/navCopy'
import type { Tab } from '@/app/components/AppSidebar'

interface AppTopBarProps {
  currentTab: Tab
  onMenuClick: () => void
}

export function AppTopBar({ currentTab, onMenuClick }: AppTopBarProps) {
  const { label } = navItemCopy[currentTab]

  return (
    <header className="md:hidden flex min-h-14 items-center gap-2 px-4 pt-[env(safe-area-inset-top)] pb-0 border-b border-border bg-card shrink-0 z-20">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 min-h-[44px] min-w-[44px] self-center"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2">
        <h1 className="truncate text-sm font-semibold text-foreground leading-tight">{label}</h1>
        <p className="truncate text-xs text-muted-foreground leading-tight">eOS</p>
      </div>
    </header>
  )
}
