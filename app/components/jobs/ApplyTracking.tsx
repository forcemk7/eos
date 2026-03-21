'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/app/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/app/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { DiscoverListingWithApply } from '@/lib/jobs/discoverListing'

const STORAGE_KEY = 'earnOS_pending_apply'
const MAX_PENDING_MS = 24 * 60 * 60 * 1000

type PendingPayload = {
  listingId: string
  stable_external_id: string
  title: string
  company: string
  openedAt: number
  sawBlurOrHidden: boolean
}

export function listingToSyncBody(l: DiscoverListingWithApply) {
  return {
    external_id: l.external_id,
    source: l.source,
    title: l.title,
    company: l.company,
    url: l.url,
    location: l.location,
    remote: l.remote,
    description: l.description,
    snippet: l.snippet,
    posted_at: l.posted_at,
    raw: l.raw,
  }
}

function markPendingSawLeave() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const p = JSON.parse(raw) as PendingPayload
    p.sawBlurOrHidden = true
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

export function ApplyReturnPrompt({
  onPatch,
}: {
  onPatch: (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<PendingPayload | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onHiddenOrBlur = () => {
      if (document.visibilityState === 'hidden') markPendingSawLeave()
    }
    const onBlur = () => markPendingSawLeave()
    document.addEventListener('visibilitychange', onHiddenOrBlur)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onHiddenOrBlur)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const tryOpenFromStorage = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const p = JSON.parse(raw) as PendingPayload
      if (!p.listingId || !p.openedAt) {
        sessionStorage.removeItem(STORAGE_KEY)
        return
      }
      if (Date.now() - p.openedAt > MAX_PENDING_MS) {
        sessionStorage.removeItem(STORAGE_KEY)
        return
      }
      if (!p.sawBlurOrHidden) return
      setPending(p)
      setOpen(true)
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') tryOpenFromStorage()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [tryOpenFromStorage])

  async function submitDecision(decision: 'applied' | 'not_applied' | 'later') {
    if (!pending || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/jobs/${pending.listingId}/apply-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'apply_decision',
          decision,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      const listing = data.listing
      onPatch(pending.stable_external_id, {
        apply_decision: listing.apply_decision,
        apply_decision_at: listing.apply_decision_at,
        apply_notes: listing.apply_notes,
        apply_remind_at: listing.apply_remind_at,
        pipeline_stage: listing.pipeline_stage ?? null,
      })
      sessionStorage.removeItem(STORAGE_KEY)
      setOpen(false)
      setPending(null)
      setNotes('')
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setPending(null)
      }}
    >
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Did you apply?</SheetTitle>
          <SheetDescription>
            {pending?.title} · {pending?.company}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Notes (optional)</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interview date, referral, etc."
            />
          </label>
        </div>
        <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-start">
          <Button disabled={submitting} onClick={() => submitDecision('applied')}>
            Applied
          </Button>
          <Button variant="secondary" disabled={submitting} onClick={() => submitDecision('not_applied')}>
            Didn&apos;t apply
          </Button>
          <Button variant="outline" disabled={submitting} onClick={() => submitDecision('later')}>
            Later
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ApplyStatusBadge({ listing }: { listing: DiscoverListingWithApply }) {
  if (listing.apply_decision === 'applied') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        Applied
      </span>
    )
  }
  if (listing.apply_decision === 'later') {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400">
        Later
      </span>
    )
  }
  if (listing.apply_decision === 'not_applied') {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Skipped
      </span>
    )
  }
  if (listing.apply_outbound_at) {
    return (
      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-400">
        Pending
      </span>
    )
  }
  return null
}

export function ApplyOpenButton({
  listing,
  url,
  label,
  onPatch,
  className,
  variant = 'default',
}: {
  listing: DiscoverListingWithApply
  url: string
  label?: string
  onPatch: (stable_external_id: string, patch: Partial<DiscoverListingWithApply>) => void
  className?: string
  variant?: 'default' | 'outline'
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (listing.apply_decision === 'applied') {
      if (!window.confirm('You marked this role as applied. Open the external apply link again?')) return
    }
    setLoading(true)
    try {
      let listingId = listing.listing_id
      if (!listingId) {
        const res = await fetch('/api/jobs/sync-discover', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listingToSyncBody(listing)),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Sync failed')
        listingId = typeof data.listing?.id === 'string' ? data.listing.id : undefined
        const row = data.listing
        if (row) {
          onPatch(listing.stable_external_id, {
            listing_id: listingId ?? null,
            external_id: (row.external_id as string | null | undefined) ?? listing.external_id ?? null,
          })
        }
      }
      if (!listingId) throw new Error('No listing id')

      const evRes = await fetch(`/api/jobs/${listingId}/apply-event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'apply_outbound_click' }),
      })
      const evData = await evRes.json()
      if (!evRes.ok) throw new Error(evData.error || 'Log failed')

      onPatch(listing.stable_external_id, {
        apply_outbound_at: evData.listing.apply_outbound_at,
      })

      const payload: PendingPayload = {
        listingId,
        stable_external_id: listing.stable_external_id,
        title: listing.title,
        company: listing.company,
        openedAt: Date.now(),
        sawBlurOrHidden: false,
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={loading}
      onClick={handleClick}
      className={cn('whitespace-nowrap', className)}
    >
      {loading ? '…' : (label ?? 'Apply')}
    </Button>
  )
}
