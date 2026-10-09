# Certificate Generator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, browser-only demo that turns a DOCX template with `{{ field }}` tags plus a form or a CSV into PDF
certificates (one PDF, a ZIP, or one merged PDF), deployable to GitHub Pages under a subpath.

**Architecture:** `src/core/` is plain TypeScript (template inspection and filling, CSV, file names, batch, PDF engine)
tested with Vitest in Node; the browser-only parts (`renderDocx`, the raster PDF engine) are checked in a real browser.
`src/ui/` is React: `App` owns all state and passes it to a header, three step panels and a `Sheet` that renders the
document with docx-preview. All CSS (including inlined fonts) and the demo files live inside the JS bundle, so nothing
is requested after page load.

**Tech Stack:** Vite 8, TypeScript (strict), React 19, plain CSS, docxtemplater + pizzip, docx-preview, html2canvas +
jspdf, jszip, papaparse, @fontsource tinos/arimo/carlito, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-certificate-generator-mvp-design.md` (read it first; section numbers below
refer to it).

## Global Constraints

- Static SPA only; no backend, no serverless. Vite `base: './'`; no path-based router.
- No network requests after the `load` event. No CDN, analytics, telemetry or third-party embeds.
- Production build CSP meta tag, build only:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
- One JS bundle in our code: no dynamic `import()` in `src/` (outside verification snippets run from the browser).
- No `<link rel="stylesheet">` in the built `index.html`: CSS is imported with `?inline` and injected as `<style>`.
  Reason: html2canvas clones the document into an iframe, and a cloned stylesheet link would be fetched again.
- Favicon is `<link rel="icon" href="data:,">` (a real favicon is fetched after load).
- UI text in Russian; code, comments, commit messages and README in English.
- Library versions: docxtemplater 3.71, pizzip 3.3, docx-preview 0.4, html2canvas 1.4, jspdf 4.2, jszip 3.10,
  papaparse 5.7, @fontsource/tinos|arimo|carlito 5.3. Replacing any requires asking the user first.
- Upload limit 10 MB; DOCX ZIP limits: ≤ 1000 entries, ≤ 50 MB total uncompressed.
- Never `dangerouslySetInnerHTML`; CSV values reach the page only as React text.
- Commits: one per milestone (end of Tasks 5, 9, 10, 11), on branch `mvp`, author and attribution:
  `git -c user.name=wisp -c user.email=forworkandtravel@yandex.ru commit -m "<msg>

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
- Browser checks follow CLAUDE.md: playwright MCP is headless; `browser_navigate` → `browser_snapshot` → exercise →
  `browser_console_messages` level `error` empty → screenshots only into `.playwright-mcp/`, inspected with Read →
  `browser_close`. Dev server: `npm run dev` on http://localhost:5173 as a background task, poll until 200.
- Do not touch `build_claudecode_isolation_container.sh`, `run_claudecode_isolation_container.sh`,
  `claudecode.dockerfile`, `check_grammar.sh`, `claude_code_prompt_mvp.md`.

## Review Focus

1. Excel exports trailing rows of only delimiters (`;;;;;;;;;;;`) for formatted-but-empty rows: they must be skipped,
   not listed as invalid students. Test: Task 3 `skips trailing rows of empty cells exported by Excel`.
2. CSV headers typed by hand differ in case or carry stray spaces (` Student_Full_Name `): they must still map.
   Test: Task 3 `maps columns by name case-insensitively, ignoring spaces and extra columns`.
3. Values with XML special characters (`ТОО «А&Б» <отдел>`) must appear literally and leave a valid DOCX.
   Test: Task 2 `escapes XML special characters in values`.
4. Tags placed in a page header (the sample's header has none) must be discovered, after the body's fields.
   Test: Task 2 `discovers tags in headers after body fields`.
5. Kazakh and Cyrillic letters in file names (row 5) must survive sanitizing and come out of the ZIP intact.
   Tests: Task 4 `keeps Cyrillic and Kazakh letters` and `zip entry names keep Cyrillic and Kazakh letters`.

---

## Milestone 1: core modules

### Task 1: Scaffold and field rules

**Files:**
- Create: `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`
  (from create-vite), `src/ui/App.tsx` (placeholder), `src/core/fields.ts`
- Move: `spravka_ob_obuchenii_template.docx`, `students_demo.csv` → `src/samples/`
- Modify: `.gitignore`
- Test: `src/core/fields.test.ts`

**Interfaces:**
- Produces:
  - `FIELD_LABELS: Record<string, string>` (spec §5 table, exact strings)
  - `defaultLabel(field: string): string`
  - `isDateField(field: string): boolean` — `/_date$/`
  - `normalizeDate(input: string): string | null` — accepts `D.M.YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`; returns
    `DD.MM.YYYY` for a real calendar date, else `null`
  - `type FieldSettings = { fields: string[]; labels: Record<string, string>; optional: string[] }`
  - `prepareValues(settings: FieldSettings, raw: Record<string, string>): { values: Record<string, string>; problems: string[] }`
  - npm scripts: `dev`, `build`, `test` (`vitest run`)

- [ ] **Step 1: Scaffold.** In the scratchpad run `npm create vite@9.2.1 scaffold -- --template react-ts` (if it
  offers to install and start the app, decline). Copy into the repo root: `package.json`, `tsconfig.json`, `tsconfig.app.json`,
  `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts` (if present). Drop the demo
  assets, `App.css`, `index.css`, `public/vite.svg` and the ESLint config and its devDependencies. Set package `name`
  to `certificate-flow-proto`. Move `src/App.tsx` to `src/ui/App.tsx` rendering `<p>Загрузка…</p>`; fix the import in
  `main.tsx`.
- [ ] **Step 2: Install.**
  `npm i docxtemplater@3.71 pizzip@3.3 docx-preview@0.4 html2canvas@1.4 jspdf@4.2 jszip@3.10 papaparse@5.7 @fontsource/tinos@5.3 @fontsource/arimo@5.3 @fontsource/carlito@5.3`
  and `npm i -D vitest@5 @types/papaparse @types/node@22 @playwright/test@1.64`.
- [ ] **Step 3: Configure `vite.config.ts`.** Add `/// <reference types="vitest/config" />`; `base: './'`;
  `assetsInclude: ['**/*.docx', '**/*.csv']`;
  `build: { modulePreload: { polyfill: false }, assetsInlineLimit: (file) => (file.endsWith('.woff2') ? true : undefined) }`;
  `test: { environment: 'node', include: ['src/**/*.test.ts'] }`; and an inline plugin
  `{ name: 'csp', apply: 'build', transformIndexHtml: (html) => html.replace('<head>', '<head>\n    <meta http-equiv="Content-Security-Policy" content="…">') }`
  with the CSP string from Global Constraints.
- [ ] **Step 4: Edit `index.html`:** `lang="ru"`, `<title>Генератор справок — демо</title>`,
  favicon `<link rel="icon" href="data:,">`. Append `node_modules/`, `dist/`, `test-results/`, `playwright-report/`,
  `.playwright-mcp/` to `.gitignore`. Move the two sample files into `src/samples/`.
- [ ] **Step 5: Write the failing test** `src/core/fields.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { defaultLabel, isDateField, normalizeDate, prepareValues } from './fields'

const settings = {
  fields: ['student_full_name', 'birth_date', 'group_name', 'note'],
  labels: { student_full_name: 'ФИО слушателя', birth_date: 'Дата рождения', group_name: 'Группа', note: 'note' },
  optional: ['note'],
}

describe('fields', () => {
  it('labels known fields and falls back to the raw name', () => {
    expect(defaultLabel('student_full_name')).toBe('ФИО слушателя')
    expect(defaultLabel('manager_phone')).toBe('Телефон исполнителя')
    expect(defaultLabel('custom_field')).toBe('custom_field')
  })
  it('detects date fields by the _date suffix', () => {
    expect(isDateField('birth_date')).toBe(true)
    expect(isDateField('date_of_birth')).toBe(false)
  })
  it('normalizes accepted date formats to DD.MM.YYYY', () => {
    expect(normalizeDate('14.03.2008')).toBe('14.03.2008')
    expect(normalizeDate('4.3.2008')).toBe('04.03.2008')
    expect(normalizeDate('2008-03-14')).toBe('14.03.2008')
  })
  it('rejects unknown formats and impossible dates', () => {
    expect(normalizeDate('14/03/2008')).toBeNull()
    expect(normalizeDate('31.02.2026')).toBeNull()
    expect(normalizeDate('2026-13-01')).toBeNull()
  })
  it('trims values, formats dates and reports empty required fields', () => {
    const r = prepareValues(settings, { student_full_name: '  Ким Алина ', birth_date: '2007-11-27', group_name: ' ' })
    expect(r.values).toEqual({ student_full_name: 'Ким Алина', birth_date: '27.11.2007', group_name: '', note: '' })
    expect(r.problems).toEqual(['Не заполнено: Группа'])
  })
  it('combines empty fields into one problem, then lists bad dates', () => {
    expect(prepareValues(settings, {}).problems).toEqual(['Не заполнено: ФИО слушателя, Дата рождения, Группа'])
    const bad = prepareValues(settings, { student_full_name: 'Ким', birth_date: '27/11/2007', group_name: 'РПО-241' })
    expect(bad.problems).toEqual(['Дата рождения: непонятный формат «27/11/2007», нужно ДД.ММ.ГГГГ'])
    expect(bad.values.birth_date).toBe('27/11/2007')
  })
})
```

- [ ] **Step 6: Run** `npx vitest run src/core/fields.test.ts`. Expected: FAIL, cannot resolve `./fields`.
- [ ] **Step 7: Implement `src/core/fields.ts`** with the Interfaces above. `prepareValues` iterates
  `settings.fields` in order; a missing key counts as `''`; empty required labels are joined with `, ` into one
  `Не заполнено: …` problem placed first; then one format problem per bad non-empty date; a bad date keeps its raw
  trimmed value.
- [ ] **Step 8: Verify.** `npm test` → all 6 pass. `npm run build` succeeds and
  `grep -c 'Content-Security-Policy' dist/index.html` prints `1`.

### Task 2: ZIP guard and template inspection/filling

**Files:**
- Create: `src/core/zipGuard.ts`, `src/core/template.ts`, `src/core/testing/samples.ts`, `src/core/testing/makeDocx.ts`
- Test: `src/core/zipGuard.test.ts`, `src/core/template.test.ts`

**Interfaces:**
- Produces:
  - `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`, `uploadSizeError(size: number): string | null`
    → `'Файл больше 10 МБ — демо принимает файлы до 10 МБ'`
  - `checkZip(bytes: Uint8Array): string | null` → `null`, `'Это не файл Word (.docx)'` (not a ZIP, or no
    `word/document.xml`), or `'Файл слишком сложный для демо: больше 1000 частей или больше 50 МБ после распаковки'`
  - `type TemplateInspection = { fields: string[]; warnings: string[]; errors: string[] }`
  - `inspectTemplate(bytes: Uint8Array): TemplateInspection` (never throws)
  - `fillTemplate(bytes: Uint8Array, values: Record<string, string>): Uint8Array` (values already prepared)
  - test helpers in `src/core/testing/samples.ts`: `sampleDocx(): Uint8Array`, `sampleCsv(): Uint8Array` (read
    `src/samples/*` with `fs`), `SAMPLE_FIELDS: string[]` (the 16 fields in order, listed in Step 2); in
    `src/core/testing/makeDocx.ts`: `makeDocx(parts: { body: string[]; header?: string[]; footer?: string[] }): Uint8Array`

- [ ] **Step 1: Write the test helpers.** `makeDocx` starts from `sampleDocx()` with PizZip and replaces
  `word/document.xml` with `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>{paras}{sectPr}</w:body></w:document>`
  (the `<w:sectPr>…</w:sectPr>` copied from the sample so header/footer references survive), `word/header1.xml` with
  `<w:hdr xmlns:w="(same)">{paras}</w:hdr>` and `word/footer1.xml` with `<w:ftr xmlns:w="(same)">{paras}</w:ftr>` (empty arrays by default,
  rendered as one empty `<w:p/>`). Each text becomes
  `<w:p><w:r><w:t xml:space="preserve">{xml-escaped text}</w:t></w:r></w:p>`.
- [ ] **Step 2: Write the failing tests.** `src/core/zipGuard.test.ts`:

```ts
it('accepts the sample template', () => expect(checkZip(sampleDocx())).toBeNull())
it('rejects bytes that are not a ZIP', () =>
  expect(checkZip(new TextEncoder().encode('not a zip'))).toBe('Это не файл Word (.docx)'))
it('rejects a ZIP without word/document.xml', () => {
  const zip = new PizZip(); zip.file('a.txt', 'x')
  expect(checkZip(zip.generate({ type: 'uint8array' }))).toBe('Это не файл Word (.docx)')
})
it('rejects more than 1000 entries', () => {
  const zip = new PizZip(); zip.file('word/document.xml', '<x/>')
  for (let i = 0; i < 1000; i++) zip.file(`f${i}.txt`, '')
  expect(checkZip(zip.generate({ type: 'uint8array' }))).toMatch(/слишком сложный/)
})
it('rejects more than 50 MB uncompressed', () => {
  const zip = new PizZip(); zip.file('word/document.xml', new Uint8Array(51 * 1024 * 1024))
  expect(checkZip(zip.generate({ type: 'uint8array', compression: 'DEFLATE' }))).toMatch(/слишком сложный/)
})
it('limits uploads to 10 MB', () => {
  expect(uploadSizeError(10 * 1024 * 1024)).toBeNull()
  expect(uploadSizeError(10 * 1024 * 1024 + 1)).toBe('Файл больше 10 МБ — демо принимает файлы до 10 МБ')
})
```

  `src/core/template.test.ts`:

```ts
// SAMPLE_FIELDS lives in testing/samples.ts:
export const SAMPLE_FIELDS = ['cert_number', 'issue_date', 'student_full_name', 'birth_date', 'program_name', 'group_name',
  'study_form', 'study_start_date', 'study_end_date', 'study_duration', 'hours_per_week', 'destination',
  'signer_position', 'signer_full_name', 'manager_full_name', 'manager_phone']
const docXml = (bytes: Uint8Array) => new PizZip(bytes).file('word/document.xml')!.asText()

it('the sample stores student_full_name split across runs', () =>
  expect(docXml(sampleDocx())).not.toContain('student_full_name'))
it('discovers all 16 sample fields in order of first appearance', () =>
  expect(inspectTemplate(sampleDocx())).toEqual({ fields: SAMPLE_FIELDS, warnings: [], errors: [] }))
it('discovers tags in headers after body fields', () =>
  expect(inspectTemplate(makeDocx({ body: ['{{ a }}'], header: ['{{b}} {{ a }}'] })).fields).toEqual(['a', 'b']))
it('warns about Jinja blocks', () => {
  const r = inspectTemplate(makeDocx({ body: ['{% if x %}', '{{ a }}', '{% endif %}'] }))
  expect(r).toEqual({ fields: ['a'], errors: [],
    warnings: ['Демо не обрабатывает блоки {% … %}; они останутся в документе как текст'] })
})
it('warns about tags that are not plain names', () => {
  const r = inspectTemplate(makeDocx({ body: ['{{ name|upper }}'] }))
  expect(r).toEqual({ fields: [], errors: [], warnings: ['Тег {{ name|upper }} не поддерживается в демо и будет пустым'] })
})
it('reports an unclosed tag in Russian with its part and context', () => {
  const r = inspectTemplate(makeDocx({ body: ['Настоящая справка подтверждает, что {{ student_full_name, дата рождения'] }))
  expect(r.errors).toHaveLength(1)
  expect(r.errors[0]).toContain('основной текст')
  expect(r.errors[0]).toContain('не хватает «}}»')
  expect(r.errors[0]).toContain('student_full_name')
})
it('reports a file that is not a DOCX', () =>
  expect(inspectTemplate(new TextEncoder().encode('x'))).toEqual({ fields: [], warnings: [], errors: ['Это не файл Word (.docx)'] }))
it('fills body, tables and footer', () => {
  const values = Object.fromEntries(SAMPLE_FIELDS.map((f) => [f, `v_${f}`]))
  const out = fillTemplate(sampleDocx(), { ...values, student_full_name: 'Ахметов Данияр Серикович' })
  const zip = new PizZip(out)
  expect(zip.file('word/document.xml')!.asText()).toContain('Ахметов Данияр Серикович')
  expect(zip.file('word/document.xml')!.asText()).toContain('v_group_name')
  expect(zip.file('word/footer1.xml')!.asText()).toContain('v_manager_phone')
})
it('escapes XML special characters in values', () => {
  const out = fillTemplate(sampleDocx(), { student_full_name: 'ТОО «А&Б» <отдел>' })
  expect(docXml(out)).toContain('ТОО «А&amp;Б» &lt;отдел&gt;')
  expect(inspectTemplate(out).errors).toEqual([])
})
```

- [ ] **Step 3: Run** `npx vitest run src/core/zipGuard.test.ts src/core/template.test.ts`. Expected: FAIL, modules
  not found.
- [ ] **Step 4: Implement `checkZip`** by reading the ZIP directory without decompressing: find the end-of-central-
  directory signature `0x06054b50` scanning backwards from the end (at most 65 557 bytes); read entry count (u16 at
  +10), directory offset (u32 at +16); walk entries (signature `0x02014b50`): uncompressed size u32 at +24, name length
  u16 at +28, extra length at +30, comment length at +32, next entry at +46 + the three lengths. Any read out of range
  or bad signature → not a Word file. A size of `0xFFFFFFFF` (ZIP64) counts as too large. Require an entry named
  `word/document.xml`. Little-endian `DataView`.
- [ ] **Step 5: Implement `template.ts`.** `inspectTemplate`: `checkZip` first; then
  `new Docxtemplater(new PizZip(bytes), OPTIONS)` with the options from the brief (`{{`/`}}`, `paragraphLoop`,
  `linebreaks`, trimming parser, `nullGetter: () => ''`); on a throw with `properties.errors`, map each to a string
  `«{part}»: …{context}… — {explanation}`, where part is `основной текст` / `верхний колонтитул` /
  `нижний колонтитул` from `properties.file`, context is `properties.context ?? properties.xtag ?? ''` cut to 60 chars,
  and explanation is: `unclosed_tag` → `не хватает «}}»`, `unopened_tag` → `лишние «}}» без «{{»`,
  `duplicate_open_tag` → `два «{{» подряд`, `duplicate_close_tag` → `два «}}» подряд`, other → `ошибка в теге`.
  A non-multi error becomes one generic string with its message. Parts: `word/document.xml`, then
  `word/header*.xml` sorted with `localeCompare(…, undefined, { numeric: true })`, then `word/footer*.xml` the same.
  For each part's `getFullText`, match `/\{\{(.*?)\}\}/g`: inner trimmed text matching the name regex adds a field
  (dedupe, keep order); otherwise one warning per distinct tag text. `{%` or `{#` anywhere adds the blocks warning once.
  `fillTemplate`: same options, `doc.render(values)`, `doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' })`.
- [ ] **Step 6: Run** the two test files. Expected: PASS (15 tests).

### Task 3: CSV decoding, parsing, mapping and row validation

**Files:**
- Create: `src/core/csv.ts`
- Test: `src/core/csv.test.ts`

**Interfaces:**
- Consumes: `FieldSettings`, `prepareValues`, `defaultLabel` (Task 1); `sampleCsv()` (Task 2)
- Produces:
  - `decodeCsv(bytes: Uint8Array): string` — `TextDecoder('utf-8', { fatal: true })` (strips BOM), on throw
    `TextDecoder('windows-1251')`
  - `type CsvTable = { columns: string[]; rows: string[][] }` (columns trimmed; each row padded/truncated to columns)
  - `parseCsv(text: string): CsvTable` — PapaParse with `header: false`, `delimiter: ''` (auto),
    `skipEmptyLines: 'greedy'`; strips a leading `﻿`; first row = columns; throws
    `new Error('В CSV нет строк с данными')` when no data rows remain
  - `type Mapping = Record<string, string | null>` (field → column name, or `null` = shared value)
  - `autoMap(fields: string[], columns: string[]): Mapping` — first column whose trimmed lower-case name equals the
    field's lower-case name
  - `type CsvRow = { number: number; values: Record<string, string>; problems: string[] }` (`number` from 1)
  - `buildRows(table: CsvTable, mapping: Mapping, shared: Record<string, string>, settings: FieldSettings): CsvRow[]`
    — raw value per field is the mapped cell or `shared[field]`, then `prepareValues`

- [ ] **Step 1: Write the failing test** `src/core/csv.test.ts`:

```ts
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
```

- [ ] **Step 2: Run** `npx vitest run src/core/csv.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/core/csv.ts`** per the Interfaces.
- [ ] **Step 4: Run** the test file. Expected: PASS (9 tests).

### Task 4: File names, PdfEngine interface and batch generation

**Files:**
- Create: `src/core/fileName.ts`, `src/core/pdf/engine.ts`, `src/core/batch.ts`
- Test: `src/core/fileName.test.ts`, `src/core/batch.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_PATTERN = '{cert_number}_{student_full_name}.pdf'`
  - `sanitizeFileName(name: string): string` — `<>:"/\|?*` and `\x00-\x1F` → `_`; whitespace runs → one space;
    trim; strip trailing dots/spaces; cut to 150 chars; empty → `document`
  - `unknownPlaceholders(pattern: string, fields: string[]): string[]`
  - `fileNameFor(pattern: string, values: Record<string, string>, ext: '.pdf' | '.docx'): string` — drops a trailing
    `.pdf` (any case) from the pattern, replaces `{name}` with the value (unknown → `''`), sanitizes, appends `ext`
  - `uniqueNames(names: string[]): string[]` — case-insensitive; repeats get ` (2)`, ` (3)` before the extension
  - `type RenderOptions = { signal?: AbortSignal; onProgress?: (done: number) => void }`
  - `interface PdfEngine { render(docs: Uint8Array[], opts?: RenderOptions): Promise<Blob> }` (doc comment: renders
    the documents, in order, into one PDF; a future server engine implements the same interface)
  - `type BatchItem = { rowNumber: number; fileName: string; docx: Uint8Array }`
  - `generateZip(items: BatchItem[], engine: PdfEngine, opts?: RenderOptions): Promise<Blob>` — one
    `render([docx], { signal })` per item (its own `onProgress` is not passed to the engine), sequentially; `signal.throwIfAborted()` before each; `onProgress(i + 1)` after each; PDF bytes via
    `await blob.arrayBuffer()`; result `new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' })`
  - `generateMergedPdf(items: BatchItem[], engine: PdfEngine, opts?: RenderOptions): Promise<Blob>` — one
    `render(allDocx, …)`, tracking `done` from `onProgress`
  - Both rethrow `AbortError` unchanged and wrap other errors as
    `new Error(\`Не удалось сделать PDF для строки ${rowNumber}: ${message}\`)` for the item that failed

- [ ] **Step 1: Write the failing tests.** `src/core/fileName.test.ts`:

```ts
const row5 = { cert_number: '2026/0416', student_full_name: 'Сейтқали Әлихан Ерланұлы' }
it('fills the default pattern and keeps Cyrillic and Kazakh letters', () => {
  expect(fileNameFor(DEFAULT_PATTERN, row5, '.pdf')).toBe('2026_0416_Сейтқали Әлихан Ерланұлы.pdf')
  expect(fileNameFor(DEFAULT_PATTERN, row5, '.docx')).toBe('2026_0416_Сейтқали Әлихан Ерланұлы.docx')
})
it('sanitizes names', () => {
  expect(sanitizeFileName('a<b>:c"d|e?f*g\\h')).toBe('a_b__c_d_e_f_g_h')
  expect(sanitizeFileName('  many   spaces  ')).toBe('many spaces')
  expect(sanitizeFileName('name...')).toBe('name')
  expect(sanitizeFileName('')).toBe('document')
  expect(sanitizeFileName('x'.repeat(300))).toHaveLength(150)
})
it('reports unknown placeholders and leaves them empty', () => {
  expect(unknownPlaceholders('{cert_number}_{nme}.pdf', ['cert_number'])).toEqual(['nme'])
  expect(fileNameFor('{nme}_x', {}, '.pdf')).toBe('_x.pdf')
})
it('de-duplicates names case-insensitively', () =>
  expect(uniqueNames(['a.pdf', 'A.pdf', 'a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'A (2).pdf', 'a (3).pdf', 'b.pdf']))
```

  `src/core/batch.test.ts` (stub engine, no browser):

```ts
// Reports one finished document, then fails with 'boom' on the given call.
const stubEngine = (failOnCall?: number) => {
  const engine = {
    calls: 0,
    async render(docs: Uint8Array[], opts?: RenderOptions) {
      engine.calls++
      opts?.onProgress?.(1)
      if (engine.calls === failOnCall) throw new Error('boom')
      return new Blob([`%PDF-stub ${docs.length}`])
    },
  }
  return engine
}
const items: BatchItem[] = [
  { rowNumber: 1, fileName: 'a.pdf', docx: new Uint8Array([1]) },
  { rowNumber: 5, fileName: 'Сейтқали.pdf', docx: new Uint8Array([2]) },
  { rowNumber: 7, fileName: 'c.pdf', docx: new Uint8Array([3]) },
]
it('zips one PDF per item, in order, reporting progress', async () => {
  const progress: number[] = []
  const zip = await JSZip.loadAsync(await (await generateZip(items, stubEngine(), { onProgress: (n) => progress.push(n) })).arrayBuffer())
  expect(Object.keys(zip.files)).toEqual(['a.pdf', 'Сейтқали.pdf', 'c.pdf'])
  expect(await zip.file('c.pdf')!.async('string')).toBe('%PDF-stub 1')
  expect(progress).toEqual([1, 2, 3])
})
it('zip entry names keep Cyrillic and Kazakh letters', async () => {
  const zip = await JSZip.loadAsync(await (await generateZip([items[1]], stubEngine())).arrayBuffer())
  expect(zip.file('Сейтқали.pdf')).not.toBeNull()
})
it('stops on cancel', async () => {
  const engine = stubEngine(); const ctrl = new AbortController()
  await expect(generateZip(items, engine, { signal: ctrl.signal, onProgress: () => ctrl.abort() }))
    .rejects.toMatchObject({ name: 'AbortError' })
  expect(engine.calls).toBe(1)
})
it('names the failing row', async () => {
  await expect(generateZip(items, stubEngine(2))).rejects.toThrow('Не удалось сделать PDF для строки 5: boom')
  await expect(generateMergedPdf(items, stubEngine(1))).rejects.toThrow('Не удалось сделать PDF для строки 5: boom')
})
it('merges all items with one render call', async () => {
  const engine = stubEngine()
  expect(await (await generateMergedPdf(items, engine)).text()).toBe('%PDF-stub 3')
  expect(engine.calls).toBe(1)
})
```

- [ ] **Step 2: Run** both files. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `fileName.ts`, `pdf/engine.ts`, `batch.ts` per the Interfaces.
- [ ] **Step 4: Run** `npm test`. Expected: all unit tests PASS.

### Task 5: Fonts, document rendering and the raster PDF engine (closes milestone 1)

**Files:**
- Create: `src/styles/fonts.css`, `src/styles/app.css` (body reset only for now), `src/core/renderDocx.ts`,
  `src/core/pdf/raster.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `PdfEngine`, `RenderOptions` (Task 4); `fillTemplate` (Task 2)
- Produces:
  - `renderDocx(bytes: Uint8Array, container: HTMLElement): Promise<HTMLElement[]>` — empties the container, calls
    docx-preview `renderAsync(bytes, container, container, { inWrapper: true, breakPages: true, renderHeaders: true, renderFooters: true, experimental: true, useBase64URL: true })`,
    removes every `href` attribute inside the container and the `src` of every `<img>` not starting with `data:` or
    `blob:`, returns the `section.docx` elements
  - `rasterPdfEngine: PdfEngine`
  - CSS injection: `main.tsx` imports `./styles/fonts.css?inline` and `./styles/app.css?inline` and appends each as a
    `<style>` element to `document.head` before rendering React

- [ ] **Step 1: Write `fonts.css`.** 36 `@font-face` rules: families `Times New Roman` (Tinos), `Arial` (Arimo),
  `Calibri` (Carlito) × weights 400/700 × styles normal/italic × subsets below; `font-display: block`;
  `src: url('@fontsource/<pkg>/files/<pkg>-<subset>-<weight>-<style>.woff2') format('woff2')`. Generate the file
  once with a throwaway shell loop (do not commit the generator). Unicode ranges (same for all three families):
  - latin: `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD`
  - cyrillic: `U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116`
  - cyrillic-ext: `U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F`

  If Vite cannot resolve the bare `@fontsource/…` specifier inside `url()`, use a relative
  `../../node_modules/@fontsource/…` path instead.
- [ ] **Step 2: Inject CSS from `main.tsx`** as described in Interfaces.
- [ ] **Step 3: Implement `renderDocx.ts`.**
- [ ] **Step 4: Implement `pdf/raster.ts`.** Per `render` call: create an off-screen `div`
  (`position: fixed; left: -100000px; top: 0`), append to `document.body`, remove in `finally`. For each doc:
  `renderDocx`, `await document.fonts.ready`, then per section: `signal?.throwIfAborted()`;
  `html2canvas(section, { scale: 3, backgroundColor: '#ffffff', logging: false })`; page size from
  `section.getBoundingClientRect()` in px × 0.75 = pt; first page `new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'landscape' : 'portrait' })`,
  later pages `pdf.addPage([w, h], orientation)`; `pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h)`;
  then `canvas.width = canvas.height = 0`. After each doc empty the container and call `onProgress(doneDocs)`.
  Return `pdf.output('blob')`.
- [ ] **Step 5: Verify in the browser on the dev server.** Start `npm run dev` (background), navigate to
  http://localhost:5173, then `browser_evaluate`:

```js
async () => {
  const { fillTemplate } = await import('/src/core/template.ts')
  const { rasterPdfEngine } = await import('/src/core/pdf/raster.ts')
  const bytes = new Uint8Array(await (await fetch('/src/samples/spravka_ob_obuchenii_template.docx')).arrayBuffer())
  const doc = fillTemplate(bytes, { student_full_name: 'Сейтқали Әлихан Ерланұлы', cert_number: '2026/0416' })
  const t0 = performance.now()
  const pdf = await rasterPdfEngine.render([doc, doc])
  const text = await pdf.text()
  return { ms: Math.round(performance.now() - t0), size: pdf.size, head: text.slice(0, 4),
    pages: (text.match(/\/Type\s*\/Page(?!s)/g) || []).length,
    kazakh: document.fonts.check('16px "Times New Roman"', 'Сейтқали Әлихан Ерланұлы') }
}
```

  Expected: `head` `%PDF`, `pages` 2, `size` between 400 KB and 2 MB (a blank capture would be far smaller), `kazakh`
  true. Then render the same doc with `renderDocx` into a visible `div` appended to `body`, take a screenshot into
  `.playwright-mcp/`, Read it: all Kazakh letters drawn in the serif face. Console errors empty; `browser_close`.
- [ ] **Step 6: Verify the production bundle.** `npm run build`; then: `ls dist/assets | grep -c woff2` prints `0`;
  `grep -o 'data:font/woff2' dist/assets/*.js | wc -l` prints `36`; `grep -c 'rel="stylesheet"' dist/index.html`
  prints `0`; `npm test` passes.
- [ ] **Step 7: Commit milestone 1:**
  `git add .gitignore package.json package-lock.json tsconfig*.json vite.config.ts index.html src`, message
  `Add core modules: template, CSV, file names, batch and raster PDF engine`.

## Milestone 2: interface

### Task 6: App shell, storage, demo data, sheet and how-to page

**Files:**
- Create: `src/core/storage.ts`, `src/core/demo.ts`, `src/ui/Header.tsx`, `src/ui/Sheet.tsx`, `src/ui/HowTo.tsx`,
  `src/ui/download.ts`, `src/ui/plural.ts`
- Modify: `src/ui/App.tsx`, `src/styles/app.css`
- Test: `src/ui/plural.test.ts`

**Interfaces:**
- Consumes: `defaultLabel`, `inspectTemplate`, `fillTemplate`, `renderDocx`
- Produces:
  - `type TemplateRecord = { id: string; name: string; bytes: Uint8Array; fields: string[]; labels: Record<string, string>; defaults: Record<string, string>; optional: string[]; isDemo: boolean; createdAt: number }`
  - `newTemplateRecord(name: string, bytes: Uint8Array, fields: string[]): TemplateRecord` (`crypto.randomUUID()`,
    labels from `defaultLabel`, `defaults: {}`, `optional: []`, `isDemo: false`, `createdAt: Date.now()`)
  - `listTemplates(): Promise<TemplateRecord[]>` (by `createdAt`), `putTemplate(t): Promise<void>`,
    `deleteTemplate(id): Promise<void>` — IndexedDB database `certificates`, version 1, store `templates`, keyPath `id`
  - `DEMO_DEFAULTS` (spec §4 values), `demoTemplateBytes(): Uint8Array`, `demoCsvBytes(): Uint8Array` (from
    `../samples/…?inline` data URLs decoded with `atob`, never `fetch`), `createDemoTemplate(): TemplateRecord`
    (name `Справка об обучении`, fields from `inspectTemplate`, `defaults: DEMO_DEFAULTS`, `isDemo: true`)
  - `downloadBlob(blob: Blob, fileName: string): void` (object URL, `<a download>`, revoke after 10 s)
  - `plural(n: number, forms: [string, string, string]): string` → e.g. `8 строк`
  - `<Sheet source={{ bytes, values } | null} />` — `values: null` shows the raw template; `source: null` shows a blank
    sheet with «Здесь появится документ: выберите шаблон слева». Fills and renders 300 ms after the last change,
    discarding stale renders; a render error shows «Не удалось показать документ: …». Container
    `<div className="sheet" data-testid="sheet">`. Fits width: CSS `zoom = min(1, (deskWidth − 48) / sectionWidth)`
    via `ResizeObserver`.
  - App state (in `App.tsx`; later tasks add handlers): `templates`, `selectedId`, `step: 1 | 2 | 3`,
    `showHelp: boolean`, `mode: 'single' | 'group'`, `formValues: Record<string, string>`,
    `upload: { fileName: string; bytes?: Uint8Array; inspection?: TemplateInspection; error?: string } | null`,
    `csv: { fileName: string; table: CsvTable } | null`, `csvError: string | null`, `mapping: Mapping`,
    `pattern: string` (= `DEFAULT_PATTERN`), `previewRow: number`; `selectTemplate(id)` copies the template's
    `defaults` into `formValues` and re-runs `autoMap` when a CSV is loaded
  - Header: step buttons `① Шаблон`, `② Данные`, `③ Документы` (disabled until reachable, spec §6), button
    `Как подготовить шаблон`, note `Данные не покидают ваш браузер`

- [ ] **Step 1: Write the failing test** `src/ui/plural.test.ts`:

```ts
const rows = ['строка', 'строки', 'строк'] as [string, string, string]
it('picks Russian plural forms', () => {
  expect([1, 2, 5, 11, 12, 21, 22, 25].map((n) => plural(n, rows))).toEqual(
    ['1 строка', '2 строки', '5 строк', '11 строк', '12 строк', '21 строка', '22 строки', '25 строк'])
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/plural.test.ts`. Expected: FAIL. Implement `plural.ts`. Run: PASS.
- [ ] **Step 3: Implement** `storage.ts`, `demo.ts`, `download.ts`, `Sheet.tsx`, `Header.tsx`, `HowTo.tsx` and the
  `App` layout. `HowTo` covers the spec §6 list in plain Russian, with a `← Назад` button. Layout: header across the
  top; left panel 420 px (white); desk fills the rest (warm grey, e.g. `#e7e3dc`) with the sheet centred, white,
  soft shadow; below 1100 px the panel stacks above the desk. The UI uses the system font stack. Each step panel
  starts with a one-line hint: ① «Выберите шаблон справки или загрузите свой файл Word.», ② «Заполните поля вручную
  или загрузите таблицу CSV со списком слушателей.», ③ «Проверьте документ и скачайте результат.» Steps 1–3 render
  placeholders in this task.
- [ ] **Step 4: Verify in the browser** (CLAUDE.md routine): header shows the three steps, `② Данные` and
  `③ Документы` disabled; the privacy note is visible; the blank sheet shows its hint; `Как подготовить шаблон` opens
  the how-to page and `← Назад` returns; at 1024 px width (`browser_resize`) the panel stacks above the desk; console
  errors empty; screenshot of the 1280 px layout read and checked.

### Task 7: Step ① Шаблон

**Files:**
- Create: `src/ui/StepTemplate.tsx`, `src/ui/DropZone.tsx`
- Modify: `src/ui/App.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: Task 6 state and storage; `uploadSizeError`, `inspectTemplate`; `decodeCsv`, `parseCsv`, `autoMap`
- Produces:
  - `<DropZone accept: string; label: string; onFile(file: File): void />` — click opens the file picker, drag and drop
    works, used again in Task 8
  - App handlers: `uploadTemplateFile(file)`, `saveUpload(name)`, `addDemoTemplate()` (reuses the existing
    `isDemo` record if present), `loadCsvBytes(bytes, fileName)` (decode → parse → `autoMap`; a thrown message goes
    to `csvError`; resets `previewRow` to 0), `startDemo()` (`addDemoTemplate` + `loadCsvBytes(demoCsvBytes(), 'students_demo.csv')`
    + `mode = 'group'` + `step = 1`)
  - Buttons: `Попробовать на примере` (large while the library is empty), `Загрузить демо-шаблон`,
    `Сохранить в библиотеку`, `Отмена`, `Переименовать`, `Удалить`, `Далее →`; collapsible `Настроить поля`

- [ ] **Step 1: Implement the library list** (name, `plural(n, ['поле', 'поля', 'полей'])`, select, rename inline,
  delete after `confirm('Удалить шаблон «…»?')`; deleting the selected one clears the selection). Selecting shows the
  raw template on the sheet.
- [ ] **Step 2: Implement upload** via `DropZone` (`accept=".docx"`): size check, then a `.doc` name gets
  «Сохраните документ в формате .docx: Файл → Сохранить как → Документ Word», else `inspectTemplate`. The panel lists
  found fields with labels, warnings (amber) and errors (red, no save button). The sheet shows the uploaded file while
  it is under review. Save uses the name input (default: file name without `.docx`), `putTemplate`, selects it.
  An IndexedDB failure shows «Браузер не дал сохранить шаблон. Попробуйте обычное, не приватное окно.»
- [ ] **Step 3: Implement `Настроить поля`:** per field a label input, an «необязательное» checkbox and a default
  value input (`type="date"` for date fields). Each change is saved with `putTemplate`; editing a default also sets
  that field in `formValues`.
- [ ] **Step 4: Implement the demo buttons** and `startDemo`.
- [ ] **Step 5: Verify in the browser.** Make a broken DOCX in the scratchpad with a short Node script using PizZip
  (replace `word/document.xml` text so it contains `{{ student_full_name, дата`). Check: fresh load shows the large
  `Попробовать на примере`; `Загрузить демо-шаблон` adds «Справка об обучении · 16 полей» and the sheet shows
  `{{ cert_number }}`; clicking it again still leaves one demo entry; uploading the broken file shows an error with
  «не хватает «}}»» and no save button; uploading `src/samples/spravka_ob_obuchenii_template.docx` lists 16 fields and
  saves as «Моя справка»; rename and delete work (accept the dialog with `browser_handle_dialog`); a changed label
  survives a reload; console errors empty; screenshot of step ① with the sheet read and checked.

### Task 8: Step ② Данные

**Files:**
- Create: `src/ui/StepData.tsx`, `src/ui/FieldInput.tsx`
- Modify: `src/ui/App.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: `prepareValues`, `isDateField`, `buildRows`, `autoMap`, `uploadSizeError`, `DropZone`, `loadCsvBytes`
- Produces:
  - `<FieldInput field label value optional onChange />` — `type="date"` for date fields (value kept as
    `YYYY-MM-DD`), text otherwise; optional fields labelled «(необязательно)»
  - Radios `Один документ`, `Группа из CSV`; button `Загрузить демо-данные`; mapping `<select>` per field with
    option `— общее значение —`; heading `Общие значения`
  - Sheet source in steps ② and ③: single → `prepareValues(template, formValues).values`; group with CSV →
    `rows[previewRow].values`; group without CSV → raw template

- [ ] **Step 1: Implement single mode:** a `FieldInput` per template field bound to `formValues`.
- [ ] **Step 2: Implement group mode:** `DropZone` (`accept=".csv,text/csv"`) with size check, `Загрузить
  демо-данные`, the summary `${plural(rows, ['строка', 'строки', 'строк'])}, ${plural(columns, ['столбец', 'столбца', 'столбцов'])}`,
  `csvError` in red, the mapping list, `Общие значения` with a `FieldInput` for every field mapped to `null`, and
  «Не используются: …» for unmapped columns (hidden when none).
- [ ] **Step 3: Wire the sheet source** as in Interfaces and the `Далее →` / `← Назад` buttons.
- [ ] **Step 4: Verify in the browser.** Write a windows-1251 CSV (`python3 -c` with `.encode('cp1251')`) and a
  header-only CSV into the scratchpad. Check: single mode — typing a name shows it on the sheet after the debounce,
  picking 14.03.2008 in a date field shows `14.03.2008`; group mode — demo data shows «8 строк, 12 столбцов», 12
  fields mapped and 4 under `Общие значения` filled with the demo defaults, the sheet shows row 1; switching a
  field to `— общее значение —` adds its input; the cp1251 file shows correct Cyrillic; the header-only file shows
  «В CSV нет строк с данными»; console errors empty.

### Task 9: Step ③ Документы and printing (closes milestone 2)

**Files:**
- Create: `src/ui/StepDocuments.tsx`
- Modify: `src/ui/App.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: `rasterPdfEngine`, `generateZip`, `generateMergedPdf`, `fillTemplate`, `fileNameFor`, `uniqueNames`,
  `unknownPlaceholders`, `sanitizeFileName`, `downloadBlob`, `buildRows`, `prepareValues`
- Produces (names used by the e2e test in Task 10):
  - Buttons `Скачать PDF`, `Скачать DOCX`, `Распечатать`, `Скачать ZIP ({n} PDF)`, `Скачать один PDF для печати`,
    `Отменить`; progress text `Готово {done} из {total}`; result text `Отменено`
  - A rows `<table>`: columns `№`, `ФИО`, `Статус`; status `Готово` or `problems.join('; ')`; clicking a row sets
    `previewRow` and highlights it

- [ ] **Step 1: Implement single mode:** problems from `prepareValues`; when non-empty the three buttons are disabled
  and the panel shows the problems. PDF: `rasterPdfEngine.render([fillTemplate(bytes, values)])`, saved as
  `fileNameFor(pattern, values, '.pdf')`; DOCX: the filled bytes as
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` with `'.docx'`; print: `window.print()`.
- [ ] **Step 2: Implement group mode:** the table (`ФИО` = `student_full_name` value, else the first mapped value,
  else `Строка {n}`); valid rows → `BatchItem`s with `uniqueNames(validRows.map((r) => fileNameFor(pattern, r.values, '.pdf')))`;
  ZIP saved as `sanitizeFileName(\`${template.name} — ${YYYY-MM-DD}\`) + '.zip'`, merged as
  `sanitizeFileName(\`${template.name} — все документы\`) + '.pdf'`; buttons disabled when there are no valid rows or
  a generation runs; an `AbortController` per run; `AbortError` → `Отменено`; other errors shown in red.
- [ ] **Step 3: Shared parts:** the pattern input (default `DEFAULT_PATTERN`) with «Нет такого поля: …» from
  `unknownPlaceholders`; the note «PDF в демо собирается прямо в браузере; в рабочей версии — на сервере через
  LibreOffice, мелкие отличия вёрстки возможны».
- [ ] **Step 4: Print stylesheet** in `app.css`: `@media print` hides everything except the sheet's sections, resets
  the zoom, removes the desk background, wrapper padding and section shadows, `break-after: page` per section;
  `@page { margin: 0 }`.
- [ ] **Step 5: Verify in the browser.** Check:
  - single mode with all 16 fields filled (`browser_fill_form`): `Скачать PDF` downloads a file starting with `%PDF`;
    `Скачать DOCX` downloads a DOCX.
  - print: `browser_run_code` with `page.emulateMedia({ media: 'print' })`, then a screenshot shows only the sheet.
  - group with demo data: row 8 status «Не заполнено: Дата рождения»; `Скачать ZIP (7 PDF)` downloads a ZIP whose
    `unzip -l` lists 7 PDFs including `2026_0416_Сейтқали Әлихан Ерланұлы.pdf`; `Скачать один PDF для печати` then
    `Отменить` shows `Отменено`.
  - row 5 clicked: screenshot of the sheet read and checked — every Kazakh glyph renders in the serif face.
  - a 40-row CSV (the 7 valid demo rows repeated with distinct `cert_number`) produces a 40-PDF ZIP and a 40-page
    merged PDF without the tab crashing; note the time taken.
  - console errors empty.
- [ ] **Step 6: Commit milestone 2:** `git add src`, message `Add the three-step interface with live preview and downloads`.

## Milestone 3: end-to-end test

### Task 10: Subpath server and Playwright test (closes milestone 3)

**Files:**
- Create: `scripts/serve-subpath.mjs`, `playwright.config.ts`, `e2e/demo.spec.ts`
- Modify: `package.json` (scripts `serve:subpath`, `test:e2e`)

**Interfaces:**
- Consumes: the UI names from Tasks 6–9
- Produces: `npm run test:e2e` (build first with `npm run build`)

- [ ] **Step 1: Install the browser:** `npx playwright install chromium`.
- [ ] **Step 2: Write the test** `e2e/demo.spec.ts` (`test.setTimeout(120_000)`):

```ts
test('demo group: 7 one-page PDFs, row 8 invalid, Tinos only, no requests after load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/certificate_flow_proto/', { waitUntil: 'load' })
  const requests: string[] = []
  page.on('request', (r) => { if (/^https?:/.test(r.url())) requests.push(r.url()) })

  await page.getByRole('button', { name: 'Загрузить демо-шаблон' }).click()
  await page.getByRole('button', { name: '② Данные' }).click()
  await page.getByRole('radio', { name: 'Группа из CSV' }).check()
  await page.getByRole('button', { name: 'Загрузить демо-данные' }).click()
  await page.getByRole('button', { name: '③ Документы' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Омарова Камила Руслановна' }))
    .toContainText('Не заполнено: Дата рождения')

  const readDownload = async (name: RegExp) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
    return readFile((await dl.path())!)
  }
  const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length

  const zip = await JSZip.loadAsync(await readDownload(/Скачать ZIP/))
  const pdfs = Object.values(zip.files).filter((f) => f.name.endsWith('.pdf'))
  expect(pdfs).toHaveLength(7)
  for (const f of pdfs) {
    const bytes = await f.async('nodebuffer')
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(pageCount(bytes)).toBe(1)
  }
  expect(pageCount(await readDownload(/Скачать один PDF для печати/))).toBe(7)

  await page.getByRole('row').filter({ hasText: 'Сейтқали Әлихан Ерланұлы' }).click()
  const sheet = page.getByTestId('sheet')
  await expect(sheet).toContainText('Сейтқали Әлихан Ерланұлы')
  await page.evaluate(() => document.fonts.ready)
  await sheet.locator('span').filter({ hasText: 'Сейтқали' }).last().evaluate((el) => el.setAttribute('data-kz', ''))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-kz]' })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(new Set(fonts.map((f) => f.familyName))).toEqual(new Set(['Tinos']))

  expect(requests).toEqual([])
  expect(errors).toEqual([])
})
```

- [ ] **Step 3: Write `playwright.config.ts`:** `testDir: 'e2e'`, Chromium only,
  `use: { baseURL: 'http://localhost:4173' }`, `webServer: { command: 'node scripts/serve-subpath.mjs', url: 'http://localhost:4173/certificate_flow_proto/', reuseExistingServer: false }`.
  Scripts: `"serve:subpath": "node scripts/serve-subpath.mjs"`, `"test:e2e": "playwright test"`.
- [ ] **Step 4: Run** `npm run build && npm run test:e2e`. Expected: FAIL (the server script does not exist).
- [ ] **Step 5: Implement `scripts/serve-subpath.mjs`** with `node:http` only: serves `dist/` at
  `/certificate_flow_proto/` (port `PORT` or 4173), `/certificate_flow_proto` → 301 to the trailing slash, a
  directory → its `index.html`, content types for html/js/css/svg/png/ico/json/woff2, anything else or any path
  outside the prefix or containing `..` → 404 (no SPA fallback, like GitHub Pages).
- [ ] **Step 6: Run** `npm run build && npm run test:e2e`. Expected: 1 passed. If the request or font assertion
  fails, use superpowers:systematic-debugging; do not loosen the assertion.
- [ ] **Step 7: Commit milestone 3:** `git add scripts playwright.config.ts e2e package.json package-lock.json`,
  message `Add end-to-end test against the production build served from a subpath`.

## Milestone 4: deployment

### Task 11: GitHub Pages workflow, README and final verification (closes milestone 4)

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1: Look up current action majors:** for each of `actions/checkout`, `actions/setup-node`,
  `actions/upload-pages-artifact`, `actions/deploy-pages` run
  `git ls-remote --tags https://github.com/<repo> | grep -oE 'v[0-9]+$' | sort -V | tail -1`.
- [ ] **Step 2: Write `deploy.yml`:** `on: push: branches: [main]` and `workflow_dispatch`; `permissions:
  contents: read, pages: write, id-token: write`; `concurrency: { group: pages, cancel-in-progress: false }`; job
  `build` on `ubuntu-latest`: checkout, setup-node 22 with `cache: npm`, `npm ci`, `npm test`,
  `npx playwright install --with-deps chromium`, `npm run build`, `npm run test:e2e`, upload-pages-artifact with
  `path: dist`; job `deploy` with `needs: build`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`,
  step `deploy-pages` with `id: deployment`. Validate syntax with `npx --yes yaml@2 valid < .github/workflows/deploy.yml`.
- [ ] **Step 3: Write `README.md` in English:** what the demo does (template + form or CSV → PDF, ZIP, merged
  PDF; data stays in the browser); run locally (`npm ci`, `npm run dev`, `npm test`, `npm run build`,
  `npx playwright install chromium`, `npm run test:e2e`); deploying (push to `main`; one-time Settings → Pages →
  Source = GitHub Actions); preparing a template (tag syntax, names, CSV columns named like fields, the `_date`
  convention, where tags may go, no `{% %}` blocks); known limitations (spec §12) and what is out of scope (spec §13).
- [ ] **Step 4: Final verification**, all fresh, outputs read:
  - `npm test` → all unit tests pass.
  - `npm run build && npm run test:e2e` → 1 passed.
  - `grep -c 'Content-Security-Policy' dist/index.html` → `1`; with `npm run dev` running,
    `curl -s http://localhost:5173/ | grep -c 'Content-Security-Policy'` → `0`.
  - With `npm run serve:subpath` running, the CLAUDE.md browser routine at
    http://localhost:4173/certificate_flow_proto/: `Попробовать на примере` → ③, row 5 screenshot read and checked
    for the Kazakh glyphs; console errors empty (this is the production CSP in force).
- [ ] **Step 5: Commit milestone 4:** `git add .github README.md`, message
  `Add GitHub Pages deployment workflow and README`. Then use superpowers:finishing-a-development-branch.
