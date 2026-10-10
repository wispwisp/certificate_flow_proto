import { useState } from 'react'
import { defaultLabel, isDateField } from '../core/fields'
import type { TemplateRecord } from '../core/storage'
import DropZone from './DropZone'
import { plural } from './plural'
import type { Upload } from './App'

type Props = {
  templates: TemplateRecord[]
  selectedId: string | null
  upload: Upload | null
  onSelect: (id: string) => void
  onUpdate: (template: TemplateRecord) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUploadFile: (file: File) => void
  onCancelUpload: () => void
  onSaveUpload: (name: string) => Promise<void>
  onAddDemo: () => Promise<unknown>
  onStartDemo: () => Promise<void>
  onSetDefault: (field: string, value: string) => void
  onNext: () => void
}

const STORAGE_ERROR = 'Браузер не дал сохранить шаблон. Попробуйте обычное, не приватное окно.'

export default function StepTemplate(props: Props) {
  const { templates, selectedId, upload, onSelect } = props
  const selected = templates.find((t) => t.id === selectedId) ?? null
  const [storageError, setStorageError] = useState(false)

  // Runs a storage action; a failure shows the message next to the buttons.
  const guard = (action: () => Promise<unknown>) => async () => {
    try {
      await action()
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  return (
    <div className="step-template">
      <p className="hint">Выберите шаблон справки или загрузите свой файл Word.</p>
      <div className="actions">
        <button className={templates.length === 0 ? 'primary big' : 'primary'} onClick={guard(props.onStartDemo)}>
          Попробовать на примере
        </button>
        <button onClick={guard(props.onAddDemo)}>Загрузить демо-шаблон</button>
      </div>
      {storageError && <p className="message error">{STORAGE_ERROR}</p>}

      {templates.length > 0 && (
        <ul className="library">
          {templates.map((t) => (
            <TemplateItem
              key={t.id}
              template={t}
              selected={t.id === selectedId}
              onSelect={() => onSelect(t.id)}
              onRename={(name) => guard(() => props.onUpdate({ ...t, name }))()}
              onDelete={() => {
                if (confirm(`Удалить шаблон «${t.name}»?`)) guard(() => props.onDelete(t.id))()
              }}
            />
          ))}
        </ul>
      )}

      {upload?.error && <p className="message error">{upload.error}</p>}
      {upload?.inspection ? (
        <Review key={upload.fileName} upload={upload} onCancel={props.onCancelUpload} onSave={(name) => guard(() => props.onSaveUpload(name))()} />
      ) : (
        <DropZone accept=".docx" label="Перетащите файл Word (.docx) сюда или выберите его" onFile={props.onUploadFile} />
      )}

      {selected && !upload?.inspection && <FieldSettings template={selected} onUpdate={props.onUpdate} onSetDefault={props.onSetDefault} />}

      <button className="primary next" disabled={!selected} onClick={props.onNext}>Далее →</button>
    </div>
  )
}

type ItemProps = {
  template: TemplateRecord
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

function TemplateItem({ template, selected, onSelect, onRename, onDelete }: ItemProps) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    const finish = () => {
      if (draft.trim()) onRename(draft.trim())
      setDraft(null)
    }
    return (
      <li className="item">
        <input
          aria-label="Название шаблона"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') setDraft(null) }}
        />
        <button onClick={finish}>Сохранить</button>
        <button onClick={() => setDraft(null)}>Отмена</button>
      </li>
    )
  }
  return (
    <li className={selected ? 'item selected' : 'item'}>
      <button className="pick" aria-pressed={selected} onClick={onSelect}>
        {template.name} · {plural(template.fields.length, ['поле', 'поля', 'полей'])}
      </button>
      <button onClick={() => setDraft(template.name)}>Переименовать</button>
      <button onClick={onDelete}>Удалить</button>
    </li>
  )
}

type ReviewProps = { upload: Upload; onCancel: () => void; onSave: (name: string) => void }

function Review({ upload, onCancel, onSave }: ReviewProps) {
  const { fileName, inspection } = upload
  const [name, setName] = useState(fileName.replace(/\.docx$/i, ''))
  if (!inspection) return null
  const { fields, warnings, errors } = inspection
  return (
    <div className="review">
      <h3>{fileName}</h3>
      {errors.map((e) => <p key={e} className="message error">{e}</p>)}
      {warnings.map((w) => <p key={w} className="message warning">{w}</p>)}
      {errors.length === 0 && (
        <>
          <p>Найдено {plural(fields.length, ['поле', 'поля', 'полей'])}:</p>
          <ul className="found">
            {fields.map((f) => <li key={f}>{defaultLabel(f)} <code>{f}</code></li>)}
          </ul>
          <label className="field">
            Название шаблона
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </>
      )}
      <div className="actions">
        {errors.length === 0 && <button className="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Сохранить в библиотеку</button>}
        <button onClick={onCancel}>Отмена</button>
      </div>
    </div>
  )
}

type SettingsProps = {
  template: TemplateRecord
  onUpdate: (template: TemplateRecord) => Promise<void>
  onSetDefault: (field: string, value: string) => void
}

function FieldSettings({ template, onUpdate, onSetDefault }: SettingsProps) {
  // Settings are saved on every change; a storage failure here is not surfaced, the next action will show it.
  const save = (changes: Partial<TemplateRecord>) => { onUpdate({ ...template, ...changes }).catch(() => {}) }
  return (
    <details className="settings">
      <summary>Настроить поля</summary>
      {template.fields.map((field) => (
        <div key={field} className="setting">
          <label className="field">
            Название поля {field}
            <input
              value={template.labels[field] ?? ''}
              onChange={(e) => save({ labels: { ...template.labels, [field]: e.target.value } })}
            />
          </label>
          <label className="field">
            Значение по умолчанию ({template.labels[field]})
            <input
              type={isDateField(field) ? 'date' : 'text'}
              value={template.defaults[field] ?? ''}
              onChange={(e) => {
                save({ defaults: { ...template.defaults, [field]: e.target.value } })
                onSetDefault(field, e.target.value)
              }}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={template.optional.includes(field)}
              onChange={(e) => save({
                optional: e.target.checked ? [...template.optional, field] : template.optional.filter((f) => f !== field),
              })}
            />
            необязательное
          </label>
        </div>
      ))}
    </details>
  )
}
