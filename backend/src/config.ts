import { randomBytes } from 'node:crypto'

/* Configuração por variáveis de ambiente (ver .env.example). */

export interface Config {
  port: number
  host: string
  /** origem do frontend liberada no CORS */
  corsOrigin: string
  jwtSecret: string
  /** onde os dados ficam: memória (desenvolvimento/testes) ou Oracle */
  repo: 'memory' | 'oracle'
  oracle: { user: string; password: string; connectString: string }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production'
  const repo = env.PLAYOFF_REPO === 'oracle' ? 'oracle' : 'memory'
  if (production && !env.JWT_SECRET) throw new Error('JWT_SECRET é obrigatório em produção.')
  if (repo === 'oracle' && !(env.ORACLE_USER && env.ORACLE_PASSWORD && env.ORACLE_CONNECT_STRING))
    throw new Error('Para PLAYOFF_REPO=oracle informe ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING.')
  return {
    port: Number(env.PORT ?? 3333),
    host: env.HOST ?? '127.0.0.1',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    // em desenvolvimento, um segredo aleatório por execução (tokens valem até reiniciar)
    jwtSecret: env.JWT_SECRET ?? randomBytes(32).toString('hex'),
    repo,
    oracle: { user: env.ORACLE_USER ?? '', password: env.ORACLE_PASSWORD ?? '', connectString: env.ORACLE_CONNECT_STRING ?? '' },
  }
}
