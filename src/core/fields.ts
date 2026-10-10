export const FIELD_LABELS: Record<string, string> = {
  cert_number: 'Исходящий номер',
  issue_date: 'Дата выдачи',
  student_full_name: 'ФИО слушателя',
  birth_date: 'Дата рождения',
  program_name: 'Программа',
  group_name: 'Группа',
  study_form: 'Форма обучения',
  study_start_date: 'Начало обучения',
  study_end_date: 'Окончание обучения',
  study_duration: 'Продолжительность программы',
  hours_per_week: 'Часов в неделю',
  destination: 'Для предъявления (куда)',
  signer_position: 'Должность подписанта',
  signer_full_name: 'ФИО подписанта',
  manager_full_name: 'Исполнитель (ФИО)',
  manager_phone: 'Телефон исполнителя',
}

export type FieldSettings = { fields: string[]; labels: Record<string, string>; optional: string[] }

/** Reads a user-chosen key without falling through to Object.prototype (`constructor`, `toString`, …). */
export function ownValue(record: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

export function defaultLabel(field: string): string {
  return ownValue(FIELD_LABELS, field) ?? field
}

/** The template's label for the field, or the default one when it was cleared. */
export function fieldLabel(labels: Record<string, string>, field: string): string {
  return ownValue(labels, field)?.trim() || defaultLabel(field)
}

export function isDateField(field: string): boolean {
  return /_date$/.test(field)
}

/** Accepts D.M.YYYY, DD.MM.YYYY and YYYY-MM-DD; returns DD.MM.YYYY for a real calendar date, else null. */
export function normalizeDate(input: string): string | null {
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  const [day, month, year] = dotted ? [dotted[1], dotted[2], dotted[3]] : iso ? [iso[3], iso[2], iso[1]] : []
  if (!day) return null
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${year}`
}

export function prepareValues(
  settings: FieldSettings,
  raw: Record<string, string>,
): { values: Record<string, string>; problems: string[] } {
  const values: Record<string, string> = {}
  const empty: string[] = []
  const badDates: string[] = []
  for (const field of settings.fields) {
    const value = (ownValue(raw, field) ?? '').trim()
    const label = fieldLabel(settings.labels, field)
    values[field] = value
    if (value === '') {
      if (!settings.optional.includes(field)) empty.push(label)
    } else if (isDateField(field)) {
      const date = normalizeDate(value)
      if (date) values[field] = date
      else badDates.push(`${label}: непонятный формат «${value}», нужно ДД.ММ.ГГГГ`)
    }
  }
  const problems = empty.length ? [`Не заполнено: ${empty.join(', ')}`] : []
  return { values, problems: [...problems, ...badDates] }
}
