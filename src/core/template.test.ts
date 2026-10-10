import { describe, expect, it } from 'vitest'
import PizZip from 'pizzip'
import { fillTemplate, inspectTemplate } from './template'
import { makeDocx } from './testing/makeDocx'
import { SAMPLE_FIELDS, sampleDocx } from './testing/samples'

const docXml = (bytes: Uint8Array) => new PizZip(bytes).file('word/document.xml')!.asText()

describe('template', () => {
  it('the sample stores student_full_name split across runs', () =>
    expect(docXml(sampleDocx())).not.toContain('student_full_name'))
  it('discovers all 16 sample fields in order of first appearance', () =>
    expect(inspectTemplate(sampleDocx())).toEqual({ fields: SAMPLE_FIELDS, warnings: [], errors: [] }))
  it('discovers tags in headers after body fields', () =>
    expect(inspectTemplate(makeDocx({ body: ['{{ a }}'], header: ['{{b}} {{ a }}'] })).fields).toEqual(['a', 'b']))
  it('warns about Jinja blocks', () => {
    const r = inspectTemplate(makeDocx({ body: ['{% if x %}', '{{ a }}', '{% endif %}'] }))
    expect(r).toEqual({ fields: ['a'], errors: [],
      warnings: ['Демо не обрабатывает блоки {% … %}; они останутся в документе как текст'] })
  })
  it('warns about tags that are not plain names', () => {
    const r = inspectTemplate(makeDocx({ body: ['{{ name|upper }}'] }))
    expect(r).toEqual({ fields: [], errors: [], warnings: ['Тег {{ name|upper }} не поддерживается в демо и будет пустым'] })
  })
  it('reports an unclosed tag in Russian with its part and context', () => {
    const r = inspectTemplate(makeDocx({ body: ['Настоящая справка подтверждает, что {{ student_full_name, дата рождения'] }))
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toContain('основной текст')
    expect(r.errors[0]).toContain('не хватает «}}»')
    expect(r.errors[0]).toContain('student_full_name')
  })
  it('reports a file that is not a DOCX', () =>
    expect(inspectTemplate(new TextEncoder().encode('x'))).toEqual({ fields: [], warnings: [], errors: ['Это не файл Word (.docx)'] }))
  it('fills body, tables and footer', () => {
    const values = Object.fromEntries(SAMPLE_FIELDS.map((f) => [f, `v_${f}`]))
    const out = fillTemplate(sampleDocx(), { ...values, student_full_name: 'Ахметов Данияр Серикович' })
    const zip = new PizZip(out)
    expect(zip.file('word/document.xml')!.asText()).toContain('Ахметов Данияр Серикович')
    expect(zip.file('word/document.xml')!.asText()).toContain('v_group_name')
    expect(zip.file('word/footer1.xml')!.asText()).toContain('v_manager_phone')
  })
  it('escapes XML special characters in values', () => {
    const out = fillTemplate(sampleDocx(), { student_full_name: 'ТОО «А&Б» <отдел>' })
    expect(docXml(out)).toContain('ТОО «А&amp;Б» &lt;отдел&gt;')
    expect(inspectTemplate(out).errors).toEqual([])
  })
  it('ignores a header file that is not part of the document package', () => {
    const zip = new PizZip(sampleDocx())
    zip.file('word/header9.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:hdr>')
    expect(inspectTemplate(zip.generate({ type: 'uint8array' }))).toEqual({ fields: SAMPLE_FIELDS, warnings: [], errors: [] })
  })
  it('reports a ZIP with a valid directory but unreadable contents instead of throwing', () => {
    const bytes = sampleDocx().slice()
    bytes[0] = 0 // break the first local file header; the central directory stays intact
    const r = inspectTemplate(bytes)
    expect(r.fields).toEqual([])
    expect(r.errors).toHaveLength(1)
  })
})
