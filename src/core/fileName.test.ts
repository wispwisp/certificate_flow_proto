import { describe, it, expect } from 'vitest'
import { DEFAULT_PATTERN, fileNameFor, sanitizeFileName, unknownPlaceholders, uniqueNames } from './fileName'

describe('fileName', () => {
  const row5 = { cert_number: '2026/0416', student_full_name: 'Сейтқали Әлихан Ерланұлы' }
  it('fills the default pattern and keeps Cyrillic and Kazakh letters', () => {
    expect(fileNameFor(DEFAULT_PATTERN, row5, '.pdf')).toBe('2026_0416_Сейтқали Әлихан Ерланұлы.pdf')
    expect(fileNameFor(DEFAULT_PATTERN, row5, '.docx')).toBe('2026_0416_Сейтқали Әлихан Ерланұлы.docx')
  })
  it('sanitizes names', () => {
    expect(sanitizeFileName('a<b>:c"d|e?f*g\\h')).toBe('a_b__c_d_e_f_g_h')
    expect(sanitizeFileName('  many   spaces  ')).toBe('many spaces')
    expect(sanitizeFileName('name...')).toBe('name')
    expect(sanitizeFileName('')).toBe('document')
    expect(sanitizeFileName('x'.repeat(300))).toHaveLength(150)
  })
  it('reports unknown placeholders and leaves them empty', () => {
    expect(unknownPlaceholders('{cert_number}_{nme}.pdf', ['cert_number'])).toEqual(['nme'])
    expect(fileNameFor('{nme}_x', {}, '.pdf')).toBe('_x.pdf')
  })
  it('de-duplicates names case-insensitively', () =>
    expect(uniqueNames(['a.pdf', 'A.pdf', 'a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'A (2).pdf', 'a (3).pdf', 'b.pdf']))
})
