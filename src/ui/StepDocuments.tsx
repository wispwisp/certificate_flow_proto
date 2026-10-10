import { useRef, useState } from 'react'
import { generateMergedPdf, generateZip, type BatchItem } from '../core/batch'
import type { CsvRow, Mapping } from '../core/csv'
import { fileNameFor, sanitizeFileName, uniqueNames, unknownPlaceholders } from '../core/fileName'
import { prepareValues } from '../core/fields'
import { rasterPdfEngine } from '../core/pdf/raster'
import type { TemplateRecord } from '../core/storage'
import { fillTemplate } from '../core/template'
import { downloadBlob } from './download'

type Props = {
  template: TemplateRecord
  mode: 'single' | 'group'
  formValues: Record<string, string>
  rows: CsvRow[] | null
  mapping: Mapping
  pattern: string
  previewRow: number
  onPattern: (pattern: string) => void
  onPreviewRow: (index: number) => void
  onBack: () => void
}

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

type Progress = { done: number; total: number }

export default function StepDocuments(props: Props) {
  const { template, mode, rows, pattern } = props
  const [progress, setProgress] = useState<Progress | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const controller = useRef<AbortController | null>(null)
  const running = progress !== null

  const single = prepareValues(template, props.formValues)
  const validRows = rows?.filter((r) => r.problems.length === 0) ?? []
  const unknown = unknownPlaceholders(pattern, template.fields)

  // Runs one generation with progress and cancel; the result is downloaded only if it was not cancelled.
  const run = async (total: number, generate: (opts: { signal: AbortSignal; onProgress: (n: number) => void }) => Promise<[Blob, string]>) => {
    const abort = new AbortController()
    controller.current = abort
    setMessage(null)
    setProgress({ done: 0, total })
    try {
      const [blob, fileName] = await generate({ signal: abort.signal, onProgress: (done) => setProgress({ done, total }) })
      if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      downloadBlob(blob, fileName)
    } catch (e) {
      const cancelled = e instanceof Error && e.name === 'AbortError'
      setMessage({ text: cancelled ? 'Отменено' : (e as Error).message, error: !cancelled })
    } finally {
      controller.current = null
      setProgress(null)
    }
  }

  const downloadPdf = () =>
    run(1, async ({ signal }) => {
      const pdf = await rasterPdfEngine.render([fillTemplate(template.bytes, single.values)], { signal })
      return [pdf, fileNameFor(pattern, single.values, '.pdf')]
    })

  const downloadDocx = () => {
    const bytes = fillTemplate(template.bytes, single.values) as Uint8Array<ArrayBuffer>
    downloadBlob(new Blob([bytes], { type: DOCX_TYPE }), fileNameFor(pattern, single.values, '.docx'))
  }

  const batchItems = (): BatchItem[] => {
    const names = uniqueNames(validRows.map((r) => fileNameFor(pattern, r.values, '.pdf')))
    return validRows.map((r, i) => ({ rowNumber: r.number, fileName: names[i], docx: fillTemplate(template.bytes, r.values) }))
  }

  const downloadZip = () =>
    run(validRows.length, async (opts) => {
      const date = new Date().toISOString().slice(0, 10)
      return [await generateZip(batchItems(), rasterPdfEngine, opts), sanitizeFileName(`${template.name} — ${date}`) + '.zip']
    })

  const downloadMerged = () =>
    run(validRows.length, async (opts) => [
      await generateMergedPdf(batchItems(), rasterPdfEngine, opts),
      sanitizeFileName(`${template.name} — все документы`) + '.pdf',
    ])

  const studentName = (row: CsvRow) => {
    const mapped = template.fields.filter((f) => props.mapping[f] != null)
    return row.values.student_full_name || mapped.map((f) => row.values[f]).find(Boolean) || `Строка ${row.number}`
  }

  return (
    <div className="step-documents">
      <p className="hint">Проверьте документ и скачайте результат.</p>

      {mode === 'single' && (
        <>
          {single.problems.length > 0 && <p className="message warning">Не заполнено: {single.problems.join('; ')}</p>}
          <div className="actions">
            <button className="primary" disabled={single.problems.length > 0 || running} onClick={downloadPdf}>Скачать PDF</button>
            <button disabled={single.problems.length > 0 || running} onClick={downloadDocx}>Скачать DOCX</button>
            <button disabled={single.problems.length > 0 || running} onClick={() => window.print()}>Распечатать</button>
          </div>
        </>
      )}

      {mode === 'group' && rows && (
        <>
          <table className="rows">
            <thead>
              <tr><th>№</th><th>ФИО</th><th>Статус</th></tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.number} className={i === props.previewRow ? 'selected' : undefined} onClick={() => props.onPreviewRow(i)}>
                  <td>{row.number}</td>
                  <td>{studentName(row)}</td>
                  <td className={row.problems.length ? 'bad' : undefined}>{row.problems.length ? row.problems.join('; ') : 'Готово'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="actions">
            <button className="primary" disabled={validRows.length === 0 || running} onClick={downloadZip}>
              Скачать ZIP ({validRows.length} PDF)
            </button>
            <button disabled={validRows.length === 0 || running} onClick={downloadMerged}>Скачать один PDF для печати</button>
          </div>
        </>
      )}

      {progress && (
        <div className="actions">
          <span>{mode === 'group' ? `Готово ${progress.done} из ${progress.total}` : 'Собираем PDF…'}</span>
          <button onClick={() => controller.current?.abort()}>Отменить</button>
        </div>
      )}
      {message && <p className={message.error ? 'message error' : 'message'}>{message.text}</p>}

      <label className="field">
        Имя файла
        <input value={pattern} onChange={(e) => props.onPattern(e.target.value)} />
      </label>
      {unknown.length > 0 && <p className="message warning">Нет такого поля: {unknown.join(', ')}</p>}
      <p className="hint">
        PDF в демо собирается прямо в браузере; в рабочей версии — на сервере через LibreOffice, мелкие отличия вёрстки возможны.
      </p>

      <div className="actions nav">
        <button onClick={props.onBack}>← Назад</button>
      </div>
    </div>
  )
}
