import { useEffect, useState } from 'react'
import { autoMap, type CsvTable, type Mapping } from '../core/csv'
import { DEFAULT_PATTERN } from '../core/fileName'
import { listTemplates, type TemplateRecord } from '../core/storage'
import type { TemplateInspection } from '../core/template'
import Header, { type Step } from './Header'
import HowTo from './HowTo'
import Sheet from './Sheet'

export type Upload = { fileName: string; bytes?: Uint8Array; inspection?: TemplateInspection; error?: string }
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

  // Called by the step panels (Tasks 7-9).
  const selectTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id)
    if (!template) return
    setSelectedId(id)
    setFormValues({ ...template.defaults })
    if (csv) setMapping(autoMap(template.fields, csv.table.columns))
  }
  const state = {
    templates, setTemplates, selectTemplate, mode, setMode, formValues, setFormValues, upload, setUpload,
    csv, setCsv, csvError, setCsvError, mapping, setMapping, pattern, setPattern, previewRow, setPreviewRow,
  }

  const canOpen = { 1: true, 2: selected !== null, 3: selected !== null && (mode === 'single' || csv !== null) }

  if (showHelp) {
    return (
      <div className="app">
        <Header step={step} canOpen={canOpen} onStep={(s) => { setStep(s); setShowHelp(false) }} onHelp={() => setShowHelp(true)} />
        <HowTo onBack={() => setShowHelp(false)} />
      </div>
    )
  }

  const source = upload?.bytes
    ? { bytes: upload.bytes, values: null }
    : selected ? { bytes: selected.bytes, values: step === 1 ? null : formValues } : null

  return (
    <div className="app">
      <Header step={step} canOpen={canOpen} onStep={setStep} onHelp={() => setShowHelp(true)} />
      <div className="workspace">
        <aside className="panel">
          <StepPanel step={step} state={state} />
        </aside>
        <section className="desk">
          <Sheet source={source} />
        </section>
      </div>
    </div>
  )
}

// Placeholder: Tasks 7-9 replace it with the three step panels, which take `state`.
function StepPanel(props: { step: Step; state: object }) {
  return <p className="hint">{HINTS[props.step]}</p>
}
