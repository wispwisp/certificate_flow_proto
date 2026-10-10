import { isDateField } from '../core/fields'

type Props = { field: string; label: string; value: string; optional: boolean; onChange: (value: string) => void }

export default function FieldInput({ field, label, value, optional, onChange }: Props) {
  return (
    <label className="field">
      {optional ? `${label} (необязательно)` : label}
      <input type={isDateField(field) ? 'date' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
