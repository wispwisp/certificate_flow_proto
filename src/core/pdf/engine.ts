export type RenderOptions = { signal?: AbortSignal; onProgress?: (done: number) => void }

/**
 * Renders the documents, in order, into one PDF. The in-browser raster engine implements it today;
 * a future server-side converter can replace it by implementing the same interface.
 */
export interface PdfEngine {
  render(docs: Uint8Array[], opts?: RenderOptions): Promise<Blob>
}
