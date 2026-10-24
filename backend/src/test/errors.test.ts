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
