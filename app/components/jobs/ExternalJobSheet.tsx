'use client'

import { useState, useCallback } from 'react'
import { Briefcase } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet'

type TabMode = 'paste' | 'images'

export function ExternalJobSheet({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<TabMode>('paste')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [url, setUrl] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [runFit, setRunFit] = useState(true)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setMode('paste')
    setTitle('')
    setCompany('')
    setUrl('')
    setLocation('')
    setRemote(false)
    setDescription('')
    setNote('')
    setRunFit(true)
    setImageFiles([])
    setFormError(null)
  }, [])

  async function submitPaste(e: React.FormEvent) {
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
      const res = await fetch('/api/jobs/import-off-platform', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          company: c,
          url: url.trim() || undefined,
          location: location.trim() || undefined,
          remote,
          description: description.trim() || undefined,
          note: note.trim() || undefined,
          import_method: 'form',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')

      if (runFit && data.listing?.id) {
        await fetch(`/api/jobs/${data.listing.id}/fit`, {
          method: 'POST',
          credentials: 'include',
        })
      }

      reset()
      onImported?.()
      setOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function submitImages(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (imageFiles.length === 0) {
      setFormError('Choose one or more screenshots (PNG, JPEG, WebP, or GIF).')
      return
    }
    setSaving(true)
    try {
      const storage_paths: string[] = []
      for (const file of imageFiles.slice(0, 4)) {
        const fd = new FormData()
        fd.append('image', file)
        const up = await fetch('/api/cover-letter/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        })
        const upData = await up.json()
        if (!up.ok || !upData.storagePath) {
          throw new Error(upData.error || 'Image upload failed')
        }
        storage_paths.push(upData.storagePath as string)
      }

      const res = await fetch('/api/jobs/extract-from-images', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_paths, run_fit: runFit }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')

      reset()
      onImported?.()
      setOpen(false)
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
        <Button type="button" variant="outline" className="gap-2 shadow-sm">
          <Briefcase className="h-4 w-4" aria-hidden />
          Add external job
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col border-l border-border/80 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
          <SheetTitle className="text-lg">Add external job</SheetTitle>
          <SheetDescription className="text-left text-sm leading-relaxed">
            Paste a JD or upload screenshots. eOS saves a listing stub for fit checks, cover letters, and apply tracking
            (same as roles from search).
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-1 border-b border-border/60 px-6 pt-2">
          <button
            type="button"
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
              mode === 'paste'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('paste')}
          >
            Paste details
          </button>
          <button
            type="button"
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
              mode === 'images'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('images')}
          >
            Screenshots
          </button>
        </div>

        {mode === 'paste' ? (
          <form onSubmit={submitPaste} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {formError && (
              <p
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {formError}
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="ext-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Job title
              </label>
              <input
                id="ext-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Staff Engineer"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ext-company" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Company
              </label>
              <input
                id="ext-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Acme"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ext-url" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                URL <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </label>
              <input
                id="ext-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="https://…"
                inputMode="url"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ext-loc" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Location <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </label>
              <input
                id="ext-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Remote, hybrid, or city"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Remote-friendly role
            </label>
            <div className="space-y-1.5">
              <label htmlFor="ext-desc" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Job description <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </label>
              <textarea
                id="ext-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Paste the posting text for better fit checks and cover letters."
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ext-note" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Note <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </label>
              <textarea
                id="ext-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Referral, deadline, etc."
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                checked={runFit}
                onChange={(e) => setRunFit(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span className="text-sm leading-snug">
                <span className="font-medium text-foreground">Run fit check after save</span>
                <span className="mt-0.5 block text-muted-foreground">Uses your Data profile vs the posting.</span>
              </span>
            </label>
            <div className="mt-auto flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save listing'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitImages} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {formError && (
              <p
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {formError}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Upload up to 4 screenshots of the job posting. We extract title, company, and description in-app, then save an
              off-platform listing.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="text-sm"
              onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                checked={runFit}
                onChange={(e) => setRunFit(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span className="text-sm leading-snug">
                <span className="font-medium text-foreground">Run fit check after import</span>
              </span>
            </label>
            <div className="mt-auto flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Importing…' : 'Extract & save'}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
