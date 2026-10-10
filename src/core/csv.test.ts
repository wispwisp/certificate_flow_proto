import { expect, it } from 'vitest'
import { autoMap, buildRows, decodeCsv, parseCsv } from './csv'
import { defaultLabel } from './fields'
import { SAMPLE_FIELDS, sampleCsv } from './testing/samples'

// Encodes ASCII + Russian letters to windows-1251 for the fallback fixture.
const toCp1251 = (s: string) => Uint8Array.from([...s].map((ch) => {
  const c = ch.charCodeAt(0)
  if (c < 0x80) return c
  if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0
  if (ch === 'Ё') return 0xa8
  if (ch === 'ё') return 0xb8
  throw new Error(`no cp1251 byte for ${ch}`)
}))
const SHARED = { signer_position: 'Директор', signer_full_name: 'Иванов И. И.',
  manager_full_name: 'Петрова А. С.', manager_phone: '+7 (7172) 00-00-01' }
const FIELDS = SAMPLE_FIELDS
const settings = { fields: FIELDS, labels: Object.fromEntries(FIELDS.map((f) => [f, defaultLabel(f)])), optional: [] }

it('decodes UTF-8 and strips the BOM', () => expect(decodeCsv(sampleCsv()).startsWith('cert_number;')).toBe(true))
it('falls back to windows-1251', () => {
  const text = 'cert_number;student_full_name\r\n2026/0001;Ёлкина Мария Петровна\r\n'
  expect(decodeCsv(toCp1251(text))).toBe(text)
})
it('parses the sample: semicolons, quoted semicolon, Kazakh letters, empty cell', () => {
  const t = parseCsv(decodeCsv(sampleCsv()))
  expect(t.columns).toHaveLength(12)
  expect(t.columns[0]).toBe('cert_number')
  expect(t.rows).toHaveLength(8)
  expect(t.rows[4][2]).toBe('Сейтқали Әлихан Ерланұлы')
  expect(t.rows[5][11]).toBe('в ТОО «Пример»; отдел кадров')
  expect(t.rows[7][3]).toBe('')
})
it('skips trailing rows of empty cells exported by Excel', () =>
  expect(parseCsv(decodeCsv(sampleCsv()) + ';;;;;;;;;;;\r\n;;;;;;;;;;;\r\n').rows).toHaveLength(8))
it('throws a Russian error when there are no data rows', () =>
  expect(() => parseCsv('a;b\r\n')).toThrow('В CSV нет строк с данными'))
it('maps columns by name case-insensitively, ignoring spaces and extra columns', () =>
  expect(autoMap(['student_full_name', 'birth_date', 'signer_position'], [' Student_Full_Name ', 'BIRTH_DATE', 'extra']))
    .toEqual({ student_full_name: ' Student_Full_Name ', birth_date: 'BIRTH_DATE', signer_position: null }))
it('builds the sample rows: row 8 is missing its birth date', () => {
  const t = parseCsv(decodeCsv(sampleCsv()))
  const rows = buildRows(t, autoMap(FIELDS, t.columns), SHARED, settings)
  expect(rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  expect(rows[7].problems).toEqual(['Не заполнено: Дата рождения'])
  expect(rows.slice(0, 7).every((r) => r.problems.length === 0)).toBe(true)
  expect(rows[0].values.student_full_name).toBe('Ахметов Данияр Серикович')
  expect(rows[0].values.signer_full_name).toBe('Иванов И. И.')
})
it('an empty shared value invalidates every row', () => {
  const t = parseCsv(decodeCsv(sampleCsv()))
  const rows = buildRows(t, autoMap(FIELDS, t.columns), { ...SHARED, signer_position: '' }, settings)
  expect(rows[0].problems).toEqual(['Не заполнено: Должность подписанта'])
  expect(rows[7].problems).toEqual(['Не заполнено: Дата рождения, Должность подписанта'])
})
it('normalizes CSV dates and flags unknown formats', () => {
  const t = { columns: ['birth_date'], rows: [['2008-03-14'], ['14/03/2008']] }
  const s = { fields: ['birth_date'], labels: { birth_date: 'Дата рождения' }, optional: [] }
  const rows = buildRows(t, { birth_date: 'birth_date' }, {}, s)
  expect(rows[0].values.birth_date).toBe('14.03.2008')
  expect(rows[1].problems).toEqual(['Дата рождения: непонятный формат «14/03/2008», нужно ДД.ММ.ГГГГ'])
})
