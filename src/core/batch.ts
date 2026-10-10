import JSZip from 'jszip'
import type { PdfEngine, RenderOptions } from './pdf/engine'

export type BatchItem = { rowNumber: number; fileName: string; docx: Uint8Array }

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError'

function rowError(rowNumber: number, e: unknown): Error {
  if (isAbort(e)) return e as Error
  const message = e instanceof Error ? e.message : String(e)
  return new Error(`Не удалось сделать PDF для строки ${rowNumber}: ${message}`)
}

export async function generateZip(items: BatchItem[], engine: PdfEngine, opts: RenderOptions = {}): Promise<Blob> {
  const zip = new JSZip()
  for (const [i, item] of items.entries()) {
    opts.signal?.throwIfAborted()
    try {
      const pdf = await engine.render([item.docx], { signal: opts.signal })
      zip.file(item.fileName, await pdf.arrayBuffer())
    } catch (e) {
      throw rowError(item.rowNumber, e)
    }
    opts.onProgress?.(i + 1)
  }
  return new Blob([(await zip.generateAsync({ type: 'uint8array' })) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export async function generateMergedPdf(items: BatchItem[], engine: PdfEngine, opts: RenderOptions = {}): Promise<Blob> {
  let done = 0
  try {
    return await engine.render(items.map((i) => i.docx), {
      signal: opts.signal,
      onProgress: (n) => { done = n; opts.onProgress?.(n) },
    })
  } catch (e) {
    // The engine reports finished documents, so the failing one is the next.
    throw rowError(items[Math.min(done, items.length - 1)].rowNumber, e)
  }
}
