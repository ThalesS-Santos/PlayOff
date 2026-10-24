/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // só nos testes (o Vitest roda com mode "test"): permite carregar o backend (../backend)
  // para os testes do modo API; o servidor de desenvolvimento continua restrito ao frontend
  server: mode === 'test' ? { fs: { allow: ['..'] } } : undefined,
  // "@backend/..." aponta para backend/src (também só nos testes)
  resolve: mode === 'test' ? { alias: { '@backend': fileURLToPath(new URL('../backend/src', import.meta.url)) } } : undefined,
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // os testes de ponta a ponta (e2e/) rodam no Playwright, não aqui
    include: ['src/**/*.test.{ts,tsx}'],
    // testes de interface com animações e várias telas: mais folga que o padrão de 5 s
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // só ficam de fora os próprios testes e declarações de tipo (sem código executável)
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts', 'src/lib/types.ts'],
      // abaixo disso o comando de teste falha (não só avisa)
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
}))
