import { describe, expect, it } from 'vitest'
import { API_URL, startApi } from '../test/api-server'
import { ApiError, createApi } from './api'
import type { Tournament } from './types'

/* Cada método do cliente contra o backend real (em memória): caminhos, corpos e erros. */

async function client(email = 'organizador@playoff.dev') {
  const server = await startApi()
  let token: string | null = null
  const api = createApi(`${API_URL}/`, () => token, server.fetchImpl)
  token = (await api.login(email, 'playoff123')).token
  return { api, server }
}

describe('cliente da API', () => {
  it('sessão, organizações e catálogo', async () => {
    const { api } = await client()
    expect((await api.me()).user.id).toBe('u1')
    expect(await api.orgs()).toHaveLength(2)
    expect((await api.saveOrg({ id: 'o1', name: 'Liga X', short: 'LX', hue: 10 })).name).toBe('Liga X')
    expect((await api.list()).length).toBe(4)
    expect((await api.get('t1')).id).toBe('t1')
  })

  it('cadastro devolve sessão', async () => {
    const server = await startApi()
    const api = createApi(API_URL, () => null, server.fetchImpl)
    const s = await api.register({ name: 'Rui', email: 'rui@x.com', password: '12345678', role: 'espectador' })
    expect(s.user.role).toBe('espectador')
  })

  it('gestão completa: cada rota responde com o torneio atualizado', async () => {
    const { api } = await client()
    let t: Tournament = await api.draw('t2', 't2m1')
    expect(t.status).toBe('chaveamento')
    t = await api.transition('t2', 'andamento')
    expect(t.status).toBe('andamento')
    t = await api.optimize('t2')
    const [a, b] = t.modalities[0].matches.filter((m) => !m.bye && m.a && m.b)
    t = await api.reschedule('t2', b.id, { date: '2026-12-05', time: '20:00', venue: 'Quadra Areia 1', referee: 'Paula Reis' })
    expect(t.modalities[0].matches.find((m) => m.id === b.id)!.pinned).toBe(true)
    t = await api.unpin('t2', b.id)
    expect(t.modalities[0].matches.find((m) => m.id === b.id)!.pinned).toBeUndefined()
    t = await api.sumula('t2', 't2m1', a.id, { kind: 'set', sets: [[6, 1]], cards: [] }, true)
    expect(t.modalities[0].matches.find((m) => m.id === a.id)!.status).toBe('ao_vivo')
    t = await api.sumula('t2', 't2m1', a.id, { kind: 'set', sets: [[6, 1]], cards: [] }, false)
    expect(t.modalities[0].matches.find((m) => m.id === a.id)!.status).toBe('encerrada')

    t = await api.saveTeam('t2', { id: 'novo', name: 'Novo', short: 'NOV', color: '#000000', coach: 'C', players: [{ id: 'p', name: 'P', number: 1 }] }, [])
    expect(t.teams.some((x) => x.id === 'novo')).toBe(true)
    t = await api.removeTeam('t2', 'novo')
    expect(t.teams.some((x) => x.id === 'novo')).toBe(false)
    t = await api.addReferee('t2', 'Caio & Cia')
    t = await api.removeReferee('t2', 'Caio & Cia') // nome com caractere especial vai codificado na URL
    expect(t.referees).not.toContain('Caio & Cia')
    t = await api.savePrize('t2', { id: 'pz', name: 'Prata', kind: 'coletivo', place: 2 })
    expect(t.prizes.some((p) => p.id === 'pz')).toBe(true)
    t = await api.removePrize('t2', 'pz')
    expect(t.prizes.some((p) => p.id === 'pz')).toBe(false)
  })

  it('cabeças de chave, edição, criação, favorito, acesso e exclusão', async () => {
    const { api } = await client()
    const before = await api.get('t2')
    const t = await api.toggleSeed('t2', 't2m1', before.modalities[0].teamIds[3])
    expect(t.modalities[0].seeds).toContain(before.modalities[0].teamIds[3])
    const edited = await api.editDetails('t2', { name: 'Circuito 2', description: 'd', startDate: '2026-12-05', endDate: '2026-12-07', city: 'X', venueName: 'Y', venues: ['Q'], visibility: 'publico' })
    expect(edited.name).toBe('Circuito 2')
    const created = await api.create({
      name: 'Nova', description: '', startDate: '2026-12-01', endDate: '2026-12-02', city: 'X', venueName: 'Y', venues: ['Q'], referees: ['R'], visibility: 'publico',
      cover: ['#000000', '#ffffff'], modalities: [{ sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teams: ['A', 'B'], seeds: [] }], prizes: [], generateNow: false,
    })
    await api.favorite(created.id, true)
    expect((await api.get(created.id)).favoritedBy).toEqual(['u1'])
    await api.favorite(created.id, false)
    await api.unlock('t3', '') // dono: não precisa de código
    expect(await api.remove(created.id)).toBeUndefined()
  })

  it('erros viram ApiError com status, código e mensagem do servidor', async () => {
    const { api } = await client('visitante@playoff.dev')
    const err = await api.optimize('t2').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 403, code: 'sem_permissao', message: 'Só o organizador do torneio pode fazer isso.' })
    expect(await api.unlock('t3', 'errado').catch((e: ApiError) => e.code)).toBe('codigo_incorreto')
  })

  it('resposta sem JSON e erro sem corpo também viram ApiError', async () => {
    const api = createApi(API_URL, () => null, async () => new Response('<html>erro</html>', { status: 502 }))
    expect(await api.list().catch((e: ApiError) => [e.status, e.code, e.message])).toEqual([502, 'erro', 'Erro 502.'])
    const offline = createApi(API_URL, () => null, () => Promise.reject(new TypeError('Failed to fetch')))
    expect(await offline.list().catch((e: ApiError) => e.code)).toBe('sem_conexao')
  })
})
