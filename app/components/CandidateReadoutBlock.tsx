'use client'

import type { ReactNode } from 'react'
import type { ResumeData } from '@/lib/profile'
import type { CandidateReadoutTag } from '@/lib/jobs/candidateReadout'
import { archetypeLabel, type ArchetypeSlug } from '@/lib/jobs/archetypeTaxonomy'
import { evidencePathToLabel } from '@/lib/readoutEvidenceLabels'

export type ReadoutDisplayModel = {
  generated_at: string
  primary_archetype: ArchetypeSlug | null
  secondary_archetypes: ArchetypeSlug[]
  tags: CandidateReadoutTag[]
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function CandidateReadoutBlock({
  heading,
  hint,
  readout,
  readoutStale,
  profileData,
  emptyMessage,
  extraAfterTags,
  embedded,
}: {
  heading: string
  hint?: string
  readout: ReadoutDisplayModel | null
  readoutStale: boolean
  profileData: ResumeData | null
  emptyMessage?: string
  extraAfterTags?: ReactNode
  /** Omit top rule when nested inside another panel. */
  embedded?: boolean
}) {
  const wrapClass = embedded
    ? 'candidate-readout space-y-3 pt-2'
    : 'candidate-readout mt-6 space-y-3 border-t border-border pt-5'

  return (
    <div className={wrapClass}>
      {(heading || hint) && (
        <div>
          {heading ? <h3 className="m-0 text-sm font-semibold text-foreground">{heading}</h3> : null}
          {hint ? <p className="panel-subtitle m-0 mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
      )}

      {readoutStale && readout && (
        <p className="m-0 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          Your profile changed since this readout was generated. Regenerate your target profile to refresh.
        </p>
      )}

      {!readout && emptyMessage && (
        <p className="m-0 text-sm text-muted-foreground">{emptyMessage}</p>
      )}

      {readout && (
        <>
          <p className="m-0 text-xs text-muted-foreground">Based on data as of {formatGeneratedAt(readout.generated_at)}</p>

          <div className="flex flex-wrap gap-2">
            {readout.primary_archetype ? (
              <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
                {archetypeLabel(readout.primary_archetype)}
                <span className="ml-1.5 text-muted-foreground">(primary)</span>
              </span>
            ) : null}
            {readout.secondary_archetypes.map((slug) => (
              <span
                key={slug}
                className="rounded-full border border-border bg-muted/25 px-2.5 py-1 text-xs text-foreground/90"
              >
                {archetypeLabel(slug)}
              </span>
            ))}
          </div>

          {readout.tags.length > 0 && (
            <ul className="m-0 list-none space-y-3 p-0">
              {readout.tags.map((t) => (
                <li key={t.id} className="rounded-lg border border-border/80 bg-card/30 px-3 py-2.5 text-sm">
                  <div className="font-medium text-foreground">{t.label}</div>
                  <p className="mt-1 m-0 leading-relaxed text-muted-foreground">{t.rationale}</p>
                  <p className="mt-1.5 m-0 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Evidence: </span>
                    {t.evidence_paths.map((p, i) => (
                      <span key={p + i}>
                        {i > 0 ? ' · ' : ''}
                        {evidencePathToLabel(p, profileData ?? undefined)}
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {extraAfterTags}
        </>
      )}
    </div>
  )
}
