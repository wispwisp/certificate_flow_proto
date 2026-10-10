# certificate_flow_proto

A sales demo of a certificate generator for a training center. Upload a DOCX letterhead template, fill the fields by
hand or from a CSV file, check the live preview, and export PDF: a single document, a ZIP with one PDF per student,
or one merged PDF. Everything runs in the browser; no data leaves the computer. The UI is in Russian.

## Run locally

```
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # production build into dist/
npx playwright install chromium
npm run test:e2e   # end-to-end test against the production build served from a subpath
```

`npm run serve:subpath` serves `dist/` at http://localhost:4173/certificate_flow_proto/, the way GitHub Pages does.

## Deploy

Push to `main`: the workflow in `.github/workflows/deploy.yml` runs the tests, builds and publishes `dist` to GitHub
Pages. One-time setup: Settings → Pages → Source = GitHub Actions.

## Preparing a template

- Write a tag as `{{ field_name }}` (spaces inside the braces are optional). A name starts with a Latin letter or
  `_` and continues with Latin letters, digits or `_`.
- Tags may be placed in the body, headers and footers. Formatting may be split across runs inside a tag.
- The data is flat: no loops, conditions or nested fields. `{% ... %}` blocks are not processed and stay in the
  document as text.
- A field whose name ends in `_date` (for example `issue_date`) gets a date picker and is written as `DD.MM.YYYY`.
  Every other field is a text input.
- For a group, give the CSV columns the same names as the fields.

## Known limitations

- The PDF is a raster image of each page (about 450 KB per page); its text is not selectable. The Print button goes
  through the browser's print dialog and keeps real text.
- The preview draws a double paragraph border as a single line, and header/footer positions differ from LibreOffice
  by a few pixels. Pixel parity with the production renderer is not a goal.

## Out of scope

Authentication, roles, an issue log, certificate numbering, date calculation, XLSX import, QR codes, digital
signatures, any server, inline editing of invalid rows, the server PDF engine.
