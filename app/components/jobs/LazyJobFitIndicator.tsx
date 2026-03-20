'use client'

import { useEffect, useRef, useState } from 'react'
import { JobFitIndicator } from '@/app/components/JobFitIndicator'
import type { DiscoverListing } from './types'

interface LazyJobFitIndicatorProps {
  listing: DiscoverListing
  triggerCheck?: number
}

/** Defers mounting JobFitIndicator until the row is near the viewport (performance). */
export function LazyJobFitIndicator({ listing, triggerCheck }: LazyJobFitIndicatorProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (triggerCheck != null) setVisible(true)
  }, [triggerCheck])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: '100px 0px', threshold: 0.01 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="inline-flex h-9 w-9 shrink-0 items-center justify-center">
      {visible ? (
        <JobFitIndicator listing={listing} triggerCheck={triggerCheck} />
      ) : (
        <span className="sr-only">Fit score loads when this row is visible</span>
      )}
    </div>
  )
}
