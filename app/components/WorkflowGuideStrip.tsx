'use client'

import { useState, useEffect } from 'react'
import { workflowGuideStrip } from '@/lib/navCopy'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

export function WorkflowGuideStrip({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(workflowGuideStrip.storageKey) !== '1') {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border/80 bg-muted/40 text-sm text-muted-foreground shrink-0',
        className
      )}
    >
      <p className="min-w-0 leading-snug pr-2">{workflowGuideStrip.text}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0 self-start sm:self-center"
        onClick={() => {
          try {
            sessionStorage.setItem(workflowGuideStrip.storageKey, '1')
          } catch {
            // ignore
          }
          setVisible(false)
        }}
      >
        {workflowGuideStrip.dismiss}
      </Button>
    </div>
  )
}
