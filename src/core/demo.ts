import templateUrl from '../samples/spravka_ob_obuchenii_template.docx?inline'
import csvUrl from '../samples/students_demo.csv?inline'
import { inspectTemplate } from './template'
import { newTemplateRecord, type TemplateRecord } from './storage'

export const DEMO_DEFAULTS: Record<string, string> = {
  signer_position: 'Директор',
  signer_full_name: 'Иванов И. И.',
  manager_full_name: 'Петрова А. С.',
  manager_phone: '+7 (7172) 00-00-01',
}

// The samples are bundled as data URLs: a fetch would be blocked by the CSP and is forbidden after page load.
function decodeDataUrl(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export function demoTemplateBytes(): Uint8Array {
  return decodeDataUrl(templateUrl)
}

export function demoCsvBytes(): Uint8Array {
  return decodeDataUrl(csvUrl)
}

export function createDemoTemplate(): TemplateRecord {
  const bytes = demoTemplateBytes()
  const record = newTemplateRecord('Справка об обучении', bytes, inspectTemplate(bytes).fields)
  return { ...record, defaults: DEMO_DEFAULTS, isDemo: true }
}
