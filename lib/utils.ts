import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Split prose into sentences for scannable bullet UI (English-oriented). */
export function splitIntoSentences(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  return t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
