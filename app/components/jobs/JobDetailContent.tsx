'use client'

import { useCallback } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { JobFitIndicator } from '@/app/components/JobFitIndicator'
import { SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet'
import { ApplyOpenButton, ApplyStatusBadge } from './ApplyTracking'
import type { DiscoverListingWithApply } from './types'
import { formatPostedRelative, formatSourceLabel } from './utils'

interface JobDetailContentProps {
  job: DiscoverListingWithApply
  layout: 'aside' | 'sheet'
  onClose: () => void
  checkAllTrigger?: number
  onPatchListing: (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => void
  onOpenDataTab?: () => void
}

export function JobDetailContent({
  job,
  layout,
  onClose,
  checkAllTrigger,
  onPatchListing,
  onOpenDataTab,
}: JobDetailContentProps) {
  const title = job.title || 'Untitled'
  const posted = formatPostedRelative(job.posted_at)
  const source = formatSourceLabel(job.source)
  const body = job.description?.trim() || job.snippet?.trim() || 'No description available for this listing.'

  const copyLink = useCallback(async () => {
    if (!job.url) return
    try {
      await navigator.clipboard.writeText(job.url)
    } catch {
      // ignore
    }
  }, [job.url])

  const headerInner = (
    <>
      {layout === 'sheet' ? (
        <SheetHeader className="space-y-1 border-b border-border p-6 pb-4 text-left">
          <SheetTitle id="job-detail-title" className="pr-10 text-xl leading-tight">
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {`${title} at ${job.company}. ${posted ? `Posted ${posted}.` : ''}`}
          </SheetDescription>
          <p className="text-base font-medium text-muted-foreground" aria-hidden>
            {job.company}
          </p>
        </SheetHeader>
      ) : (
        <header className="jobs-detail-header border-b border-border p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="job-detail-title" className="m-0 text-xl font-semibold leading-tight text-foreground">
                {title}
              </h2>
              <p className="mt-1 text-base font-medium text-muted-foreground">{job.company}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onClose}
              aria-label="Close job details"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>
      )}
      <div className="jobs-detail-meta flex flex-wrap gap-2 px-6 py-3 text-sm text-muted-foreground">
        {job.location && <span>{job.location}</span>}
        {job.remote && <span className="jobs-remote-badge">Remote</span>}
        {posted && <span>{posted}</span>}
        <span className="jobs-source-pill">{source}</span>
        <ApplyStatusBadge listing={job} />
      </div>
    </>
  )

  const Root = layout === 'aside' ? 'aside' : 'div'

  return (
    <Root
      className="jobs-detail flex max-h-[min(100dvh,900px)] flex-col md:max-h-[calc(100vh-8rem)]"
      aria-label={layout === 'aside' ? 'Job details' : undefined}
      aria-labelledby="job-detail-title"
    >
      {headerInner}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Fit</span>
          <JobFitIndicator listing={job} triggerCheck={checkAllTrigger} onOpenDataTab={onOpenDataTab} />
        </div>
        <section aria-label="Job description">
          <h3 className="mb-2 text-sm font-semibold text-foreground">About this role</h3>
          <div className="jobs-detail-body whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {body}
          </div>
        </section>
      </div>
      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 motion-reduce:backdrop-blur-none">
        <p className="m-0 text-center text-xs text-muted-foreground">Opens on the employer or job site</p>
        <div className="flex flex-wrap gap-2">
          {job.url ? (
            <ApplyOpenButton
              listing={job}
              url={job.url}
              label="View & apply"
              onPatch={onPatchListing}
              className="flex-1 sm:flex-none"
            />
          ) : null}
          {job.url ? (
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={copyLink}>
              Copy link
            </Button>
          ) : null}
        </div>
      </footer>
    </Root>
  )
}
