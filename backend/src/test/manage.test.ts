import { describe, expect, it } from 'vitest'
import type { Match, Tournament } from '../domain'
import { makeApp } from './helpers'

/** Rotas de gestão com um corpo válido, para conferir que só o dono consegue usá-las. */
const MANAGE_ROUTES: [method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown][] = [
  ['POST', '/torneios/t2/transicoes', { status: 'chaveamento' }],
  ['POST', '/torneios/t2/modalidades/t2m1/sorteio', {}],
  ['POST', '/torneios/t2/agenda/otimizar'],
  ['PUT', '/torneios/t2/partidas/x/agendamento', { date: '2026-12-05', time: '09:00', venue: 'Q', referee: 'R' }],
  ['DELETE', '/torneios/t2/partidas/x/agendamento'],
  ['POST', '/torneios/t2/modalidades/t2m1/partidas/x/sumula', { sumula: { kind: 'set', sets: [[6, 3]], cards: [] } }],
  ['PUT', '/torneios/t2/times/novo', { team: { name: 'Novo', short: 'NOV', color: '#000000', coach: 'C', players: [] }, modalityIds: [] }],
  ['DELETE', '/torneios/t2/times/bt1'],
  ['POST', '/torneios/t2/modalidades/t2m1/cabecas/bt1'],
  ['POST', '/torneios/t2/arbitros', { name: 'Novo' }],
  ['DELETE', '/torneios/t2/arbitros/Paula%20Reis'],
  ['PUT', '/torneios/t2/premios/pz6', { name: 'P', kind: 'coletivo', place: 1 }],
  ['DELETE', '/torneios/t2/premios/pz6'],
]

describe('permissões da gestão (RN04)', () => {
  it.each(MANAGE_ROUTES)('%s %s: anônimo 401, espectador e outro organizador 403, nada muda', async (method, url, body) => {
    const { call, tokens, repo } = await makeApp()
    const before = await repo.getTournament('t2')
    expect((await call(method, url, undefined, body)).statusCode).toBe(401)
    for (const token of [tokens.fan, tokens.other]) {
      const r = await call(method, url, token, body)
      expect(r.statusCode).toBe(403)
      expect(r.json().code).toBe('sem_permissao')
    }
    expect(await repo.getTournament('t2')).toEqual(before)
  })
})

const pending = (t: Tournament) => t.modalities[0].matches.filter((m: Match) => !m.bye && m.status !== 'encerrada' && m.a && m.b)

describe('campeonato completo pela API (beach tennis)', () => {
  it('sorteia, registra súmulas até o campeão e o torneio termina sozinho', async () => {
    const { call, tokens } = await makeApp()
    const sorteio = await call('POST', '/torneios/t2/modalidades/t2m1/sorteio', tokens.org, {})
    expect(sorteio.json().status).toBe('chaveamento')
    let t: Tournament = sorteio.json()
    for (let guard = 0; pending(t).length && guard < 20; guard++) {
      const m = pending(t)[0]
      const r = await call('POST', `/torneios/t2/modalidades/t2m1/partidas/${m.id}/sumula`, tokens.org, { sumula: { kind: 'set', sets: [[6, 2], [6, 4]], cards: [] } })
      expect(r.statusCode).toBe(200)
      t = r.json()
    }
    expect(t.status).toBe('finalizado')
    const final = t.modalities[0].matches.find((m) => !m.nextMatchId)!
    expect(final.status).toBe('encerrada')
    // o prêmio de campeão fica disponível para o público
    expect((await call('GET', '/torneios/t2')).json().status).toBe('finalizado')
  })

  it('placar ao vivo, súmula inválida e partida sem adversários', async () => {
    const { call, tokens } = await makeApp()
    const t: Tournament = (await call('POST', '/torneios/t2/modalidades/t2m1/sorteio', tokens.org, {})).json()
    const m = pending(t)[0]
    const url = `/torneios/t2/modalidades/t2m1/partidas/${m.id}/sumula`
    const vivo = await call('POST', url, tokens.org, { aoVivo: true, sumula: { kind: 'set', sets: [[3, 2]], cards: [] } })
    expect(vivo.json().modalities[0].matches.find((x: Match) => x.id === m.id).status).toBe('ao_vivo')
    const empate = await call('POST', url, tokens.org, { sumula: { kind: 'set', sets: [[6, 6]], cards: [] } })
    expect(empate.statusCode).toBe(422)
    expect(empate.json().message).toMatch(/empatado/)
    const final = t.modalities[0].matches.find((x) => !x.nextMatchId)!
    expect((await call('POST', `/torneios/t2/modalidades/t2m1/partidas/${final.id}/sumula`, tokens.org, { sumula: { kind: 'set', sets: [[6, 1]], cards: [] } })).statusCode).toBe(422)
    expect((await call('POST', url, tokens.org, { sumula: { kind: 'futebol' } })).statusCode).toBe(400)
  })

  it('ciclo de vida: transição inválida é 422; cancelar bloqueia súmulas', async () => {
    const { call, tokens } = await makeApp()
    const salto = await call('POST', '/torneios/t2/transicoes', tokens.org, { status: 'finalizado' })
    expect(salto.statusCode).toBe(422)
    expect((await call('POST', '/torneios/t2/transicoes', tokens.org, { status: 'qualquer' })).statusCode).toBe(400)
    const t: Tournament = (await call('POST', '/torneios/t2/transicoes', tokens.org, { status: 'chaveamento' })).json()
    expect(t.modalities[0].matches.length).toBeGreaterThan(0)
    await call('POST', '/torneios/t2/transicoes', tokens.org, { status: 'cancelado' })
    const m = pending(t)[0]
    const r = await call('POST', `/torneios/t2/modalidades/t2m1/partidas/${m.id}/sumula`, tokens.org, { sumula: { kind: 'set', sets: [[6, 1]], cards: [] } })
    expect(r.json().message).toMatch(/em andamento/)
  })

  it('sorteio com opções; dupla eliminação com 6 times é recusada', async () => {
    const { call, tokens } = await makeApp()
    const liga = await call('POST', '/torneios/t3/modalidades/t3m1/sorteio', tokens.org, { groupCount: 3, advance: 2 })
    expect(liga.json().modalities[0].groups).toHaveLength(3)
    expect((await call('POST', '/torneios/t3/modalidades/t3m1/sorteio', tokens.org, { groupCount: 99 })).statusCode).toBe(400)
    expect((await call('POST', '/torneios/t3/modalidades/nada/sorteio', tokens.org, {})).statusCode).toBe(422)
  })
})

describe('agenda', () => {
  it('otimiza, reagenda com checagem de conflito e libera', async () => {
    const { call, tokens } = await makeApp()
    expect((await call('POST', '/torneios/t3/agenda/otimizar', tokens.org)).statusCode).toBe(200)
    const t: Tournament = (await call('POST', '/torneios/t2/modalidades/t2m1/sorteio', tokens.org, {})).json()
    const [a, b] = pending(t)
    const url = `/torneios/t2/partidas/${b.id}/agendamento`
    const conflito = await call('PUT', url, tokens.org, { date: a.date, time: a.time, venue: a.venue, referee: a.referee })
    expect(conflito.statusCode).toBe(422)
    expect(conflito.json().message).toMatch(/já recebe outra partida|já apita|já joga/)
    const ok = await call('PUT', url, tokens.org, { date: '2026-12-05', time: '20:00', venue: 'Quadra Areia 1', referee: 'Paula Reis' })
    expect(ok.json().modalities[0].matches.find((x: Match) => x.id === b.id)).toMatchObject({ time: '20:00', pinned: true })
    const solto = await call('DELETE', url, tokens.org)
    expect(solto.json().modalities[0].matches.find((x: Match) => x.id === b.id).pinned).toBeUndefined()
    expect((await call('PUT', url, tokens.org, { date: '05/12', time: '20:00', venue: 'Q', referee: 'R' })).statusCode).toBe(400)
  })
})

describe('cadastros (RF02)', () => {
  const time = (p: Record<string, unknown> = {}) => ({ name: 'Maresia', short: 'MAR', color: '#3b82f6', coach: 'Rita', players: [{ id: 'p1', name: 'Lia', number: 10 }], ...p })

  it('times: valida, cadastra, inscreve e exclui; cabeça de chave alterna', async () => {
    const { call, tokens } = await makeApp()
    const invalido = await call('PUT', '/torneios/t2/times/novo', tokens.org, { team: time({ name: 'Sol & Mar' }), modalityIds: ['t2m1'] })
    expect(invalido.statusCode).toBe(422)
    expect(invalido.json().message).toBe('Já existe um time com esse nome.')
    const ok = await call('PUT', '/torneios/t2/times/novo', tokens.org, { team: time(), modalityIds: ['t2m1'] })
    expect(ok.json().modalities[0].teamIds).toContain('novo')
    const seed = await call('POST', '/torneios/t2/modalidades/t2m1/cabecas/novo', tokens.org)
    expect(seed.json().modalities[0].seeds).toContain('novo')
    expect((await call('DELETE', '/torneios/t2/times/novo', tokens.org)).json().teams.some((x: { id: string }) => x.id === 'novo')).toBe(false)
    // time com jogos gerados não sai
    expect((await call('DELETE', '/torneios/t1/times/fs1', tokens.org)).statusCode).toBe(422)
    expect((await call('PUT', '/torneios/t2/times/x', tokens.org, { team: time({ color: 'azul' }), modalityIds: [] })).statusCode).toBe(400)
  })

  it('árbitros e prêmios', async () => {
    const { call, tokens } = await makeApp()
    expect((await call('POST', '/torneios/t2/arbitros', tokens.org, { name: 'paula reis' })).json().message).toBe('Árbitro já cadastrado.')
    expect((await call('POST', '/torneios/t2/arbitros', tokens.org, { name: 'Caio' })).json().referees).toContain('Caio')
    expect((await call('DELETE', '/torneios/t2/arbitros/Caio', tokens.org)).json().referees).not.toContain('Caio')
    const escalado = (await call('GET', '/torneios/t1')).json().modalities.flatMap((m: { matches: Match[] }) => m.matches).find((m: Match) => m.status !== 'encerrada' && m.referee).referee
    expect((await call('DELETE', `/torneios/t1/arbitros/${encodeURIComponent(escalado)}`, tokens.org)).statusCode).toBe(422)

    const premio = await call('PUT', '/torneios/t2/premios/novo', tokens.org, { name: 'Prata', kind: 'coletivo', place: 2, value: 100 })
    expect(premio.json().prizes.find((p: { id: string }) => p.id === 'novo')).toMatchObject({ name: 'Prata', place: 2 })
    expect((await call('PUT', '/torneios/t2/premios/novo', tokens.org, { name: 'X', kind: 'coletivo', place: 7 })).json().message).toMatch(/1º, 2º ou 3º/)
    expect((await call('DELETE', '/torneios/t2/premios/novo', tokens.org)).json().prizes.some((p: { id: string }) => p.id === 'novo')).toBe(false)
  })
})

/*
 * Valores que o banco recusaria (tamanho de coluna, precisão, chave estrangeira) são
 * barrados antes, com 400/422. No Oracle (npm run test:oracle) isso evita um erro 500.
 */
describe('limites do banco conferidos antes de gravar', () => {
  it('ids na URL, prêmios, reagendamento e súmula fora dos limites', async () => {
    const { call, tokens } = await makeApp()
    const team = { name: 'Maresia', short: 'MAR', color: '#3b82f6', coach: 'Rita', players: [] }
    expect((await call('PUT', `/torneios/t2/times/${'x'.repeat(65)}`, tokens.org, { team, modalityIds: [] })).statusCode).toBe(400)
    expect((await call('PUT', '/torneios/t2/times/com%20espa%C3%A7o', tokens.org, { team, modalityIds: [] })).statusCode).toBe(400)
    expect((await call('PUT', `/torneios/t2/premios/${'p'.repeat(65)}`, tokens.org, { name: 'P', kind: 'coletivo', place: 1 })).statusCode).toBe(400)

    const prize = (p: Record<string, unknown>) => call('PUT', '/torneios/t2/premios/novo', tokens.org, { name: 'P', kind: 'coletivo', place: 1, ...p })
    expect((await prize({ modalityId: 'nao-existe' })).json().message).toBe('Modalidade do prêmio não existe neste torneio.')
    expect((await prize({ value: 1e11 })).json().message).toBe('Valor alto demais.')
    expect((await prize({ kind: 'individual', place: 500 })).json().message).toBe('Ordem do prêmio individual inválida.')

    const t: Tournament = (await call('POST', '/torneios/t2/modalidades/t2m1/sorteio', tokens.org, {})).json()
    const url = `/torneios/t2/partidas/${pending(t)[0].id}/agendamento`
    const fora = await call('PUT', url, tokens.org, { date: '2026-12-05', time: '20:00', venue: 'Quadra inventada', referee: 'Paula Reis' })
    expect(fora.statusCode).toBe(422)
    expect(fora.json().message).toBe('Quadra inventada não é um espaço desta modalidade.')

    const futsal = (await call('GET', '/torneios/t1')).json().modalities.find((m: { kind: string }) => m.kind === 'pontos')
    const m = futsal.matches.find((x: Match) => !x.bye && x.status !== 'encerrada' && x.a && x.b)
    const sumula = await call('POST', `/torneios/t1/modalidades/${futsal.id}/partidas/${m.id}/sumula`, tokens.org, { sumula: { kind: 'pontos', a: 10000, b: 0, cards: [] } })
    expect(sumula.statusCode).toBe(422)
    expect(sumula.json().message).toBe('Placar deve ter números inteiros de 0 a 9999.')
  })
})
