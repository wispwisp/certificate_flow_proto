import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateMergedPdf, generateZip, type BatchItem } from './batch'
import type { RenderOptions } from './pdf/engine'

// Reports one finished document, then fails with 'boom' on the given call.
const stubEngine = (failOnCall?: number) => {
  const engine = {
    calls: 0,
    async render(docs: Uint8Array[], opts?: RenderOptions) {
      engine.calls++
      opts?.onProgress?.(1)
      if (engine.calls === failOnCall) throw new Error('boom')
      return new Blob([`%PDF-stub ${docs.length}`])
    },
  }
  return engine
}
const items: BatchItem[] = [
  { rowNumber: 1, fileName: 'a.pdf', docx: new Uint8Array([1]) },
  { rowNumber: 5, fileName: 'Сейтқали.pdf', docx: new Uint8Array([2]) },
  { rowNumber: 7, fileName: 'c.pdf', docx: new Uint8Array([3]) },
]

describe('batch', () => {
  it('zips one PDF per item, in order, reporting progress', async () => {
    const progress: number[] = []
    const zip = await JSZip.loadAsync(await (await generateZip(items, stubEngine(), { onProgress: (n) => progress.push(n) })).arrayBuffer())
    expect(Object.keys(zip.files)).toEqual(['a.pdf', 'Сейтқали.pdf', 'c.pdf'])
    expect(await zip.file('c.pdf')!.async('string')).toBe('%PDF-stub 1')
    expect(progress).toEqual([1, 2, 3])
  })
  it('zip entry names keep Cyrillic and Kazakh letters', async () => {
    const zip = await JSZip.loadAsync(await (await generateZip([items[1]], stubEngine())).arrayBuffer())
    expect(zip.file('Сейтқали.pdf')).not.toBeNull()
  })
  it('stops on cancel', async () => {
    const engine = stubEngine(); const ctrl = new AbortController()
    await expect(generateZip(items, engine, { signal: ctrl.signal, onProgress: () => ctrl.abort() }))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(engine.calls).toBe(1)
  })
  it('names the failing row', async () => {
    await expect(generateZip(items, stubEngine(2))).rejects.toThrow('Не удалось сделать PDF для строки 5: boom')
    await expect(generateMergedPdf(items, stubEngine(1))).rejects.toThrow('Не удалось сделать PDF для строки 5: boom')
  })
  it('merges all items with one render call', async () => {
    const engine = stubEngine()
    expect(await (await generateMergedPdf(items, engine)).text()).toBe('%PDF-stub 3')
    expect(engine.calls).toBe(1)
  })
})
