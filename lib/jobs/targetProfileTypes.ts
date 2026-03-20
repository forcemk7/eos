/** Normalize role title / sector name for dismiss + pin keys (stable across generations). */
export function normalizeTargetKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}
