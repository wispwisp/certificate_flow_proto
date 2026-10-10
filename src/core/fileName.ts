import { ownValue } from './fields'

export const DEFAULT_PATTERN = '{cert_number}_{student_full_name}.pdf'

export function sanitizeFileName(name: string): string {
  const clean = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
    .replace(/[. ]+$/, '')
  return clean || 'document'
}

const PLACEHOLDER = /\{([^{}]+)\}/g

export function unknownPlaceholders(pattern: string, fields: string[]): string[] {
  const names = [...pattern.matchAll(PLACEHOLDER)].map((m) => m[1])
  return [...new Set(names)].filter((n) => !fields.includes(n))
}

export function fileNameFor(pattern: string, values: Record<string, string>, ext: '.pdf' | '.docx'): string {
  const base = pattern.replace(/\.pdf$/i, '').replace(PLACEHOLDER, (_, name) => ownValue(values, name) ?? '')
  return sanitizeFileName(base) + ext
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const key = name.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count === 1) return name
    const dot = name.lastIndexOf('.')
    const base = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    return `${base} (${count})${ext}`
  })
}
