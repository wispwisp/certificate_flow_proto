# Certificate generator MVP: design

Date: 2026-10-09. Source brief: `claude_code_prompt_mvp.md` (kept untracked). This spec records the brief plus every
decision made while brainstorming it. Where the two differ, this spec wins.

## 1. Purpose

A sales demo, not the product. Non-technical office staff of a training center open a link on their own computer and,
within two minutes, see that "Word template + table of students = finished PDF certificates" works. The production
system will be a server application (Go, PostgreSQL, docxtpl, LibreOffice), so:

- Template syntax stays docxtpl/Jinja-compatible: templates made for the demo move to the product unchanged.
- PDF generation sits behind a `PdfEngine` interface so a server-side converter can replace the in-browser one.

## 2. Hard constraints

- Static SPA on GitHub Pages under a repository subpath. No backend, no serverless.
- No network requests after the `load` event. All libraries, fonts and demo files are bundled.
- Production build carries a CSP meta tag (not in dev, it breaks HMR):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
- No analytics, telemetry or third-party embeds.
- UI in Russian. Code, comments, commit messages and README in English.
- Desktop Chrome, Edge, Firefox at ≥1280 px; usable on a tablet; phones out of scope.

## 3. Stack

Vite, TypeScript (strict), React, plain CSS, no UI kit.

| Purpose | Package | Version |
|---|---|---|
| Fill DOCX | `docxtemplater` + `pizzip` | 3.71 / 3.3 |
| DOCX → HTML | `docx-preview` | 0.4 |
| HTML → PDF | `html2canvas` + `jspdf` | 1.4 / 4.2 |
| ZIP | `jszip` | 3.10 |
| CSV | `papaparse` | 5.7 |
| Fonts | `@fontsource/tinos`, `@fontsource/arimo`, `@fontsource/carlito` | 5.3 |
| Tests | `vitest`, `@playwright/test` | current |

Replacing any of these requires asking first.

## 4. Decisions made during brainstorming

1. **Demo files are bundled into the JS**, not served from `public/samples/`. `connect-src 'none'` blocks even a
   same-origin `fetch`, and the e2e test forbids requests after load. They live in `src/samples/`, are imported at
   build time as base64 data URLs (Vite `?inline`, with `assetsInclude` for `.docx`/`.csv`) and decoded with `atob`,
   never fetched (a `fetch` of a `data:` URL is also blocked).
2. **Font files are inlined as `data:` URIs** in the production CSS. Browsers download a font lazily the first time a
   glyph needs it, which would be a request after load. Cost: ~0.7 MB of woff2, ~0.95 MB as base64.
3. **`style-src 'unsafe-inline'`** is required because `docx-preview` injects `<style>` blocks and inline styles.
4. **One JS bundle, no dynamic imports.** A lazily loaded chunk is a request after load.
5. **First visit** shows an empty library with a large "Попробовать на примере" button (option B).
6. **Layout:** side panel + desk, with the A4 sheet always visible.
7. **No inline editing of invalid CSV rows.** The fix is to correct the CSV and load it again.
8. **README in English.**
9. Work happens on branch `mvp`; `main` (which deploys) is updated by merging.

Assumptions confirmed by the user:

- The demo template ships with fictional default values for the four shared fields, otherwise all 8 demo rows would
  be invalid. Values: `signer_position` = «Директор», `signer_full_name` = «Иванов И. И.»,
  `manager_full_name` = «Петрова А. С.», `manager_phone` = «+7 (7172) 00-00-01».
- Every field is required unless marked optional in the template settings.
- An empty (or whitespace-only) CSV cell in a mapped column is an error. It does not fall back to the shared value.
- CSV dates: `D.M.YYYY`, `DD.MM.YYYY` and `YYYY-MM-DD` are accepted, normalized to `DD.MM.YYYY`. Anything else, or an
  impossible date such as 31.02.2026, makes the row invalid.
- The single-document download uses the same file name pattern as the batch.

## 5. Template format

- Placeholder: `{{ field_name }}`, optional spaces inside the braces, name matches `[A-Za-z_][A-Za-z0-9_]*`. Flat data
  model: no nesting, loops or conditions.
- Fields are discovered in `word/document.xml`, every `word/header*.xml` and every `word/footer*.xml`, in order of
  first appearance (document, then headers, then footers, each group in file-name order), without duplicates.
- Discovery never searches raw XML. It compiles the template with docxtemplater using the options from the brief
  (`{{`/`}}` delimiters, `paragraphLoop`, `linebreaks`, trimming parser, `nullGetter: () => ''`) and reads
  `doc.getFullText(part)`, where runs are already merged.
- Compile failures (`error.properties.errors`) become a list of Russian messages, each with the part
  («основной текст», «верхний колонтитул», «нижний колонтитул») and the surrounding text, e.g.
  «…что {{ student_full_name, дата…» — не хватает «}}». Known ids (`unclosed_tag`, `unopened_tag`,
  `duplicate_open_tag`, `duplicate_close_tag`) get specific messages; any other id gets a generic one with context.
  A template with errors cannot be saved.
- Warnings (the template can still be saved):
  - `{%`, `{#` (Jinja blocks/comments): «Демо не обрабатывает блоки {% … %}; они останутся в документе как текст».
  - A `{{ … }}` whose content is not a plain name (e.g. `{{ name|upper }}`): «Тег … не поддерживается в демо и будет пустым».
- Field type comes from the name: a `_date` suffix gives a date picker, the value is written as `DD.MM.YYYY`.
  Everything else is a text input. Form values and defaults of date fields are kept as the picker's `YYYY-MM-DD` and
  formatted only when filling the document. All values are trimmed before filling and validation.
- Labels come from a built-in Russian dictionary, fall back to the raw field name, and are editable per template:

| Field | Label |
|---|---|
| cert_number | Исходящий номер |
| issue_date | Дата выдачи |
| student_full_name | ФИО слушателя |
| birth_date | Дата рождения |
| program_name | Программа |
| group_name | Группа |
| study_form | Форма обучения |
| study_start_date | Начало обучения |
| study_end_date | Окончание обучения |
| study_duration | Продолжительность программы |
| hours_per_week | Часов в неделю |
| destination | Для предъявления (куда) |
| signer_position | Должность подписанта |
| signer_full_name | ФИО подписанта |
| manager_full_name | Исполнитель (ФИО) |
| manager_phone | Телефон исполнителя |

## 6. Screen flow

**Header (always):** steps ① Шаблон ─ ② Данные ─ ③ Документы, clickable once reachable (② needs a selected
template; ③ needs a template, and in group mode a loaded CSV); link «Как подготовить шаблон»; permanent note
«Данные не покидают ваш браузер».

**Layout:** a left panel (~420 px) shows the current step. To its right, the desk shows the document as an A4 sheet
of paper at readable size (100% when it fits, scaled down to the desk width otherwise). Below ~1100 px the panel
stacks above the desk.

**First visit / empty library:** large «Попробовать на примере», plus «Загрузить демо-шаблон» and a drop zone
«Перетащите файл Word (.docx) сюда или выберите его». The desk shows a blank sheet with one line explaining the app.
«Попробовать на примере» adds the demo template (or reuses it if already present), selects it, loads the demo CSV,
switches to group mode and opens step ①. Each step shows a one-line hint and «Далее →».

**① Шаблон**
- Library: list of templates with field counts, «Переименовать», «Удалить» (with confirmation). Selecting one shows
  the raw template, tags visible, on the sheet.
- Upload (file picker or drop): checks, then the found fields, warnings or errors on the panel and the template on the
  sheet; a name input (default: file name without `.docx`) and «Сохранить в библиотеку» / «Отмена».
- «Настроить поля» (collapsible): per field, the label, an «необязательное» checkbox and a default value. Changes are
  saved automatically.

**② Данные**: switch «Один документ» / «Группа из CSV».
- Один документ: a form with every field, prefilled from the template defaults. The sheet re-renders 300 ms after the
  last keystroke; stale renders are discarded.
- Группа из CSV: drop zone and «Загрузить демо-данные»; a summary «8 строк, 12 столбцов»; column mapping (field →
  column dropdown, auto-filled case-insensitively by name, «— общее значение —» for no column); «Общие значения» form
  for unmapped fields; list of ignored columns. The shared values are the same form values as in single mode.

**③ Документы**
- Один документ: «Скачать PDF», «Скачать DOCX», «Распечатать». If a required field is empty, the buttons are disabled
  and the panel says «Не заполнено: …».
- Группа: row table (№ counting data rows from 1, so «row 8» is the 8th student; ФИО or the first mapped value, status «Готово» or «Не заполнено: Дата рождения» /
  «Дата рождения: непонятный формат «…», нужно ДД.ММ.ГГГГ»). Clicking a row shows that row's document on the sheet.
  Buttons «Скачать ZIP (7 PDF)» and «Скачать один PDF для печати», disabled when there are no valid rows. During
  generation: «Готово 3 из 7» and «Отменить».
- Both modes: the file name pattern input, default `{cert_number}_{student_full_name}.pdf`, and the note
  «PDF в демо собирается прямо в браузере; в рабочей версии — на сервере через LibreOffice, мелкие отличия вёрстки
  возможны».

**How-to page** (in place of panel and desk, «← Назад»): how to write a tag, allowed names, that the CSV column must
be named like the field, the `_date` convention, where tags may go (text, tables, header, footer), that the tag's
formatting applies to the value, that `{% %}` blocks are not processed in the demo, saving as `.docx`, and that it is
fine if Word splits a tag internally.

**Errors** appear next to what failed and say how to fix it: «Файл больше 10 МБ — …», «Это не файл Word (.docx)»,
for `.doc`: «Сохраните документ в формате .docx: Файл → Сохранить как → Документ Word», «В CSV нет строк с данными».

## 7. Modules

`core/` is plain TypeScript without React, unit-tested in Node. UI state lives in React (`useState`/`useReducer`);
only templates are persisted.

```
src/
  core/
    zipGuard.ts     reads the ZIP central directory before unpacking: not a ZIP → error; > 1000 entries or
                    > 50 MB total uncompressed → error
    template.ts     inspectTemplate(bytes) → { fields, warnings, errors }; fillTemplate(bytes, values) → DOCX bytes
    fields.ts       label dictionary, isDateField, formatDate (picker value / CSV value → DD.MM.YYYY or error)
    csv.ts          decodeCsv (UTF-8 fatal → windows-1251), parseCsv (PapaParse: header, auto delimiter,
                    skip empty lines), autoMap, buildRows (values + validation per row)
    fileName.ts     applyPattern, sanitize, de-duplicate
    renderDocx.ts   docx-preview with the brief's options into a given container, then removes every `href`
                    and every <img> whose src is not data:/blob:
    pdf/engine.ts   PdfEngine interface
    pdf/raster.ts   RasterPdfEngine
    batch.ts        generateZip / generateMergedPdf over valid rows
    storage.ts      IndexedDB wrapper: list, get, put, delete templates
    demo.ts         the bundled demo DOCX/CSV bytes and the demo default values
  ui/               App, Header, StepTemplate, StepData, StepDocuments, Sheet, HowTo
  fonts.css         @font-face definitions
  samples/          spravka_ob_obuchenii_template.docx, students_demo.csv
scripts/serve-subpath.mjs   static server for dist/ at /certificate_flow_proto/ (no SPA fallback, like Pages)
e2e/demo.spec.ts
```

**Template record (IndexedDB `certificates` / store `templates`):** `id`, `name`, `bytes`, `fields`, `labels`,
`defaults`, `optional` (field names), `isDemo`, `createdAt`. If IndexedDB is unavailable, the panel says so and the
library cannot save.

**PdfEngine:**
```ts
interface PdfEngine {
  // Renders the documents, in order, into one PDF.
  render(docs: Uint8Array[], opts?: { signal?: AbortSignal; onProgress?: (done: number) => void }): Promise<Blob>;
}
```
A ZIP entry or the single download is `render([doc])`; the merged print PDF is `render(allValidDocs)`. A future
`ServerPdfEngine` would POST the DOCX files to a converter and return its PDF; it is not implemented.

**RasterPdfEngine:** for each document, render it with `renderDocx` into an off-screen container
(`position: fixed; left: -100000px`, not `display: none`), await `document.fonts.ready`, then for each
`section.docx`: `html2canvas(section, { scale: 3, backgroundColor: '#fff' })`, page size taken from the section's
rendered box (px → pt), `canvas.toDataURL('image/jpeg', 0.9)` added as a full page to one jsPDF document, then the
canvas is released (`width = height = 0`). The container is emptied after each document. `signal` is checked before
each page; abort throws `AbortError`.

**Print route:** «Распечатать» calls `window.print()`. The print stylesheet hides everything except the sheet's
`section.docx` elements, removes shadows, breaks the page after each section and sets `@page { margin: 0 }`.

**Batch:** rows are processed one at a time. `generateZip` puts one PDF per valid row into a JSZip archive named
`<template name> — <YYYY-MM-DD>.zip`. `generateMergedPdf` names its file `<template name> — все документы.pdf`.
Cancel stops without downloading and shows «Отменено». A failure stops the batch and names the row.

**File names:** `{name}` placeholders take the row's (or form's) value; unknown names become empty and are listed
under the input as a warning.
Characters `<>:"/\|?*` and control characters become `_`, whitespace is collapsed, trailing dots and spaces are
trimmed, length is capped at 150, an empty result becomes `document`, `.pdf` is appended if missing, and duplicates
get ` (2)`, ` (3)`. The DOCX download uses the same base name with `.docx`.

## 8. Fonts

`fonts.css` declares `@font-face` rules that register Tinos as "Times New Roman", Arimo as "Arial" and Carlito as
"Calibri", for weights 400 and 700, normal and italic, subsets latin, cyrillic and cyrillic-ext, with the
`unicode-range` values from the fontsource CSS. Sources are the woff2 files from the fontsource packages. In the
production build Vite inlines them (`build.assetsInlineLimit` returns `true` for `.woff2`). Author-defined families
shadow fonts installed on the visitor's machine. The UI itself uses the system font stack.

## 9. Untrusted input

- DOCX and CSV uploads over 10 MB are rejected before reading.
- `zipGuard` runs before PizZip or docx-preview touch a DOCX. A DOCX without `word/document.xml` is rejected.
- CSV values reach the page only as React text and reach the DOCX only through docxtemplater, which escapes XML. No
  `dangerouslySetInnerHTML` anywhere.
- `renderDocx` strips links and external images after every render; the CSP is the backstop.

## 10. Verification

**Unit (Vitest, Node):**
- Field discovery on the sample: exactly the 16 fields in order, including the split `student_full_name`.
- `{% %}` warning and unsupported-tag warning; malformed-tag errors on a broken DOCX generated in the test.
- `fillTemplate` puts values into the body, tables and footer.
- `zipGuard` limits and non-ZIP input.
- CSV: BOM stripped, `;` detected, quoted `;` kept, Kazakh letters intact, and a windows-1251 fixture generated in the
  test decodes correctly.
- `autoMap` (case-insensitive, extra columns ignored, unmapped fields reported).
- Row validation: row 8 invalid with `birth_date` named; the other 7 valid.
- Date normalization and invalid dates.
- File name sanitizing and de-duplication.

**RasterPdfEngine** has no unit test: it needs real layout and canvas. Milestone 1 checks it by hand on the dev
server (sample DOCX → one-page PDF), and the e2e test covers it afterwards.

**E2E (Playwright, Chromium, one test)** against `npm run build` served by `scripts/serve-subpath.mjs` at
`/certificate_flow_proto/`:
- After `load`, start recording requests.
- Load the demo template and the demo data with the two separate buttons («Загрузить демо-шаблон», «Загрузить
  демо-данные»), open ③.
- Row 8 shows «Не заполнено: Дата рождения».
- «Скачать ZIP»: 7 entries, each starts with `%PDF` and has exactly one `/Type /Page` object.
- «Скачать один PDF для печати»: 7 pages.
- Open row 5's preview; via a CDP session, `CSS.getPlatformFontsForNode` on the element holding «Сейтқали Әлихан
  Ерланұлы» reports only Tinos.
- No http(s) requests recorded after `load` (`blob:` and `data:` are not network requests), and no console errors.

**Manual, before calling it done:**
- A screenshot of row 5's sheet, inspected by eye: every Kazakh glyph renders.
- The CLAUDE.md browser routine (navigate, snapshot, exercise, console errors empty, close) after UI changes.
- The production build served from the subpath.
- The CSP meta tag present in `dist/index.html` and absent in dev.

## 11. Build and deployment

- Vite `base: './'`. No path-based router: the step and the how-to page are React state.
- The CSP meta tag is injected by a small Vite plugin with `apply: 'build'`.
- `.github/workflows/deploy.yml`, on push to `main` and manual dispatch: checkout, Node 22 with npm cache, `npm ci`,
  unit tests, `npx playwright install --with-deps chromium`, build, e2e, `actions/upload-pages-artifact` (`dist`),
  then a deploy job with `actions/deploy-pages`. Action versions are the latest majors at implementation time.
  One-time manual step: repository Settings → Pages → Source = "GitHub Actions".
- README (English): what the demo does, how to run it locally, how to prepare a template, known limitations.

## 12. Known limitations (stated in the README and the UI note)

- The PDF is a raster image of each page (~450 KB per page); its text is not selectable. «Распечатать» goes through
  the browser's print dialog and keeps real text.
- `docx-preview` draws a double paragraph border as a single line, and header/footer positions differ from LibreOffice
  by a few pixels. Pixel parity with the production renderer is not a goal.
- Flat data only: no loops, conditions or nested fields.

## 13. Out of scope

Authentication, roles, an issue log, certificate numbering, date calculation, XLSX import, QR codes, digital
signatures, any server, inline editing of invalid rows, the server PDF engine.

## 14. Milestones (one commit each, author `wisp <forworkandtravel@yandex.ru>`)

1. Scaffold, sample files moved to `src/samples/`, core modules with unit tests (template, CSV, file names, PDF engine).
2. Interface.
3. E2E test.
4. Deployment workflow and README.
