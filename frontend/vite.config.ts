/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
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
})
