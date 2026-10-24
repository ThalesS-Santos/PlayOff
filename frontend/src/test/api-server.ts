/*
 * O backend de verdade (backend/src), rodando em memória dentro do teste: as
 * requisições do frontend vão direto para o Fastify (inject), sem rede. Assim os
 * testes do modo API exercitam a tela e a API reais juntas, não uma imitação.
 *
 * O import é dinâmico e com tipo mínimo de propósito: o backend tem sua própria
 * configuração de TypeScript (Node) e não entra na checagem de tipos do frontend.
 */

interface InjectResult {
  statusCode: number
  body: string
  headers: Record<string, unknown>
}
interface BackendApp {
  inject(opts: { method: string; url: string; headers?: Record<string, string>; payload?: string }): Promise<InjectResult>
  ready(): Promise<unknown>
}
interface BackendModules {
  buildApp(o: { repo: unknown; jwtSecret: string }): BackendApp
  MemoryRepo: new () => unknown
  seedRepo(repo: unknown): Promise<void>
}

// "@backend" é um apelido para backend/src, definido no vite.config.ts só para os testes
const backend = (path: string) => import(/* @vite-ignore */ `@backend/${path}`)

export const API_URL = 'http://api.test'

export async function startApi() {
  const [{ buildApp }, { MemoryRepo }, { seedRepo }] = (await Promise.all([backend('app.ts'), backend('repo/memory-repo.ts'), backend('seed.ts')])) as [
    Pick<BackendModules, 'buildApp'>,
    Pick<BackendModules, 'MemoryRepo'>,
    Pick<BackendModules, 'seedRepo'>,
  ]
  const repo = new MemoryRepo()
  await seedRepo(repo)
  const app = buildApp({ repo, jwtSecret: 'segredo-dos-testes-do-frontend' })
  await app.ready()

  /** fetch do navegador → inject do Fastify */
  const fetchImpl = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const url = input.replace(API_URL, '')
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>))
    const r = await app.inject({ method: init.method ?? 'GET', url, headers, payload: typeof init.body === 'string' ? init.body : undefined })
    return new Response(r.statusCode === 204 ? null : r.body, { status: r.statusCode, headers: { 'content-type': String(r.headers['content-type'] ?? 'application/json') } })
  }

  /** chamada direta à API (para preparar ou conferir o estado do servidor) */
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const r = await app.inject({ method, url: `/api/v1${path}`, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, payload: body === undefined ? undefined : JSON.stringify(body) })
    return { status: r.statusCode, json: () => (r.body ? JSON.parse(r.body) : undefined) }
  }
  const login = async (email: string) => (await call('POST', '/auth/login', undefined, { email, password: 'playoff123' })).json() as { token: string; user: { id: string } }
  return { fetchImpl, call, login }
}
