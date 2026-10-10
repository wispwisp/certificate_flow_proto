import { describe, expect, it } from 'vitest'
import PizZip from 'pizzip'
import { checkZip, uploadSizeError } from './zipGuard'
import { sampleDocx } from './testing/samples'

describe('zipGuard', () => {
  it('accepts the sample template', () => expect(checkZip(sampleDocx())).toBeNull())
  it('rejects bytes that are not a ZIP', () =>
    expect(checkZip(new TextEncoder().encode('not a zip'))).toBe('Это не файл Word (.docx)'))
  it('rejects a ZIP without word/document.xml', () => {
    const zip = new PizZip(); zip.file('a.txt', 'x')
    expect(checkZip(zip.generate({ type: 'uint8array' }))).toBe('Это не файл Word (.docx)')
  })
  it('rejects more than 1000 entries', () => {
    const zip = new PizZip(); zip.file('word/document.xml', '<x/>')
    for (let i = 0; i < 1000; i++) zip.file(`f${i}.txt`, '')
    expect(checkZip(zip.generate({ type: 'uint8array' }))).toMatch(/слишком сложный/)
  })
  it('rejects more than 50 MB uncompressed', () => {
    const zip = new PizZip(); zip.file('word/document.xml', new Uint8Array(51 * 1024 * 1024))
    expect(checkZip(zip.generate({ type: 'uint8array', compression: 'DEFLATE' }))).toMatch(/слишком сложный/)
  })
  it('limits uploads to 10 MB', () => {
    expect(uploadSizeError(10 * 1024 * 1024)).toBeNull()
    expect(uploadSizeError(10 * 1024 * 1024 + 1)).toBe('Файл больше 10 МБ — демо принимает файлы до 10 МБ')
  })
})
