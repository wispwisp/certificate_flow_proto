import { describe, expect, it } from 'vitest'
import { plural } from './plural'

const rows = ['строка', 'строки', 'строк'] as [string, string, string]

describe('plural', () => {
  it('picks Russian plural forms', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25].map((n) => plural(n, rows))).toEqual(
      ['1 строка', '2 строки', '5 строк', '11 строк', '12 строк', '21 строка', '22 строки', '25 строк'])
  })
})
