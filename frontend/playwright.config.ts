import { defineConfig, devices } from '@playwright/test'

/*
 * Testes de ponta a ponta: navegador real + API real (em memória) + frontend compilado
 * apontando para ela. No CI usa o Chromium do Playwright; no Windows, por padrão, o
 * Microsoft Edge já instalado (não precisa baixar navegador): PW_CHANNEL=msedge.
 */

const API = 'http://127.0.0.1:3333'
const WEB = 'http://127.0.0.1:4173'
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // a API em memória é compartilhada pelos testes: um de cada vez
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: WEB, trace: 'retain-on-failure', ...(channel ? { channel } : {}) },
  projects: [{ name: 'navegador', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } }],
  webServer: [
    {
      command: 'npm run dev --prefix ../backend',
      url: `${API}/api/v1/saude`,
      env: { PORT: '3333', HOST: '127.0.0.1', CORS_ORIGIN: WEB, JWT_SECRET: 'segredo-dos-testes-e2e' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: WEB,
      env: { VITE_API_URL: API },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
