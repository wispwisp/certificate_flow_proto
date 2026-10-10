import { useRef, useState } from 'react'

type Props = { accept: string; label: string; onFile: (file: File) => void }

/** Click to pick a file, or drop one on the zone. */
export default function DropZone({ accept, label, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | undefined) => {
    if (file) onFile(file)
    if (input.current) input.current.value = '' // allow choosing the same file again
  }

  return (
    <div
      className={over ? 'dropzone over' : 'dropzone'}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]) }}
    >
      {label}
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  )
}
