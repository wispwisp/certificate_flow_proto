import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { renderDocx } from '../renderDocx'
import type { PdfEngine } from './engine'

const PX_TO_PT = 0.75

/** Captures every rendered page as a JPEG and places it full-page into one PDF. */
export const rasterPdfEngine: PdfEngine = {
  async render(docs, { signal, onProgress } = {}) {
    // Off-screen but laid out: html2canvas cannot capture `display: none`.
    const container = document.createElement('div')
    container.style.cssText = 'position: fixed; left: -100000px; top: 0'
    document.body.append(container)
    try {
      let pdf: jsPDF | undefined
      for (const [i, doc] of docs.entries()) {
        const sections = await renderDocx(doc, container)
        void container.offsetHeight // force layout so the fonts the page needs start loading before we wait for them
        await document.fonts.ready
        for (const section of sections) {
          signal?.throwIfAborted()
          const canvas = await html2canvas(section, { scale: 3, backgroundColor: '#ffffff', logging: false })
          const rect = section.getBoundingClientRect()
          const w = rect.width * PX_TO_PT
          const h = rect.height * PX_TO_PT
          const orientation = w > h ? 'landscape' : 'portrait'
          if (pdf) pdf.addPage([w, h], orientation)
          else pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation })
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h)
          canvas.width = canvas.height = 0
        }
        container.replaceChildren()
        onProgress?.(i + 1)
      }
      return pdf!.output('blob')
    } finally {
      container.remove()
    }
  },
}
