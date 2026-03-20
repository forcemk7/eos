'use client'

import { useMemo } from 'react'
import { sankey as d3Sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey'
import type { SankeyNode, SankeyLink } from 'd3-sankey'
import type { JobListingRow } from '@/lib/jobs/jobListingRow'
import { buildSankeyGraph } from '@/lib/jobs/sankeyPipeline'

type StageNode = SankeyNode<Record<string, unknown>, Record<string, unknown>> & {
  stageKey: string
  label: string
  fill: string
}

type StageLink = SankeyLink<Record<string, unknown>, Record<string, unknown>>

export function ApplicationPipelineChart({
  listings,
  onStageSelect,
  selectedStage,
  className,
}: {
  listings: JobListingRow[]
  onStageSelect: (stageKey: string) => void
  selectedStage: string | null
  className?: string
}) {
  const { layout, nodes, links } = useMemo(() => {
    if (listings.length === 0) {
      return { layout: null as ReturnType<ReturnType<typeof d3Sankey>> | null, nodes: [] as StageNode[], links: [] as StageLink[] }
    }

    const { nodes: rawNodes, links: rawLinks } = buildSankeyGraph(listings)
    if (rawLinks.length === 0) {
      return { layout: null, nodes: rawNodes as StageNode[], links: [] as StageLink[] }
    }

    const w = 920
    const h = 340
    const sankey = d3Sankey<Record<string, unknown>, Record<string, unknown>>()
      .nodeAlign(sankeyLeft)
      .nodeWidth(14)
      .nodePadding(10)
      .extent([
        [8, 6],
        [w - 8, h - 6],
      ])

    const graph = sankey({
      nodes: rawNodes.map((d) => ({ ...d })),
      links: rawLinks.map((d) => ({ ...d })),
    })

    return {
      layout: graph,
      nodes: graph.nodes as StageNode[],
      links: graph.links as StageLink[],
    }
  }, [listings])

  if (listings.length === 0 || !layout || links.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">Log applications to see the pipeline chart.</p>
      </div>
    )
  }

  const linkPath = sankeyLinkHorizontal()

  return (
    <div className={className}>
      <svg
        viewBox="0 0 920 340"
        className="h-auto w-full max-w-full text-foreground"
        role="img"
        aria-label="Application pipeline flow by stage"
      >
        <g className="text-muted-foreground">
          {links.map((link, i) => {
            const path = linkPath(link as Parameters<typeof linkPath>[0])
            if (!path) return null
            const t = link.target as StageNode
            const fill = t?.fill ?? '#94a3b8'
            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke={fill}
                strokeOpacity={0.35}
                strokeWidth={Math.max(1, link.width ?? 1)}
                className="pointer-events-none"
              />
            )
          })}
        </g>
        {nodes.map((node) => {
          const { x0, x1, y0, y1, stageKey, label, fill } = node
          if (x0 == null || x1 == null || y0 == null || y1 == null) return null
          const h = Math.max(y1 - y0, 2)
          const w = Math.max(x1 - x0, 2)
          const selected = selectedStage === stageKey
          const dim = selectedStage != null && !selected && stageKey !== '__root__'
          return (
            <g key={stageKey} opacity={dim ? 0.35 : 1} className="transition-opacity">
              <title>{`${label}: ${node.value ?? ''}`}</title>
              <rect
                x={x0}
                y={y0}
                width={w}
                height={h}
                rx={3}
                fill={fill}
                className="cursor-pointer stroke-background/80 stroke-2"
                onClick={() => {
                  if (stageKey === '__root__') return
                  onStageSelect(stageKey)
                }}
                onKeyDown={(e) => {
                  if (stageKey === '__root__') return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onStageSelect(stageKey)
                  }
                }}
                tabIndex={stageKey === '__root__' ? -1 : 0}
                role="button"
                aria-pressed={selected}
                aria-label={`${label}, ${node.value ?? 0} roles. Activate to filter list.`}
              />
              <text
                x={x0 < 400 ? x1 + 6 : x0 - 6}
                y={(y0 + y1) / 2}
                dy="0.35em"
                textAnchor={x0 < 400 ? 'start' : 'end'}
                className="fill-foreground text-[11px] font-medium pointer-events-none"
                style={{ fontSize: 11 }}
              >
                {label}
                <tspan className="fill-muted-foreground font-normal"> ({node.value})</tspan>
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Click a stage to filter roles below. Progress stages use teal, rejections rose, no reply slate, unset amber.
      </p>
    </div>
  )
}
