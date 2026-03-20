'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet'

export function ManualApplicationSheet({ onLogged }: { onLogged: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [url, setUrl] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [markApplied, setMarkApplied] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function reset() {
    setTitle('')
    setCompany('')
    setUrl('')
    setLocation('')
    setNote('')
    setMarkApplied(true)
    setFormError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const t = title.trim()
    const c = company.trim()
    if (!t || !c) {
      setFormError('Add a job title and company.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/jobs/log-manual', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          company: c,
          url: url.trim() || undefined,
          location: location.trim() || undefined,
          note: note.trim() || undefined,
          mark_applied: markApplied,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      reset()
      setOpen(false)
      onLogged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="default" className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" aria-hidden />
          Log off-platform role
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col border-l border-border/80 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
          <SheetTitle className="text-lg">Log an application</SheetTitle>
          <SheetDescription className="text-left text-sm leading-relaxed">
            Tracked roles from LinkedIn, email, or referrals—same pipeline and funnel as jobs you open in eOS.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {formError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="manual-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Job title
            </label>
            <input
              id="manual-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Product Designer"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="manual-company" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Company
            </label>
            <input
              id="manual-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Acme Corp"
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="manual-url" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Listing URL <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
            </label>
            <input
              id="manual-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="https://…"
              inputMode="url"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="manual-loc" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Location <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
            </label>
            <input
              id="manual-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. London · Hybrid"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <input
              type="checkbox"
              checked={markApplied}
              onChange={(e) => setMarkApplied(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span className="text-sm leading-snug">
              <span className="font-medium text-foreground">I submitted an application</span>
              <span className="mt-0.5 block text-muted-foreground">
                Uncheck if you&apos;re only saving the role to follow up later.
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <label htmlFor="manual-note" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              id="manual-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Referral from Alex, take-home due Friday…"
            />
          </div>
          <div className="mt-auto flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save to pipeline'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
