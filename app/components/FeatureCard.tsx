'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { cn } from '@/lib/utils'

export interface FeatureCardProps {
  icon: React.ElementType
  title: string
  description: string
  onClick: () => void
  badge?: number
  className?: string
}

export function FeatureCard({ icon: Icon, title, description, onClick, badge, className }: FeatureCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className={cn(
        'group cursor-pointer rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-200 ease-out',
        'hover:bg-accent/50 hover:border-accent/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:-translate-y-0.5',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div className="rounded-md bg-muted p-2 shrink-0 transition-colors duration-200 group-hover:bg-primary/10">
          <Icon className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            {badge != null && badge > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-amber-500/90 text-[10px] font-semibold text-black"
                aria-label={`${badge} incomplete`}
              >
                {badge}
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-sm line-clamp-2">{description}</CardDescription>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </CardHeader>
    </Card>
  )
}
