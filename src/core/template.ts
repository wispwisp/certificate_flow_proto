import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { checkZip } from './zipGuard'

export type TemplateInspection = { fields: string[]; warnings: string[]; errors: string[] }

const OPTIONS = {
  delimiters: { start: '{{', end: '}}' },
  paragraphLoop: true,
  linebreaks: true,
  parser: (tag: string) => ({ get: (scope: Record<string, string>) => scope[tag.trim()] }),
  nullGetter: () => '',
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const BLOCKS_WARNING = 'Демо не обрабатывает блоки {% … %}; они останутся в документе как текст'

const EXPLANATIONS: Record<string, string> = {
  unclosed_tag: 'не хватает «}}»',
  unopened_tag: 'лишние «}}» без «{{»',
  duplicate_open_tag: 'два «{{» подряд',
  duplicate_close_tag: 'два «}}» подряд',
}

const sortParts = (names: string[]) => names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

function partLabel(file: string): string {
  if (file.startsWith('word/header')) return 'верхний колонтитул'
  if (file.startsWith('word/footer')) return 'нижний колонтитул'
  return 'основной текст'
}

type TagError = { properties: { id?: string; file?: string; context?: string; xtag?: string } }

function describeError(error: TagError): string {
  const { id, file = 'word/document.xml', context, xtag } = error.properties
  const near = (context ?? xtag ?? '').slice(0, 60)
  return `«${partLabel(file)}»: …${near}… — ${EXPLANATIONS[id ?? ''] ?? 'ошибка в теге'}`
}

function collectTags(doc: Docxtemplater, zip: PizZip): Pick<TemplateInspection, 'fields' | 'warnings'> {
  const result = { fields: [] as string[], warnings: [] as string[] }
  const compiled = Object.keys((doc as unknown as { compiled: object }).compiled)
  const names = (pattern: RegExp) => sortParts(zip.file(pattern).map((f) => f.name).filter((n) => compiled.includes(n)))
  const parts = ['word/document.xml', ...names(/^word\/header[^/]*\.xml$/), ...names(/^word\/footer[^/]*\.xml$/)]
  const badTags = new Set<string>()
  for (const part of parts) {
    const text = doc.getFullText(part)
    if (/\{[%#]/.test(text) && !result.warnings.includes(BLOCKS_WARNING)) result.warnings.push(BLOCKS_WARNING)
    for (const match of text.matchAll(/\{\{(.*?)\}\}/g)) {
      const inner = match[1].trim()
      if (NAME.test(inner)) {
        if (!result.fields.includes(inner)) result.fields.push(inner)
      } else if (!badTags.has(match[0])) {
        badTags.add(match[0])
        result.warnings.push(`Тег ${match[0]} не поддерживается в демо и будет пустым`)
      }
    }
  }
  return result
}

export function inspectTemplate(bytes: Uint8Array): TemplateInspection {
  const result: TemplateInspection = { fields: [], warnings: [], errors: [] }
  const zipError = checkZip(bytes)
  if (zipError) return { ...result, errors: [zipError] }

  try {
    const zip = new PizZip(bytes)
    const doc = new Docxtemplater(zip, OPTIONS)
    return { ...result, ...collectTags(doc, zip) }
  } catch (error) {
    const tagErrors = (error as { properties?: { errors?: TagError[] } }).properties?.errors
    result.errors = tagErrors
      ? tagErrors.map(describeError)
      : [`Не удалось разобрать шаблон: ${(error as Error).message}`]
    return result
  }
}

export function fillTemplate(bytes: Uint8Array, values: Record<string, string>): Uint8Array {
  const doc = new Docxtemplater(new PizZip(bytes), OPTIONS)
  doc.render(values)
  return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' })
}
