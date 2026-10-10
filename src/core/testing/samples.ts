import { readFileSync } from 'node:fs'

const read = (name: string) => new Uint8Array(readFileSync(new URL(`../../samples/${name}`, import.meta.url)))

export const sampleDocx = () => read('spravka_ob_obuchenii_template.docx')
export const sampleCsv = () => read('students_demo.csv')

export const SAMPLE_FIELDS = ['cert_number', 'issue_date', 'student_full_name', 'birth_date', 'program_name', 'group_name',
  'study_form', 'study_start_date', 'study_end_date', 'study_duration', 'hours_per_week', 'destination',
  'signer_position', 'signer_full_name', 'manager_full_name', 'manager_phone']
