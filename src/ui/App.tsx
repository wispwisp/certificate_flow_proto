import { useEffect, useMemo, useRef, useState } from 'react'
import { autoMap, decodeCsv, parseCsv, type CsvTable, type Mapping } from '../core/csv'
import { createDemoTemplate, demoCsvBytes } from '../core/demo'
import { DEFAULT_PATTERN } from '../core/fileName'
import { deleteTemplate, listTemplates, newTemplateRecord, putTemplate, type TemplateRecord } from '../core/storage'
import { inspectTemplate, type TemplateInspection } from '../core/template'
import { checkZip, uploadSizeError } from '../core/zipGuard'
import Header, { type Step } from './Header'
import HowTo from './HowTo'
import Sheet from './Sheet'
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

  const startDemo = async () => {
    const record = await addDemoTemplate()
    loadCsvBytes(demoCsvBytes(), 'students_demo.csv', record)
    setMode('group')
    setStep(1)
  }

  // Read by steps ② and ③ (Tasks 8-9); referenced here so strict unused checks pass until then.
  void [csvError, mapping, pattern, setPattern, previewRow]

  const canOpen = { 1: true, 2: selected !== null, 3: selected !== null && (mode === 'single' || csv !== null) }

  // Memoized: Sheet re-renders the document whenever the source changes identity.
  const uploadBytes = upload?.canPreview ? upload.bytes : undefined
  const reviewing = upload?.inspection !== undefined
  const source = useMemo(
    () => reviewing
      ? uploadBytes ? { bytes: uploadBytes, values: null } : null
      : selected ? { bytes: selected.bytes, values: step === 1 ? null : formValues } : null,
    [reviewing, uploadBytes, selected, step, formValues],
  )

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

// Placeholder: Tasks 8-9 replace it with the step ② and ③ panels.
function StepPanel(props: { step: Step }) {
  return <p className="hint">{HINTS[props.step]}</p>
}
