import type { Mapping } from '../core/csv'
import type { TemplateRecord } from '../core/storage'
import type { CsvState } from './App'
import DropZone from './DropZone'
import FieldInput from './FieldInput'
import { plural } from './plural'

type Props = {
  template: TemplateRecord
  mode: 'single' | 'group'
  formValues: Record<string, string>
  csv: CsvState | null
  csvError: string | null
  mapping: Mapping
  onMode: (mode: 'single' | 'group') => void
  onValue: (field: string, value: string) => void
  onCsvFile: (file: File) => void
  onDemoCsv: () => void
  onMap: (field: string, column: string | null) => void
  onBack: () => void
  onNext: () => void
}

export default function StepData(props: Props) {
  const { template, mode, formValues, csv, csvError, mapping } = props
  const input = (field: string) => (
    <FieldInput
      key={field}
      field={field}
      label={template.labels[field]}
      value={formValues[field] ?? ''}
      optional={template.optional.includes(field)}
      onChange={(value) => props.onValue(field, value)}
    />
  )
  const shared = template.fields.filter((f) => mapping[f] == null)
  const unused = csv ? csv.table.columns.filter((c) => !Object.values(mapping).includes(c)) : []

  return (
    <div className="step-data">
      <p className="hint">Заполните поля вручную или загрузите таблицу CSV со списком слушателей.</p>
      <div className="modes">
        <label className="check">
          <input type="radio" name="mode" checked={mode === 'single'} onChange={() => props.onMode('single')} />
          Один документ
        </label>
        <label className="check">
          <input type="radio" name="mode" checked={mode === 'group'} onChange={() => props.onMode('group')} />
          Группа из CSV
        </label>
      </div>

      {mode === 'single' && template.fields.map(input)}

      {mode === 'group' && (
        <>
          <DropZone accept=".csv,text/csv" label="Перетащите файл CSV сюда или выберите его" onFile={props.onCsvFile} />
          <div className="actions">
            <button onClick={props.onDemoCsv}>Загрузить демо-данные</button>
          </div>
          {csvError && <p className="message error">{csvError}</p>}
          {csv && (
            <>
              <p>
                {csv.fileName}: {plural(csv.table.rows.length, ['строка', 'строки', 'строк'])},{' '}
                {plural(csv.table.columns.length, ['столбец', 'столбца', 'столбцов'])}
              </p>
              <h3>Столбцы</h3>
              {template.fields.map((field) => (
                <label key={field} className="field">
                  {template.labels[field]}
                  <select value={mapping[field] ?? ''} onChange={(e) => props.onMap(field, e.target.value || null)}>
                    <option value="">— общее значение —</option>
                    {csv.table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ))}
              {shared.length > 0 && <h3>Общие значения</h3>}
              {shared.map(input)}
              {unused.length > 0 && <p className="hint">Не используются: {unused.join(', ')}</p>}
            </>
          )}
        </>
      )}

      <div className="actions nav">
        <button onClick={props.onBack}>← Назад</button>
        <button className="primary next" disabled={mode === 'group' && !csv} onClick={props.onNext}>Далее →</button>
      </div>
    </div>
  )
}
