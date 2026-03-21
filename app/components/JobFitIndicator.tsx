'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Gauge, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import {
  normalizeJobFitPayload,
  toClientFitResult,
  type FitLabel,
  type JobFitClientResult,
} from '@/lib/jobsFit'
import { JobFitExplainModal } from '@/app/components/jobs/JobFitExplainModal'

export interface JobFitListing {
  title?: string
  company?: string
  description?: string | null
  snippet?: string | null
  location?: string | null
  remote?: boolean
}

const LABEL_COLORS: Record<FitLabel, string> = {
  bad: 'text-red-600 dark:text-red-400 [--fit-stroke:theme(colors.red.500)]',
  okay: 'text-warning [--fit-stroke:hsl(var(--warning))]',
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
}: {
  score: number
  label: FitLabel
  onClick: () => void
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE
  const colorClass = LABEL_COLORS[label] ?? LABEL_COLORS.okay
  return (
    <button
      type="button"
      className={cn(
        'relative inline-flex items-center justify-center cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        colorClass
      )}
      onClick={onClick}
      title="Why this fit score — open details"
      aria-label={`Fit score ${clamped} percent — open why this fit score for this job`}
    >
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
    </button>
  )
}

interface JobFitIndicatorProps {
  listing: JobFitListing
  className?: string
  /** When set (e.g. timestamp), triggers a fit check if currently idle. Used by "Check all" button. */
  triggerCheck?: number
  onOpenDataTab?: () => void
  onTailorToJob?: () => void
}

export function JobFitIndicator({
  listing,
  className,
  triggerCheck,
  onOpenDataTab,
  onTailorToJob,
}: JobFitIndicatorProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<JobFitClientResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const lastTriggerRef = useRef<number | null>(null)

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
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Request failed')
        setState('error')
        return
      }
      if (data.success === true && typeof data.score === 'number') {
        const normalized = normalizeJobFitPayload(data)
        setResult(toClientFitResult(normalized))
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

  if (state === 'success' && result) {
    return (
      <div className={cn('relative flex items-center', className)}>
        <CircularScore
          score={result.score}
          label={result.label}
          onClick={() => setModalOpen(true)}
        />
        <JobFitExplainModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          jobTitle={listing.title}
          jobCompany={listing.company}
          fit={result}
          onOpenDataTab={onOpenDataTab}
          onTailorToJob={onTailorToJob}
        />
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
          title={error ?? 'Retry fit score check'}
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
      title="Check fit score"
      aria-label="Run fit score check for this job"
    >
      {state === 'loading' ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <Gauge className="h-4 w-4" />
      )}
    </Button>
  )
}
