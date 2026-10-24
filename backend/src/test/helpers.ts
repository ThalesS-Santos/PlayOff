import { buildApp } from '../app'
import { MemoryRepo } from '../repo/memory-repo'
import { DEMO_PASSWORD, seedRepo } from '../seed'

export const SECRET = 'segredo-de-teste'

/** API com repositório em memória e os dados de demonstração. */
export async function makeApp() {
  const repo = new MemoryRepo()
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
