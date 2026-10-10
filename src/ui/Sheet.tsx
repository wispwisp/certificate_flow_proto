import { useEffect, useRef, useState } from 'react'
import { fillTemplate } from '../core/template'
import { renderDocx } from '../core/renderDocx'

export type SheetSource = { bytes: Uint8Array; values: Record<string, string> | null }

const RENDER_DELAY_MS = 300
const DESK_PADDING = 48

/** The document as a sheet of paper. `values: null` shows the raw template; `source: null` a blank sheet. */
export default function Sheet({ source }: { source: SheetSource | null }) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [deskWidth, setDeskWidth] = useState(0)
  const [sectionWidth, setSectionWidth] = useState(0)

  useEffect(() => {
    const desk = sheetRef.current?.parentElement
    if (!desk) return
    const observer = new ResizeObserver(() => setDeskWidth(desk.clientWidth))
    observer.observe(desk)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!source || !sheet) return
    let stale = false
    const timer = setTimeout(async () => {
      try {
        const bytes = source.values ? fillTemplate(source.bytes, source.values) : source.bytes
        const sections = await renderDocx(bytes, sheet)
        if (stale) return
        setError(null)
        setSectionWidth(sections[0]?.offsetWidth ?? 0)
      } catch (e) {
        if (stale) return
        sheet.replaceChildren()
        setError(`Не удалось показать документ: ${e instanceof Error ? e.message : String(e)}`)
      }
    }, RENDER_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [source])

  const zoom = sectionWidth && deskWidth ? Math.min(1, (deskWidth - DESK_PADDING) / sectionWidth) : 1
  return (
    <>
      {error && <p className="sheet-error">{error}</p>}
      {/* The key makes React drop the blank sheet's text before docx-preview takes over the element. */}
      <div key={source ? 'doc' : 'blank'} ref={sheetRef} className={source ? 'sheet' : 'sheet blank'} data-testid="sheet" style={{ zoom }}>
        {!source && <p>Здесь появится документ: выберите шаблон слева</p>}
      </div>
    </>
  )
}
