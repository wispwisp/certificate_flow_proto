import { describe, expect, it } from 'vitest'
import { defaultLabel, fieldLabel, isDateField, normalizeDate, prepareValues } from './fields'

const settings = {
  fields: ['student_full_name', 'birth_date', 'group_name', 'note'],
  labels: { student_full_name: 'ФИО слушателя', birth_date: 'Дата рождения', group_name: 'Группа', note: 'note' },
  optional: ['note'],
}

describe('fields', () => {
  it('labels known fields and falls back to the raw name', () => {
    expect(defaultLabel('student_full_name')).toBe('ФИО слушателя')
    expect(defaultLabel('manager_phone')).toBe('Телефон исполнителя')
    expect(defaultLabel('custom_field')).toBe('custom_field')
  })
  it('detects date fields by the _date suffix', () => {
    expect(isDateField('birth_date')).toBe(true)
    expect(isDateField('date_of_birth')).toBe(false)
  })
  it('normalizes accepted date formats to DD.MM.YYYY', () => {
    expect(normalizeDate('14.03.2008')).toBe('14.03.2008')
    expect(normalizeDate('4.3.2008')).toBe('04.03.2008')
    expect(normalizeDate('2008-03-14')).toBe('14.03.2008')
  })
  it('rejects unknown formats and impossible dates', () => {
    expect(normalizeDate('14/03/2008')).toBeNull()
    expect(normalizeDate('31.02.2026')).toBeNull()
    expect(normalizeDate('2026-13-01')).toBeNull()
  })
  it('trims values, formats dates and reports empty required fields', () => {
    const r = prepareValues(settings, { student_full_name: '  Ким Алина ', birth_date: '2007-11-27', group_name: ' ' })
    expect(r.values).toEqual({ student_full_name: 'Ким Алина', birth_date: '27.11.2007', group_name: '', note: '' })
    expect(r.problems).toEqual(['Не заполнено: Группа'])
  })
  it('combines empty fields into one problem, then lists bad dates', () => {
    expect(prepareValues(settings, {}).problems).toEqual(['Не заполнено: ФИО слушателя, Дата рождения, Группа'])
    const bad = prepareValues(settings, { student_full_name: 'Ким', birth_date: '27/11/2007', group_name: 'РПО-241' })
    expect(bad.problems).toEqual(['Дата рождения: непонятный формат «27/11/2007», нужно ДД.ММ.ГГГГ'])
    expect(bad.values.birth_date).toBe('27/11/2007')
  })
  it('falls back to the default label when a label is cleared', () => {
    const cleared = { ...settings, labels: { ...settings.labels, student_full_name: ' ', birth_date: '' } }
    expect(fieldLabel(cleared.labels, 'student_full_name')).toBe('ФИО слушателя')
    expect(fieldLabel(cleared.labels, 'group_name')).toBe('Группа')
    expect(fieldLabel({}, 'custom_field')).toBe('custom_field')
    expect(prepareValues(cleared, {}).problems).toEqual(['Не заполнено: ФИО слушателя, Дата рождения, Группа'])
  })
  it('treats Object.prototype names such as constructor as ordinary fields', () => {
    expect(defaultLabel('constructor')).toBe('constructor')
    expect(fieldLabel({}, 'constructor')).toBe('constructor')
    const s = { fields: ['constructor', 'toString'], labels: {}, optional: [] }
    expect(prepareValues(s, {})).toEqual({ values: { constructor: '', toString: '' }, problems: ['Не заполнено: constructor, toString'] })
    expect(prepareValues(s, { constructor: ' x ', toString: 'y' }).values).toEqual({ constructor: 'x', toString: 'y' })
  })
})
