import type { ResumeData } from '@/lib/profile'

/** Map dot-paths from the readout model to short UI labels; optional data enriches experience lines. */
export function evidencePathToLabel(path: string, data?: ResumeData | null): string {
  const p = path.trim()
  if (!p) return path

  if (p === 'summary') return 'Summary'
  if (p === 'skills') return 'Skills'
  if (p === 'languages') return 'Languages'

  if (p.startsWith('identity.')) {
    const tail = p.slice('identity.'.length)
    if (tail === 'name') return 'Contact — name'
    if (tail === 'email') return 'Contact — email'
    if (tail === 'phone') return 'Contact — phone'
    if (tail === 'location') return 'Contact — location'
    return `Contact — ${tail}`
  }

  const exp = /^experience\.(\d+)\.(.+)$/.exec(p)
  if (exp) {
    const i = parseInt(exp[1], 10)
    const sub = exp[2]
    const e = data?.experience?.[i]
    const role = e ? `${e.title || 'Role'}${e.company ? ` at ${e.company}` : ''}` : `Experience #${i + 1}`
    if (sub === 'title') return `${role} (title)`
    if (sub === 'company') return `${role} (company)`
    if (sub === 'dates') return `${role} (dates)`
    if (sub === 'bullets') return `${role} (bullets)`
    return `${role} (${sub})`
  }

  const edu = /^education\.(\d+)\.(.+)$/.exec(p)
  if (edu) {
    const i = parseInt(edu[1], 10)
    const sub = edu[2]
    const e = data?.education?.[i]
    const label = e?.institution || e?.degree || `Education #${i + 1}`
    return `${label} (${sub})`
  }

  const ach = /^achievements\.(\d+)\.(.+)$/.exec(p)
  if (ach) {
    const i = parseInt(ach[1], 10)
    const sub = ach[2]
    const a = data?.achievements?.[i]
    return `${a?.title || `Achievement #${i + 1}`} (${sub})`
  }

  const add = /^additional\.(\d+)\.title$/.exec(p)
  if (add) {
    const i = parseInt(add[1], 10)
    const s = data?.additional?.[i]
    return s?.title ? `Additional — ${s.title}` : `Additional section #${i + 1}`
  }

  return p
}
