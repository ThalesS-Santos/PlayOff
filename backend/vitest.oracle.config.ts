import { defineConfig } from 'vitest/config'

/*
 * Os mesmos testes da API, contra um Oracle de verdade (PLAYOFF_TEST_REPO=oracle).
 * Rode `npm run db:schema` antes. No CI, um Oracle Free sobe só para este job.
 */
export default defineConfig({
  test: {
    environment: 'node',
    env: { PLAYOFF_TEST_REPO: 'oracle' },
    // um banco só para todos: um arquivo de teste por vez
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      // aqui interessa só a parte que fala com o banco (o resto já é medido no npm test)
      include: ['src/repo/oracle-repo.ts'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
})
