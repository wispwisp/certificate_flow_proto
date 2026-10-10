import Papa from 'papaparse'
import { ownValue, prepareValues, type FieldSettings } from './fields'

export type CsvTable = { columns: string[]; rows: string[][] }
export type Mapping = Record<string, string | null>
export type CsvRow = { number: number; values: Record<string, string>; problems: string[] }

const SIGNATURES = [[0x50, 0x4b, 0x03, 0x04], [0xd0, 0xcf, 0x11, 0xe0]] // ZIP (.xlsx, .ods), OLE (.xls)

/** A spreadsheet workbook dropped instead of a CSV gets a how-to-save message; a CSV gets null. */
export function spreadsheetError(fileName: string, bytes: Uint8Array): string | null {
  const workbook = /\.(xlsx?|ods)$/i.test(fileName) || SIGNATURES.some((sig) => sig.every((b, i) => bytes[i] === b))
  return workbook ? 'Сохраните таблицу в формате CSV: Файл → Сохранить как → CSV UTF-8' : null
}

export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1251').decode(bytes)
  }
}

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, '')
  const parsed = Papa.parse<string[]>(clean, { header: false, delimiter: '', skipEmptyLines: 'greedy' })
  const [head, ...data] = parsed.data
  if (!head || data.length === 0) throw new Error('В CSV нет строк с данными')
  const columns = head.map((c) => c.trim())
  const rows = data.map((row) => columns.map((_, i) => row[i] ?? ''))
  return { columns, rows }
}

export function autoMap(fields: string[], columns: string[]): Mapping {
  const key = (s: string) => s.trim().toLowerCase()
  return Object.fromEntries(fields.map((f) => [f, columns.find((c) => key(c) === key(f)) ?? null]))
}

export function buildRows(
  table: CsvTable,
  mapping: Mapping,
  shared: Record<string, string>,
  settings: FieldSettings,
): CsvRow[] {
  return table.rows.map((cells, i) => {
    const raw: Record<string, string> = {}
    for (const field of settings.fields) {
      const column = mapping[field]
      raw[field] = column == null ? (ownValue(shared, field) ?? '') : (cells[table.columns.indexOf(column)] ?? '')
    }
    const { values, problems } = prepareValues(settings, raw)
    return { number: i + 1, values, problems }
  })
}
