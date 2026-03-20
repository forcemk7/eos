'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Gauge, Loader2, Info } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

export interface JobFitListing {
  title?: string
  company?: string
  description?: string | null
  snippet?: string | null
  location?: string | null
  remote?: boolean
}

type FitLabel = 'bad' | 'okay' | 'good' | 'great'

const LABEL_COLORS: Record<FitLabel, string> = {
  bad: 'text-red-600 dark:text-red-400 [--fit-stroke:theme(colors.red.500)]',
  okay: 'text-amber-600 dark:text-amber-400 [--fit-stroke:theme(colors.amber.500)]',
  good: 'text-green-600 dark:text-green-400 [--fit-stroke:theme(colors.green.500)]',
  great: 'text-emerald-600 dark:text-emerald-400 [--fit-stroke:theme(colors.emerald.500)]',
}

const SIZE = 36
const STROKE = 3
const R = (SIZE - STROKE) / 2
const C = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * R

function CircularScore({
  score,
  label,
  onClick,
  hasFeedback,
}: {
  score: number
  label: FitLabel
  onClick?: () => void
  hasFeedback?: boolean
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE
  const colorClass = LABEL_COLORS[label] ?? LABEL_COLORS.okay
  const isClickable = onClick != null
  const content = (
    <>
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="opacity-20"
        />
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute text-xs font-medium tabular-nums">{clamped}%</span>
      {hasFeedback && (
        <Info className="absolute -bottom-0.5 -right-0.5 h-3 w-3 opacity-70" aria-hidden />
      )}
    </>
  )
  if (isClickable) {
    return (
      <button
        type="button"
        className={cn(
          'relative inline-flex items-center justify-center cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          colorClass
        )}
        onClick={onClick}
        title={hasFeedback ? 'View feedback' : `Fit: ${clamped}% (${label})`}
        aria-label={hasFeedback ? `Fit ${clamped}% – click for feedback` : `Fit ${clamped}%`}
      >
        {content}
      </button>
    )
  }
  return (
    <div className={cn('relative inline-flex items-center justify-center', colorClass)}>
      {content}
    </div>
  )
}

interface JobFitIndicatorProps {
  listing: JobFitListing
  className?: string
  /** When set (e.g. timestamp), triggers a fit check if currently idle. Used by "Check all" button. */
  triggerCheck?: number
}

export function JobFitIndicator({ listing, className, triggerCheck }: JobFitIndicatorProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<{
    score: number
    label: FitLabel
    feedback: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const lastTriggerRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const runFit = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const res = await fetch('/api/jobs/fit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: listing.title,
          company: listing.company,
          description: listing.description ?? undefined,
          snippet: listing.snippet ?? undefined,
          location: listing.location ?? undefined,
          remote: listing.remote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Request failed')
        setState('error')
        return
      }
      if (data.success && typeof data.score === 'number' && data.label) {
        const label = ['bad', 'okay', 'good', 'great'].includes(data.label)
          ? (data.label as FitLabel)
          : 'okay'
        const feedback =
          typeof data.feedback === 'string' && data.feedback.trim()
            ? data.feedback.trim()
            : null
        setResult({ score: data.score, label, feedback })
        setState('success')
      } else {
        setError('Invalid response')
        setState('error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setState('error')
    }
  }, [listing])

  useEffect(() => {
    if (triggerCheck == null || state !== 'idle' || lastTriggerRef.current === triggerCheck) return
    lastTriggerRef.current = triggerCheck
    runFit()
  }, [triggerCheck, state, runFit])

  useEffect(() => {
    if (!feedbackOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      setFeedbackOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [feedbackOpen])

  if (state === 'success' && result) {
    const hasFeedback = Boolean(result.feedback)
    return (
      <div ref={containerRef} className={cn('relative flex items-center', className)}>
        <CircularScore
          score={result.score}
          label={result.label}
          onClick={hasFeedback ? () => setFeedbackOpen((o) => !o) : undefined}
          hasFeedback={hasFeedback}
        />
        {feedbackOpen && result.feedback && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-md border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-md"
            role="dialog"
            aria-label="Fit feedback"
          >
            <p className="whitespace-pre-wrap">{result.feedback}</p>
          </div>
        )}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={runFit}
          title={error ?? 'Retry fit check'}
        >
          <Gauge className="h-4 w-4" />
        </Button>
        {error && (
          <span className="text-[10px] text-muted-foreground max-w-[80px] truncate" title={error}>
            {error}
          </span>
        )}
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9 flex-shrink-0', className)}
      onClick={runFit}
      disabled={state === 'loading'}
      title="Check fit"
      aria-label="How qualified am I for this job?"
    >
      {state === 'loading' ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <Gauge className="h-4 w-4" />
      )}
    </Button>
  )
}
