import { describe, expect, it } from 'vitest'
import { makeApp } from './helpers'

const draft = (p: Record<string, unknown> = {}) => ({
  name: 'Copa Nova',
  description: 'Teste',
  startDate: '2026-12-01',
  endDate: '2026-12-10',
  city: 'Salvador',
  venueName: 'Ginásio',
  venues: ['Q1', 'Q2'],
  referees: ['Ana', 'Caio'],
  visibility: 'publico',
  cover: ['#000000', '#ffffff'],
  modalities: [{ sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teams: ['A', 'B', 'C', 'D'], seeds: ['A'] }],
  prizes: [{ name: 'Troféu', kind: 'coletivo', place: 1 }],
  generateNow: true,
  ...p,
})

describe('catálogo e visualização (RN03)', () => {
  it('anônimo lista tudo; privado vem bloqueado e sem times/partidas; código nunca aparece', async () => {
    const { call } = await makeApp()
    const r = await call('GET', '/torneios')
    expect(r.statusCode).toBe(200)
    const list = r.json() as { id: string; locked: boolean; teams: unknown[]; modalities: { matches: unknown[] }[]; teamCount: number; accessCode?: string; favoritedBy: string[] }[]
    expect(list.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3', 't4'])
    const liga = list.find((t) => t.id === 't3')!
    expect(liga.locked).toBe(true)
    expect(liga.teams).toEqual([])
    expect(liga.modalities[0].matches).toEqual([])
    expect(liga.teamCount).toBe(8)
    expect(JSON.stringify(list)).not.toContain('PLAY2026')
    // quem favoritou não é exposto
    expect(list.every((t) => t.favoritedBy.length === 0)).toBe(true)
  })

  it('público: qualquer um vê os detalhes; inexistente é 404', async () => {
    const { call } = await makeApp()
    const r = await call('GET', '/torneios/t1')
    expect(r.json().teams.length).toBeGreaterThan(0)
    expect((await call('GET', '/torneios/nada')).statusCode).toBe(404)
  })

  it('privado: 403 sem acesso; dono vê com o código', async () => {
    const { call, tokens } = await makeApp()
    for (const token of [undefined, tokens.fan, tokens.other]) {
      const r = await call('GET', '/torneios/t3', token)
      expect(r.statusCode).toBe(403)
      expect(r.json().code).toBe('privado')
    }
    expect((await call('GET', '/torneios/t3', tokens.org)).json().accessCode).toBe('PLAY2026')
  })

  it('código de acesso: erra, acerta e o acesso fica salvo para o usuário', async () => {
    const { call, tokens } = await makeApp()
    expect((await call('POST', '/torneios/t3/acesso', undefined, { code: 'x' })).statusCode).toBe(401)
    const erro = await call('POST', '/torneios/t3/acesso', tokens.fan, { code: 'errado' })
    expect(erro.statusCode).toBe(403)
    expect(erro.json().code).toBe('codigo_incorreto')
    expect((await call('POST', '/torneios/t3/acesso', tokens.fan, { code: ' play2026 ' })).json()).toEqual({ ok: true })
    const visto = await call('GET', '/torneios/t3', tokens.fan)
    expect(visto.statusCode).toBe(200)
    expect(visto.json().accessCode).toBeUndefined()
    expect((await call('GET', '/me', tokens.fan)).json().unlocked).toEqual(['t3'])
    expect((await call('GET', '/torneios', tokens.fan)).json().find((t: { id: string }) => t.id === 't3').locked).toBe(false)
    // público e dono: nada a liberar
    expect((await call('POST', '/torneios/t1/acesso', tokens.fan, { code: '' })).json()).toEqual({ ok: true })
    expect((await call('POST', '/torneios/t3/acesso', tokens.org, { code: '' })).json()).toEqual({ ok: true })
    expect((await call('POST', '/torneios/nada/acesso', tokens.fan, { code: '' })).statusCode).toBe(404)
  })

  it('bloqueia após 5 tentativas erradas (429), por usuário', async () => {
    const { call, tokens } = await makeApp()
    for (let i = 0; i < 4; i++) expect((await call('POST', '/torneios/t3/acesso', tokens.fan, { code: `e${i}` })).statusCode).toBe(403)
    const bloqueio = await call('POST', '/torneios/t3/acesso', tokens.fan, { code: 'e5' })
    expect(bloqueio.statusCode).toBe(429)
    expect(bloqueio.json().message).toMatch(/Aguarde 30 s/)
    expect((await call('POST', '/torneios/t3/acesso', tokens.fan, { code: 'PLAY2026' })).statusCode).toBe(429)
    // outro usuário não é afetado
    expect((await call('POST', '/torneios/t3/acesso', tokens.other, { code: 'PLAY2026' })).statusCode).toBe(200)
  })
})

describe('favoritos', () => {
  it('favorita e desfavorita; exige login e acesso; não apaga favorito ao organizador gravar', async () => {
    const { call, tokens, repo } = await makeApp()
    expect((await call('PUT', '/torneios/t2/favorito')).statusCode).toBe(401)
    expect((await call('PUT', '/torneios/t3/favorito', tokens.fan)).statusCode).toBe(403)
    expect((await call('PUT', '/torneios/t2/favorito', tokens.fan)).json()).toEqual({ favorited: true })
    expect((await call('PUT', '/torneios/t2/favorito', tokens.fan)).json()).toEqual({ favorited: true }) // idempotente
    expect((await call('GET', '/torneios/t2', tokens.fan)).json().favoritedBy).toEqual(['u2'])
    // o organizador grava o torneio com uma cópia antiga (sem o favorito): o favorito permanece
    const stale = await repo.getTournament('t2')
    await call('PUT', '/torneios/t2/favorito', tokens.org)
    await repo.saveTournament({ ...stale!, name: 'Renomeado' })
    expect((await repo.getTournament('t2'))!.favoritedBy.sort()).toEqual(['u1', 'u2'])
    expect((await call('DELETE', '/torneios/t2/favorito', tokens.fan)).json()).toEqual({ favorited: false })
    expect((await repo.getTournament('t2'))!.favoritedBy).toEqual(['u1'])
    await repo.setFavorite('u2', 'nada', true) // torneio inexistente: ignorado
  })
})

describe('criar, editar e excluir (RF01)', () => {
  it('organizador cria com chave e agenda; aparece no catálogo', async () => {
    const { call, tokens } = await makeApp()
    const r = await call('POST', '/torneios', tokens.org, draft())
    expect(r.statusCode).toBe(201)
    const t = r.json()
    expect(t).toMatchObject({ name: 'Copa Nova', status: 'chaveamento', organizerId: 'u1', orgId: 'o1' })
    expect(t.modalities[0].matches.length).toBe(3)
    expect(t.modalities[0].seeds).toHaveLength(1)
    expect((await call('GET', '/torneios')).json()[0].id).toBe(t.id)
  })

  it('espectador e anônimo não criam; rascunho inválido é recusado com a regra', async () => {
    const { call, tokens } = await makeApp()
    expect((await call('POST', '/torneios', undefined, draft())).statusCode).toBe(401)
    expect((await call('POST', '/torneios', tokens.fan, draft())).statusCode).toBe(403)
    const dup = await call('POST', '/torneios', tokens.org, draft({ name: 'Copa Interclasse Horizonte 2026' }))
    expect(dup.statusCode).toBe(422)
    expect(dup.json()).toEqual({ code: 'regra', message: 'Você já tem um torneio com esse nome.' })
    const dupla = await call('POST', '/torneios', tokens.org, draft({ modalities: [{ sport: 'Vôlei', kind: 'set', category: 'F', format: 'dupla_eliminacao', teams: ['A', 'B', 'C'], seeds: [] }] }))
    expect(dupla.json().message).toBe('Vôlei: dupla eliminação exige 4, 8, 16 ou 32 times.')
    const misturado = await call('POST', '/torneios', tokens.org, draft({ modalities: [{ sport: 'Natação', kind: 'colocacao', category: 'M', format: 'eliminacao', teams: ['A', 'B'], seeds: [] }] }))
    expect(misturado.json().message).toMatch(/colocação combina só com o formato prova/)
    const repetidos = await call('POST', '/torneios', tokens.org, draft({ modalities: [{ sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teams: ['A', 'a'], seeds: ['Z'] }] }))
    expect(repetidos.json().message).toMatch(/repetidos/)
    const forma = await call('POST', '/torneios', tokens.org, draft({ startDate: '01/12/2026' }))
    expect(forma.statusCode).toBe(400)
    expect(forma.json().details[0]).toMatchObject({ path: 'startDate' })
  })

  it('edita os dados (só o dono) e exclui', async () => {
    const { call, tokens } = await makeApp()
    const body = { name: 'Circuito 2027', description: 'd', startDate: '2026-12-05', endDate: '2026-12-08', city: 'Ilhéus', venueName: 'Arena', venues: ['Q1'], visibility: 'privado', accessCode: 'sol1' }
    expect((await call('PATCH', '/torneios/t2', tokens.other, body)).statusCode).toBe(403)
    expect((await call('PATCH', '/torneios/t2', tokens.fan, body)).statusCode).toBe(403)
    const ok = await call('PATCH', '/torneios/t2', tokens.org, body)
    expect(ok.json()).toMatchObject({ name: 'Circuito 2027', visibility: 'privado', accessCode: 'SOL1', venues: ['Q1'] })
    expect((await call('PATCH', '/torneios/nada', tokens.org, body)).statusCode).toBe(404)
    expect((await call('DELETE', '/torneios/t2', tokens.fan)).statusCode).toBe(403)
    expect((await call('DELETE', '/torneios/t2', undefined)).statusCode).toBe(401)
    expect((await call('DELETE', '/torneios/t2', tokens.org)).statusCode).toBe(204)
    expect((await call('GET', '/torneios/t2', tokens.org)).statusCode).toBe(404)
    expect((await call('DELETE', '/torneios/t2', tokens.org)).statusCode).toBe(404)
  })
})
