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
import { cn, splitIntoSentences } from '@/lib/utils'
import type {
  FitLabel,
  JobFitClientResult,
  JobFitFactor,
  JobFitFactorCategory,
  ScreeningLikelihood,
} from '@/lib/jobsFit'

const ATS_BULLETS = [
  'Employers use different tools. Many systems parse your resume into fields (titles, dates, skills).',
  'Keyword or rule-based filters are common before anyone is read in depth.',
  'Recruiters often scan for role level, must-have tools or domains, and evidence in recent work—nice-to-haves matter less early on.',
  'Nothing here guarantees how a specific company scores you.',
]

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
      return 'border-l-warning bg-warning/[0.06]'
    default:
      return 'border-l-border bg-muted/40'
  }
}

function SummaryBlock({ text }: { text: string }) {
  const sentences = splitIntoSentences(text)
  if (sentences.length <= 1) {
    return <p className="m-0 text-sm leading-relaxed text-foreground">{text}</p>
  }
  return (
    <ul className="m-0 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
      {sentences.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  )
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
  const screeningHintParts = splitIntoSentences(screening.hint)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[min(90dvh,760px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl',
          'flex flex-col'
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-left text-base leading-snug sm:text-lg">Why this fit score</DialogTitle>
          <DialogDescription className={roleLine ? 'text-left text-xs sm:text-sm' : 'sr-only'}>
            {roleLine || 'Fit score explanation for this job listing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <section className="mb-6 rounded-lg border border-border/80 bg-muted/30 p-4">
            <details className="group text-sm">
              <summary className="cursor-pointer list-none font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-2 group-open:underline">How first-pass screening often works</span>
              </summary>
              <div className="mt-3 space-y-2 text-muted-foreground">
                <p className="m-0 text-xs leading-relaxed">
                  Context only—your fit score is still computed from your saved profile and this posting.
                </p>
                <ul className="m-0 list-disc space-y-1.5 pl-4 leading-relaxed">
                  {ATS_BULLETS.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </details>
          </section>

          <section className="mb-6 space-y-3">
            <h3 className="m-0 text-sm font-semibold text-foreground">Fit score &amp; band</h3>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="m-0 text-xs font-medium text-muted-foreground">Fit score</p>
                <p className="m-0 text-2xl font-semibold tabular-nums text-foreground">{fit.score}%</p>
              </div>
              <div>
                <p className="m-0 text-xs font-medium text-muted-foreground">Fit band</p>
                <p className="m-0 text-sm text-foreground">{LABEL_COPY[fit.label]}</p>
              </div>
            </div>
            <SummaryBlock text={fit.summary} />
            <p className="m-0 text-xs text-muted-foreground">
              Estimate only, from your saved profile and this posting—not a prediction of outcome.
            </p>
            <div className="rounded-md border border-border bg-card px-3 py-2.5">
              <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                First-pass estimate
              </h4>
              <p className="m-0 mt-1 text-sm font-medium text-foreground">{screening.title}</p>
              {screeningHintParts.length <= 1 ? (
                <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">{screening.hint}</p>
              ) : (
                <ul className="m-0 mt-1 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground">
                  {screeningHintParts.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
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
              <h3 className="mb-2 text-sm font-semibold text-foreground">What drives this score</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {fit.factors.map((f, i) => (
                  <li
                    key={i}
                    className={cn(
                      'rounded-md border border-transparent border-l-4 py-2 pl-3 pr-2 text-sm leading-relaxed',
                      sentimentStyles(f.sentiment)
                    )}
                  >
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-foreground">
                      {CATEGORY_LABEL[f.category]}
                    </p>
                    <p className="m-0 mt-1 text-muted-foreground">{f.detail}</p>
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
                Open Profile
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
