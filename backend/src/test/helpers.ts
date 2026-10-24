import { afterAll } from 'vitest'
import { buildApp } from '../app'
import { loadConfig } from '../config'
import { MemoryRepo } from '../repo/memory-repo'
import type { Repo } from '../repo/types'
import { DEMO_PASSWORD, seedRepo } from '../seed'

export const SECRET = 'segredo-de-teste'

/** `npm run test:oracle` roda os mesmos testes da API contra um Oracle de verdade. */
export const ORACLE = process.env.PLAYOFF_TEST_REPO === 'oracle'

let oracle: Promise<{ repo: Repo; wipe: () => Promise<void> }> | undefined
if (ORACLE) afterAll(async () => (await oracle)?.repo.close())

async function connectOracle() {
  const [{ default: oracledb }, { OracleRepo }] = await Promise.all([import('oracledb'), import('../repo/oracle-repo')])
  const cfg = loadConfig({ ...process.env, PLAYOFF_REPO: 'oracle' }).oracle
  const repo = await OracleRepo.connect(cfg)
  const wipe = async () => {
    const c = await oracledb.getConnection(cfg)
    try {
      // as tabelas filhas do torneio saem em cascata
      for (const t of ['ACESSO_TORNEIO', 'FAVORITO', 'TORNEIO', 'USUARIO', 'ORGANIZACAO']) await c.execute(`DELETE FROM ${t}`)
      await c.commit()
    } finally {
      await c.close()
    }
  }
  return { repo, wipe }
}

/** Repositório vazio: em memória, ou o Oracle de teste com todas as tabelas limpas. */
export async function emptyRepo(): Promise<Repo> {
  if (!ORACLE) return new MemoryRepo()
  oracle ??= connectOracle()
  const { repo, wipe } = await oracle
  await wipe()
  return repo
}

/** API com repositório (memória ou Oracle) e os dados de demonstração. */
export async function makeApp() {
  const repo = await emptyRepo()
  await seedRepo(repo)
  const app = buildApp({ repo, jwtSecret: SECRET })
  await app.ready()

  const login = async (email: string, password = DEMO_PASSWORD) => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } })
    return r.json().token as string
  }
  const tokens = {
    org: await login('organizador@playoff.dev'),
    fan: await login('visitante@playoff.dev'),
    other: await login('arena@playoff.dev'),
  }
  /** requisição autenticada (ou anônima, sem token) */
  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, token?: string, payload?: unknown) =>
    app.inject({ method, url: `/api/v1${url}`, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(payload === undefined ? {} : { payload: payload as object }) })
  return { app, repo, tokens, login, call }
}
