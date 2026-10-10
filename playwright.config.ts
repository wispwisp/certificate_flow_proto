import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'node scripts/serve-subpath.mjs',
    url: 'http://localhost:4173/certificate_flow_proto/',
    reuseExistingServer: false,
  },
})
