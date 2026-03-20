'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  FitLabel,
  JobFitClientResult,
  JobFitFactor,
  JobFitFactorCategory,
  ScreeningLikelihood,
} from '@/lib/jobsFit'

const ATS_CONTEXT = (
  <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
    <p className="m-0 font-medium text-foreground">How screening often works</p>
    <p className="m-0">
      Employers use different tools and workflows. Many applicant systems parse your resume into fields
      (titles, dates, skills). Keyword or rule-based filters are common before a recruiter reads
      anyone in depth.
    </p>
    <p className="m-0">
      Recruiters usually scan for role level, must-have tools or domains, and evidence in recent work.
      “Nice-to-haves” matter less early on. Nothing here guarantees how a specific company scores you.
    </p>
  </div>
)

const LABEL_COPY: Record<FitLabel, string> = {
  bad: 'Poor fit',
  okay: 'Stretch / possible',
  good: 'Solid fit',
  great: 'Strong fit',
}

const SCREENING_COPY: Record<ScreeningLikelihood, { title: string; hint: string }> = {
  qualified: {
    title: 'Qualified (estimate)',
    hint: 'Your stored profile lines up fairly well with what this posting emphasizes for a typical first pass.',
  },
  borderline: {
    title: 'Borderline (estimate)',
    hint: 'You might clear automated filters or might not, depending on how strict the stack is and who reads the queue.',
  },
  unlikely: {
    title: 'Unlikely first pass (estimate)',
    hint: 'Gaps or mismatches in the posting vs your profile suggest many stacks would deprioritize or filter this application unless something else stands out.',
  },
}

const CATEGORY_LABEL: Record<JobFitFactorCategory, string> = {
  experience_overlap: 'Experience overlap',
  keywords: 'Keywords & phrasing',
  seniority_tenure: 'Seniority & tenure',
  education: 'Education',
  location_remote: 'Location & work setup',
  other: 'Other',
}

function sentimentStyles(s: JobFitFactor['sentiment']) {
  switch (s) {
    case 'strength':
      return 'border-l-emerald-500 bg-emerald-500/[0.06]'
    case 'gap':
      return 'border-l-amber-500 bg-amber-500/[0.06]'
    default:
      return 'border-l-border bg-muted/40'
  }
}

export interface JobFitExplainModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobTitle?: string
  jobCompany?: string
  fit: JobFitClientResult
  onOpenDataTab?: () => void
  onTailorToJob?: () => void
}

export function JobFitExplainModal({
  open,
  onOpenChange,
  jobTitle,
  jobCompany,
  fit,
  onOpenDataTab,
  onTailorToJob,
}: JobFitExplainModalProps) {
  const screening = SCREENING_COPY[fit.screening_likelihood]
  const roleLine = [jobTitle, jobCompany].filter(Boolean).join(' · ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[min(90dvh,760px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl',
          'flex flex-col'
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-left text-base leading-snug sm:text-lg">
            How ATS &amp; recruiters may read you
          </DialogTitle>
          <DialogDescription className={roleLine ? 'text-left text-xs sm:text-sm' : 'sr-only'}>
            {roleLine || 'Fit explanation for this job listing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <section className="mb-6 rounded-lg border border-border/80 bg-muted/30 p-4">{ATS_CONTEXT}</section>

          <section className="mb-6 space-y-2">
            <h3 className="m-0 text-sm font-semibold text-foreground">Your match</h3>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{fit.score}%</span>
              <span className="text-sm text-muted-foreground">{LABEL_COPY[fit.label]}</span>
            </div>
            <p className="m-0 text-sm leading-relaxed text-foreground">{fit.summary}</p>
            <p className="m-0 text-xs text-muted-foreground">
              Estimate only, from your saved profile and this posting—not a prediction of outcome.
            </p>
            <div className="rounded-md border border-border bg-card px-3 py-2.5">
              <p className="m-0 text-sm font-medium text-foreground">{screening.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{screening.hint}</p>
            </div>
          </section>

          {fit.jd_phrases.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-foreground">From the posting</h3>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {fit.jd_phrases.map((p, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-accent/50 pl-3 text-sm italic leading-relaxed text-muted-foreground"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {fit.factors.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Factor breakdown</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {fit.factors.map((f, i) => (
                  <li
                    key={i}
                    className={cn(
                      'rounded-md border border-transparent border-l-4 py-2 pl-3 pr-2 text-sm leading-relaxed',
                      sentimentStyles(f.sentiment)
                    )}
                  >
                    <span className="font-medium text-foreground">{CATEGORY_LABEL[f.category]}.</span>{' '}
                    <span className="text-muted-foreground">{f.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">What to change in Data / resume</h3>
            {fit.data_actions.length > 0 ? (
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {fit.data_actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                Use the summary and factors above to tighten skills, bullets, and titles so they mirror
                terms the posting uses—without inventing experience.
              </p>
            )}
          </section>
        </div>

        {(onOpenDataTab || onTailorToJob) && (
          <DialogFooter className="shrink-0 border-t border-border bg-background/95 px-6 py-4 sm:justify-start">
            {onOpenDataTab && (
              <Button
                type="button"
                onClick={() => {
                  onOpenDataTab()
                  onOpenChange(false)
                }}
              >
                Open Data tab
              </Button>
            )}
            {onTailorToJob && (
              <Button type="button" variant="outline" onClick={onTailorToJob}>
                Tailor resume to job
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
