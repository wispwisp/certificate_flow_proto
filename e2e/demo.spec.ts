import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import JSZip from 'jszip'

test.setTimeout(120_000)

test('demo group: 7 one-page PDFs, row 8 invalid, Tinos only, no requests after load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/certificate_flow_proto/', { waitUntil: 'load' })
  const requests: string[] = []
  page.on('request', (r) => { if (/^https?:/.test(r.url())) requests.push(r.url()) })

  await page.getByRole('button', { name: 'Загрузить демо-шаблон' }).click()
  await page.getByRole('button', { name: '② Данные' }).click()
  await page.getByRole('radio', { name: 'Группа из CSV' }).check()
  await page.getByRole('button', { name: 'Загрузить демо-данные' }).click()
  await page.getByRole('button', { name: '③ Документы' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Омарова Камила Руслановна' }))
    .toContainText('Не заполнено: Дата рождения')

  const readDownload = async (name: RegExp) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
    return readFile((await dl.path())!)
  }
  const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length

  const zip = await JSZip.loadAsync(await readDownload(/Скачать ZIP/))
  const pdfs = Object.values(zip.files).filter((f) => f.name.endsWith('.pdf'))
  expect(pdfs).toHaveLength(7)
  for (const f of pdfs) {
    const bytes = await f.async('nodebuffer')
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(pageCount(bytes)).toBe(1)
  }
  expect(pageCount(await readDownload(/Скачать один PDF для печати/))).toBe(7)

  await page.getByRole('row').filter({ hasText: 'Сейтқали Әлихан Ерланұлы' }).click()
  const sheet = page.getByTestId('sheet')
  await expect(sheet).toContainText('Сейтқали Әлихан Ерланұлы')
  await page.evaluate(() => document.fonts.ready)
  await sheet.locator('span').filter({ hasText: 'Сейтқали' }).last().evaluate((el) => el.setAttribute('data-kz', ''))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-kz]' })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(new Set(fonts.map((f) => f.familyName))).toEqual(new Set(['Tinos']))

  expect(requests).toEqual([])
  expect(errors).toEqual([])
})
