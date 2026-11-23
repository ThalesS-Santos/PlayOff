import { chromium, defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

/*
 * Testes de ponta a ponta: navegador real + API real (em memória) + frontend compilado
 * apontando para ela. Navegador, sem precisar configurar nada:
 *  - Windows: o Microsoft Edge já instalado;
 *  - Linux e Mac: o Chromium do Playwright, se foi baixado (npx playwright install
 *    chromium, como no CI); se não, o Google Chrome instalado.
 * Para escolher outro: PW_CHANNEL=chrome, PW_CHANNEL=msedge...
 *
 * Modo demonstração (npm run e2e:demo, ou DEMO=1): navegador visível em câmera lenta,
 * legenda de cada passo na tela (e2e/demo.ts) e relatório HTML com o rastro (trace) de
 * cada teste (npm run e2e:relatorio). Versão mais curta: npm run e2e:demo:rapido.
 */

const API = 'http://127.0.0.1:3333'
const WEB = 'http://127.0.0.1:4173'
// e2e:demo:rapido = a mesma demonstração com menos câmera lenta e pausas mais curtas
const rapido = process.env.DEMO === 'rapido' || process.env.npm_lifecycle_event === 'e2e:demo:rapido'
const demo = rapido || process.env.DEMO === '1' || process.env.npm_lifecycle_event === 'e2e:demo'
// os testes rodam em outros processos: é por aqui que eles sabem do modo demonstração
if (demo) process.env.DEMO = rapido ? 'rapido' : '1'
const temChromium = existsSync(chromium.executablePath())
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : temChromium ? undefined : 'chrome')

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
    ...(demo ? { headless: false, launchOptions: { slowMo: rapido ? 100 : 350 } } : {}),
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
