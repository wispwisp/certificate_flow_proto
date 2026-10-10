import PizZip from 'pizzip'
import { sampleDocx } from './samples'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const paras = (texts: string[]) =>
  texts.length === 0
    ? '<w:p/>'
    : texts.map((t) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r></w:p>`).join('')

/** Builds a DOCX from the sample's package, replacing the body, header and footer with plain paragraphs. */
export function makeDocx(parts: { body: string[]; header?: string[]; footer?: string[] }): Uint8Array {
  const zip = new PizZip(sampleDocx())
  const sectPr = zip.file('word/document.xml')!.asText().match(/<w:sectPr[\s\S]*<\/w:sectPr>/)?.[0] ?? ''
  zip.file('word/document.xml',
    `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${paras(parts.body)}${sectPr}</w:body></w:document>`)
  zip.file('word/header1.xml', `<w:hdr xmlns:w="${W}">${paras(parts.header ?? [])}</w:hdr>`)
  zip.file('word/footer1.xml', `<w:ftr xmlns:w="${W}">${paras(parts.footer ?? [])}</w:ftr>`)
  return zip.generate({ type: 'uint8array' })
}
