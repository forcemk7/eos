'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface AppTopBarProps {
  onMenuClick: () => void
}

export function AppTopBar({ onMenuClick }: AppTopBarProps) {
  return (
    <header className="md:hidden flex h-14 items-center gap-2 px-4 border-b border-border bg-card shrink-0 z-20">
      <Button variant="ghost" size="icon" className="shrink-0 min-h-[44px] min-w-[44px]" onClick={onMenuClick} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wide shrink-0">
        eOS
      </span>
      <span className="font-semibold text-sm text-foreground">eOS</span>
    </header>
  )
}
