'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  React.useEffect(() => setMounted(true), [])

  const cycle = () => {
    if (theme === 'system') setTheme('light')
    else if (theme === 'light') setTheme('dark')
    else setTheme('system')
  }

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun
  const label =
    theme === 'system'
      ? 'Theme: System (follows device). Click for light mode.'
      : theme === 'light'
        ? 'Light theme. Click for dark mode.'
        : 'Dark theme. Click for system default.'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('shrink-0', className)}
      onClick={cycle}
      title={label}
      aria-label={label}
      disabled={!mounted}
    >
      <Icon className={cn('h-4 w-4', !mounted && 'opacity-0')} aria-hidden />
    </Button>
  )
}
