// Serves dist/ under /certificate_flow_proto/ like GitHub Pages: no SPA fallback, 404 for anything else.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PREFIX = '/certificate_flow_proto/'
const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const PORT = Number(process.env.PORT) || 4173
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

function send(res, status, body = '', headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (path === PREFIX.slice(0, -1)) return send(res, 301, '', { Location: PREFIX })
  if (!path.startsWith(PREFIX) || path.includes('..')) return send(res, 404, 'Not found')

  let file = join(DIST, path.slice(PREFIX.length))
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const type = TYPES[extname(file)]
    if (!type) return send(res, 404, 'Not found')
    send(res, 200, await readFile(file), { 'Content-Type': type })
  } catch {
    send(res, 404, 'Not found')
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}${PREFIX}`))
