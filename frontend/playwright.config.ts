import { defineConfig, devices } from '@playwright/test'

/*
 * Testes de ponta a ponta: navegador real + API real (em memória) + frontend compilado
 * apontando para ela. No CI usa o Chromium do Playwright; no Windows, por padrão, o
 * Microsoft Edge já instalado (não precisa baixar navegador): PW_CHANNEL=msedge.
 *
 * Modo demonstração (npm run e2e:demo, ou DEMO=1): navegador visível em câmera lenta,
 * legenda de cada passo na tela (e2e/demo.ts) e relatório HTML com o rastro (trace) de
 * cada teste (npm run e2e:relatorio). Fora do Windows usa o Google Chrome instalado.
 */

const API = 'http://127.0.0.1:3333'
const WEB = 'http://127.0.0.1:4173'
const demo = process.env.DEMO === '1' || process.env.npm_lifecycle_event === 'e2e:demo'
// os testes rodam em outros processos: é por aqui que eles sabem do modo demonstração
if (demo) process.env.DEMO = '1'
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : demo ? 'chrome' : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // a API em memória é compartilhada pelos testes: um de cada vez
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // na demonstração as pausas e a câmera lenta deixam cada teste bem mais longo
  timeout: demo ? 180_000 : 30_000,
  reporter: process.env.CI || demo ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB,
    trace: demo ? 'on' : 'retain-on-failure',
    ...(channel ? { channel } : {}),
    ...(demo ? { headless: false, launchOptions: { slowMo: 350 } } : {}),
  },
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
