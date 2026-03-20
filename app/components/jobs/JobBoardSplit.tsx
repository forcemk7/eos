'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent } from '@/app/components/ui/sheet'
import { cn } from '@/lib/utils'
import { JobDetailContent } from './JobDetailContent'
import { JobRowCard } from './JobRowCard'
import type { DiscoverListingWithApply } from './types'
import { ApplyReturnPrompt } from './ApplyTracking'
import { useMediaQuery } from './useMediaQuery'
import { listingKey, sameListing, sortListings, type JobSort } from './utils'

interface JobBoardSplitProps {
  listings: DiscoverListingWithApply[]
  sort: JobSort
  compact: boolean
  checkAllTrigger?: number
  onPatchListing: (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => void
}

export function JobBoardSplit({
  listings,
  sort,
  compact,
  checkAllTrigger,
  onPatchListing,
}: JobBoardSplitProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [selected, setSelected] = useState<DiscoverListingWithApply | null>(null)

  const sorted = useMemo(() => sortListings(listings, sort) as DiscoverListingWithApply[], [listings, sort])

  useEffect(() => {
    if (!selected) return
    const match = sorted.find((j) => sameListing(j, selected))
    if (!match) setSelected(null)
    else if (match !== selected) setSelected(match)
  }, [sorted, selected])

  return (
    <div
      className={cn(
        'jobs-board-split',
        isDesktop && selected && 'jobs-board-split--with-detail'
      )}
    >
      <ApplyReturnPrompt onPatch={onPatchListing} />
      <div className="jobs-board-split__list min-w-0 flex-1">
        <ul className="jobs-list">
          {sorted.map((job, idx) => (
            <JobRowCard
              key={listingKey(job, idx)}
              job={job}
              selected={selected ? sameListing(job, selected) : false}
              onSelect={setSelected}
              checkAllTrigger={checkAllTrigger}
              compact={compact}
              onPatchListing={onPatchListing}
            />
          ))}
        </ul>
      </div>
      {isDesktop && selected && (
        <div className="jobs-board-split__detail hidden md:block md:min-w-[320px] md:max-w-[420px] md:shrink-0">
          <JobDetailContent
            job={selected}
            layout="aside"
            onClose={() => setSelected(null)}
            checkAllTrigger={checkAllTrigger}
            onPatchListing={onPatchListing}
          />
        </div>
      )}
      <Sheet open={Boolean(selected) && !isDesktop} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side="right"
          className="jobs-job-sheet w-full border-l p-0 sm:max-w-lg motion-reduce:!animate-none motion-reduce:!transition-none"
        >
          {selected && (
            <JobDetailContent
              job={selected}
              layout="sheet"
              onClose={() => setSelected(null)}
              checkAllTrigger={checkAllTrigger}
              onPatchListing={onPatchListing}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
