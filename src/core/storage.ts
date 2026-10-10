import { defaultLabel } from './fields'

export type TemplateRecord = {
  id: string
  name: string
  bytes: Uint8Array
  fields: string[]
  labels: Record<string, string>
  defaults: Record<string, string>
  optional: string[]
  isDemo: boolean
  createdAt: number
}

const DB_NAME = 'certificates'
const STORE = 'templates'

export function newTemplateRecord(name: string, bytes: Uint8Array, fields: string[]): TemplateRecord {
  return {
    id: crypto.randomUUID(),
    name,
    bytes,
    fields,
    labels: Object.fromEntries(fields.map((f) => [f, defaultLabel(f)])),
    defaults: {},
    optional: [],
    isDemo: false,
    createdAt: Date.now(),
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Runs one request in a transaction and resolves with its result once the transaction has committed. */
async function run<T>(mode: IDBTransactionMode, makeRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = makeRequest(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  const all = await run('readonly', (store) => store.getAll() as IDBRequest<TemplateRecord[]>)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putTemplate(t: TemplateRecord): Promise<void> {
  await run('readwrite', (store) => store.put(t))
}

export async function deleteTemplate(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
}
