/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`),
    },
  ],
  assetsInclude: ['**/*.docx', '**/*.csv'],
  build: {
    modulePreload: { polyfill: false },
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? true : undefined),
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
