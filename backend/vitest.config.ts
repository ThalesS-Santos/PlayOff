import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        // pontos de entrada sem lógica própria (sobem o servidor / rodam o script)
        'src/server.ts',
        'src/scripts/**',
        // única parte que fala com o Oracle de verdade: sem banco instalado, não há como
        // testá-la. As conversões entre o domínio e as linhas (oracle-mapper.ts) são testadas.
        'src/repo/oracle-repo.ts',
      ],
      // abaixo disso o comando de teste falha (não só avisa)
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
})
