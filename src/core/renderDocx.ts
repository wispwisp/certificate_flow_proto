import { renderAsync } from 'docx-preview'

/**
 * Renders the DOCX into the container (replacing its content) and returns the page sections. Links and
 * non-inline images are stripped so the rendered document never triggers a network request.
 */
export async function renderDocx(bytes: Uint8Array, container: HTMLElement): Promise<HTMLElement[]> {
  container.replaceChildren()
  await renderAsync(bytes, container, container, {
    inWrapper: true,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    experimental: true,
    useBase64URL: true,
  })
  for (const el of container.querySelectorAll('[href]')) el.removeAttribute('href')
  for (const img of container.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? ''
    if (!src.startsWith('data:') && !src.startsWith('blob:')) img.removeAttribute('src')
  }
  const sections = [...container.querySelectorAll<HTMLElement>('section.docx')]
  // docx-preview hyphenates every document, while Word does so only on request; html2canvas also misplaces the
  // letters around an automatic hyphen. Line breaks at word boundaries keep the preview and the PDF identical.
  for (const section of sections) section.style.hyphens = 'manual'
  return sections
}
