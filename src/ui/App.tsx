import { useEffect, useMemo, useRef, useState } from 'react'
import { autoMap, buildRows, decodeCsv, parseCsv, spreadsheetError, type CsvTable, type Mapping } from '../core/csv'
import { createDemoTemplate, demoCsvBytes } from '../core/demo'
import { DEFAULT_PATTERN } from '../core/fileName'
import { prepareValues } from '../core/fields'
import { deleteTemplate, listTemplates, newTemplateRecord, putTemplate, type TemplateRecord } from '../core/storage'
import { inspectTemplate, type TemplateInspection } from '../core/template'
import { checkZip, uploadSizeError } from '../core/zipGuard'
import Header, { type Step } from './Header'
import HowTo from './HowTo'
import Sheet from './Sheet'
import StepData from './StepData'
import StepDocuments from './StepDocuments'
import StepTemplate from './StepTemplate'

// `canPreview`: the file passed the ZIP guard, so the sheet may render it (tag errors included).
export type Upload = { fileName: string; bytes?: Uint8Array; canPreview?: boolean; inspection?: TemplateInspection; error?: string }
export type CsvState = { fileName: string; table: CsvTable }

const HINTS: Record<Step, string> = {
  1: 'Выберите шаблон справки или загрузите свой файл Word.',
  2: 'Заполните поля вручную или загрузите таблицу CSV со списком слушателей.',
  3: 'Проверьте документ и скачайте результат.',
}

export default function App() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [showHelp, setShowHelp] = useState(false)
  const [mode, setMode] = useState<'single' | 'group'>('single')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [upload, setUpload] = useState<Upload | null>(null)
  const [csv, setCsv] = useState<CsvState | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Mapping>({})
  const [pattern, setPattern] = useState(DEFAULT_PATTERN)
  const [previewRow, setPreviewRow] = useState(0)

  useEffect(() => {
    listTemplates().then(setTemplates, () => setTemplates([]))
  }, [])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const selectRecord = (template: TemplateRecord) => {
    setSelectedId(template.id)
    setFormValues({ ...template.defaults })
    if (csv) setMapping(autoMap(template.fields, csv.table.columns))
  }
  const selectTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id)
    if (template) selectRecord(template)
    setUpload(null)
  }

  const updateTemplate = async (template: TemplateRecord) => {
    setTemplates((all) => all.map((t) => (t.id === template.id ? template : t)))
    await putTemplate(template)
  }

  const removeTemplate = async (id: string) => {
    await deleteTemplate(id)
    setTemplates((all) => all.filter((t) => t.id !== id))
    if (id === selectedId) {
      setSelectedId(null)
      setFormValues({})
    }
  }

  const uploadTemplateFile = async (file: File) => {
    const tooBig = uploadSizeError(file.size)
    if (tooBig) return setUpload({ fileName: file.name, error: tooBig })
    if (/\.doc$/i.test(file.name)) {
      return setUpload({ fileName: file.name, error: 'Сохраните документ в формате .docx: Файл → Сохранить как → Документ Word' })
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      setUpload({ fileName: file.name, bytes, canPreview: checkZip(bytes) === null, inspection: inspectTemplate(bytes) })
    } catch {
      setUpload({ fileName: file.name, error: 'Не удалось прочитать файл. Попробуйте выбрать его ещё раз.' })
    }
  }

  const saveUpload = async (name: string) => {
    if (!upload?.bytes || !upload.inspection || upload.inspection.errors.length) return
    const record = newTemplateRecord(name, upload.bytes, upload.inspection.fields)
    await putTemplate(record)
    setTemplates((all) => [...all, record])
    selectRecord(record)
    setUpload(null)
  }

  // The pending promise is shared, so quick repeated clicks cannot create two demo records.
  const demoRequest = useRef<Promise<TemplateRecord> | null>(null)
  const addDemoTemplate = () => {
    demoRequest.current ??= (async () => {
      const record = templates.find((t) => t.isDemo) ?? createDemoTemplate()
      if (!templates.includes(record)) {
        await putTemplate(record)
        setTemplates((all) => [...all, record])
      }
      return record
    })().finally(() => { demoRequest.current = null })
    return demoRequest.current.then((record) => {
      selectRecord(record)
      setUpload(null)
      return record
    })
  }

  const loadCsvBytes = (bytes: Uint8Array, fileName: string, template = selected) => {
    try {
      const table = parseCsv(decodeCsv(bytes))
      setCsv({ fileName, table })
      setCsvError(null)
      if (template) setMapping(autoMap(template.fields, table.columns))
      setPreviewRow(0)
    } catch (error) {
      setCsvError((error as Error).message)
    }
  }

  const uploadCsvFile = async (file: File) => {
    const tooBig = uploadSizeError(file.size)
    if (tooBig) return setCsvError(tooBig)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const workbook = spreadsheetError(file.name, bytes)
      if (workbook) return setCsvError(workbook)
      loadCsvBytes(bytes, file.name)
    } catch {
      setCsvError('Не удалось прочитать файл. Попробуйте выбрать его ещё раз.')
    }
  }

  const startDemo = async () => {
    const record = await addDemoTemplate()
    loadCsvBytes(demoCsvBytes(), 'students_demo.csv', record)
    setMode('group')
    setStep(1)
  }

  // An upload under review must be saved or cancelled before leaving step 1.
  const reviewing = upload?.inspection !== undefined
  const canOpen = {
    1: true,
    2: selected !== null && !reviewing,
    3: selected !== null && !reviewing && (mode === 'single' || csv !== null),
  }

  // Memoized: Sheet re-renders the document whenever the source changes identity.
  const uploadBytes = upload?.canPreview ? upload.bytes : undefined
  const rows = useMemo(
    () => (selected && csv ? buildRows(csv.table, mapping, formValues, selected) : null),
    [selected, csv, mapping, formValues],
  )
  const source = useMemo(() => {
    if (reviewing && step === 1) return uploadBytes ? { bytes: uploadBytes, values: null } : null
    if (!selected) return null
    const raw = { bytes: selected.bytes, values: null }
    if (step === 1) return raw
    if (mode === 'single') return { bytes: selected.bytes, values: prepareValues(selected, formValues).values }
    return rows ? { bytes: selected.bytes, values: rows[previewRow]?.values ?? null } : raw
  }, [reviewing, uploadBytes, selected, step, mode, formValues, rows, previewRow])

  if (showHelp) {
    return (
      <div className="app">
        <Header step={step} canOpen={canOpen} onStep={(s) => { setStep(s); setShowHelp(false) }} onHelp={() => setShowHelp(true)} />
        <HowTo onBack={() => setShowHelp(false)} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header step={step} canOpen={canOpen} onStep={setStep} onHelp={() => setShowHelp(true)} />
      <div className="workspace">
        <aside className="panel">
          {step === 1 ? (
            <StepTemplate
              templates={templates}
              selectedId={selectedId}
              upload={upload}
              onSelect={selectTemplate}
              onUpdate={updateTemplate}
              onDelete={removeTemplate}
              onUploadFile={uploadTemplateFile}
              onCancelUpload={() => setUpload(null)}
              onSaveUpload={saveUpload}
              onAddDemo={addDemoTemplate}
              onStartDemo={startDemo}
              onSetDefault={(field, value) => setFormValues((v) => ({ ...v, [field]: value }))}
              onNext={() => setStep(2)}
            />
          ) : step === 2 && selected ? (
            <StepData
              template={selected}
              mode={mode}
              formValues={formValues}
              csv={csv}
              csvError={csvError}
              mapping={mapping}
              onMode={setMode}
              onValue={(field, value) => setFormValues((v) => ({ ...v, [field]: value }))}
              onCsvFile={uploadCsvFile}
              onDemoCsv={() => loadCsvBytes(demoCsvBytes(), 'students_demo.csv')}
              onMap={(field, column) => setMapping((m) => ({ ...m, [field]: column }))}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          ) : step === 3 && selected ? (
            <StepDocuments
              template={selected}
              mode={mode}
              formValues={formValues}
              rows={rows}
              mapping={mapping}
              pattern={pattern}
              previewRow={previewRow}
              onPattern={setPattern}
              onPreviewRow={setPreviewRow}
              onBack={() => setStep(2)}
            />
          ) : (
            <StepPanel step={step} />
          )}
        </aside>
        <section className="desk">
          <Sheet source={source} />
        </section>
      </div>
    </div>
  )
}

// Fallback panel while no template is selected.
function StepPanel(props: { step: Step }) {
  return <p className="hint">{HINTS[props.step]}</p>
}
