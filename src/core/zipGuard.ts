export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_ENTRIES = 1000
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024

const NOT_DOCX = 'Это не файл Word (.docx)'
const TOO_COMPLEX = 'Файл слишком сложный для демо: больше 1000 частей или больше 50 МБ после распаковки'

export function uploadSizeError(size: number): string | null {
  return size > MAX_UPLOAD_BYTES ? 'Файл больше 10 МБ — демо принимает файлы до 10 МБ' : null
}

/** Reads the ZIP central directory without decompressing anything. */
export function checkZip(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const inRange = (offset: number, length: number) => offset >= 0 && offset + length <= bytes.length

  // End-of-central-directory record: 22 bytes plus a comment of at most 65535 bytes.
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 65557; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return NOT_DOCX

  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  let total = 0
  let hasDocument = false
  for (let i = 0; i < count; i++) {
    if (!inRange(offset, 46) || view.getUint32(offset, true) !== 0x02014b50) return NOT_DOCX
    const size = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    if (!inRange(offset + 46, nameLength)) return NOT_DOCX
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (name === 'word/document.xml') hasDocument = true
    total += size === 0xffffffff ? MAX_UNCOMPRESSED_BYTES + 1 : size // ZIP64 counts as too large
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (!hasDocument) return NOT_DOCX
  if (count > MAX_ENTRIES || total > MAX_UNCOMPRESSED_BYTES) return TOO_COMPLEX
  return null
}
