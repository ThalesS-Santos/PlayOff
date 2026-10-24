import { describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { MemoryRepo } from '../repo/memory-repo'
import { makeApp, SECRET } from './helpers'

describe('tratamento de erros e saúde', () => {
  it('/saude responde', async () => {
    const { call } = await makeApp()
    expect((await call('GET', '/saude')).json()).toEqual({ ok: true })
  })

  it('JSON malformado é 400, não 500', async () => {
    const { app } = await makeApp()
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'content-type': 'application/json' }, payload: '{quebrado' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('requisicao_invalida')
  })

  it('falha inesperada do programa vira 500 sem expor detalhes', async () => {
    const repo = new MemoryRepo()
    repo.listTournaments = async () => {
      throw new TypeError('detalhe interno que não pode vazar')
    }
    const app = buildApp({ repo, jwtSecret: SECRET })
    const r = await app.inject({ method: 'GET', url: '/api/v1/torneios' })
    expect(r.statusCode).toBe(500)
    expect(r.json()).toEqual({ code: 'erro_interno', message: 'Erro interno. Tente novamente.' })
    expect(r.body).not.toContain('detalhe interno')
  })

  it('e-mail duplicado detectado pelo repositório (corrida entre dois cadastros) é 409', async () => {
    const repo = new MemoryRepo()
    // simula outro cadastro com o mesmo e-mail acontecendo entre a checagem e a gravação
    repo.findUserByEmail = async () => undefined
    await repo.createUser({ id: 'x', name: 'X', email: 'a@b.com', role: 'espectador', passwordHash: 'h' })
    const app = buildApp({ repo, jwtSecret: SECRET })
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/registro', payload: { name: 'Yuri', email: 'a@b.com', password: '12345678', role: 'espectador' } })
    expect(r.statusCode).toBe(409)
  })

  it('CORS libera só a origem configurada', async () => {
    const { app } = await makeApp()
    const ok = await app.inject({ method: 'OPTIONS', url: '/api/v1/torneios', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' } })
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const other = await app.inject({ method: 'OPTIONS', url: '/api/v1/torneios', headers: { origin: 'https://site-malicioso.com', 'access-control-request-method': 'GET' } })
    expect(other.headers['access-control-allow-origin']).not.toBe('https://site-malicioso.com')
  })
})

describe('repositório em memória', () => {
  it('isola os dados como um banco: alterar o que foi lido não muda nada sem salvar', async () => {
    const repo = new MemoryRepo()
    await repo.saveOrg({ id: 'o', name: 'Org', short: 'O', hue: 1 })
    const o = (await repo.getOrg('o'))!
    o.name = 'Alterada'
    expect((await repo.getOrg('o'))!.name).toBe('Org')
    expect(await repo.getOrg('nada')).toBeUndefined()
    expect(await repo.findUser('nada')).toBeUndefined()
    expect(await repo.getTournament('nada')).toBeUndefined()
    expect(await repo.accessList('ninguem')).toEqual([])
    await repo.ping()
    await repo.close()
  })

  it('excluir torneio remove também os acessos liberados', async () => {
    const { repo } = await makeApp()
    await repo.grantAccess('u2', 't3')
    await repo.deleteTournament('t3')
    expect(await repo.accessList('u2')).toEqual([])
  })
})

describe('proteções da API', () => {
  it('login e cadastro: depois do limite por IP, 429 com mensagem; outras rotas seguem livres', async () => {
    const app = buildApp({ repo: new MemoryRepo(), jwtSecret: SECRET, rateLimit: { max: 100, authMax: 3, windowMs: 60_000 } })
    const login = () => app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'a@b.com', password: 'errada123' } })
    for (let i = 0; i < 3; i++) expect((await login()).statusCode).toBe(401)
    const blocked = await login()
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json()).toMatchObject({ code: 'muitas_tentativas', message: expect.stringMatching(/^Muitas tentativas\. Tente de novo em \d+ s\.$/) })
    expect(blocked.headers['retry-after']).toBeDefined()
    expect((await app.inject({ method: 'GET', url: '/api/v1/torneios' })).statusCode).toBe(200)
    // o cadastro tem a sua própria conta
    const reg = (n: number) => app.inject({ method: 'POST', url: '/api/v1/auth/registro', payload: { name: 'Yuri', email: `y${n}@b.com`, password: '12345678', role: 'espectador' } })
    for (let i = 0; i < 3; i++) expect((await reg(i)).statusCode).toBe(201)
    expect((await reg(9)).statusCode).toBe(429)
  })

  it('atrás de proxy, o limite é por IP real (X-Forwarded-For), não um só para todos', async () => {
    const limits = { max: 100, authMax: 1, windowMs: 60_000 }
    const login = (app: ReturnType<typeof buildApp>, ip: string) =>
      app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'x-forwarded-for': ip }, payload: { email: 'a@b.com', password: 'errada123' } })
    const proxied = buildApp({ repo: new MemoryRepo(), jwtSecret: SECRET, rateLimit: limits, trustProxy: true })
    expect((await login(proxied, '10.0.0.1')).statusCode).toBe(401)
    expect((await login(proxied, '10.0.0.2')).statusCode).toBe(401)
    expect((await login(proxied, '10.0.0.1')).statusCode).toBe(429)
    // sem trustProxy o cabeçalho é ignorado (não dá para fugir do limite trocando-o)
    const direct = buildApp({ repo: new MemoryRepo(), jwtSecret: SECRET, rateLimit: limits })
    expect((await login(direct, '10.0.0.1')).statusCode).toBe(401)
    expect((await login(direct, '10.0.0.2')).statusCode).toBe(429)
  })

  it('limite geral por IP vale para todas as rotas', async () => {
    const app = buildApp({ repo: new MemoryRepo(), jwtSecret: SECRET, rateLimit: { max: 2, authMax: 2, windowMs: 60_000 } })
    const get = () => app.inject({ method: 'GET', url: '/api/v1/organizacoes' })
    expect((await get()).statusCode).toBe(200)
    expect((await get()).statusCode).toBe(200)
    expect((await get()).statusCode).toBe(429)
  })

  it('cabeçalhos de segurança em toda resposta', async () => {
    const { call } = await makeApp()
    const r = await call('GET', '/torneios')
    expect(r.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'strict-transport-security': expect.stringContaining('max-age='),
      'cross-origin-resource-policy': 'cross-origin',
    })
    expect(r.headers['content-security-policy']).toContain("default-src 'self'")
  })
})
