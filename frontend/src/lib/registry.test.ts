import { describe, expect, it } from 'vitest'
import { applySumula, generateMatches } from './engine'
import {
  addReferee,
  prizeModality,
  prizeWinners,
  refereeAssignments,
  removePrize,
  removeReferee,
  removeTeam,
  toggleSeed,
  upsertPrize,
  upsertTeam,
  validatePrize,
  validateReferee,
  validateTeam,
} from './registry'
import type { Modality, Prize, Team, Tournament } from './types'

const team = (id: string, p: Partial<Team> = {}): Team => ({ id, name: `Time ${id}`, short: id.toUpperCase().padEnd(2, 'X'), color: '#000', coach: 'Ana', players: [], ...p })
const mod = (id: string, teamIds: string[]): Modality => ({ id, sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teamIds, seeds: [], groups: [], matches: [] })

function tournament(): Tournament {
  return {
    id: 't', name: 'T', description: '', orgId: 'o', organizerId: 'u', visibility: 'publico', status: 'publicado',
    startDate: '2026-11-10', endDate: '2026-11-12', city: '', venueName: '', venues: ['Q1'], referees: ['Rita'], cover: ['#000', '#fff'],
    teams: [team('a'), team('b')], prizes: [], favoritedBy: [], createdAt: 0,
    modalities: [mod('m1', ['a', 'b']), mod('m2', [])],
  }
}

describe('validateTeam', () => {
  it('aceita um time válido', () => {
    expect(validateTeam(team('c', { players: [{ id: 'p1', name: 'Lia', number: 10 }] }), tournament())).toEqual([])
  })

  it('aponta nome duplicado (sem diferenciar maiúsculas), sigla, técnico e camisas', () => {
    const errs = validateTeam(
      team('c', { name: ' time A ', short: 'X', coach: ' ', players: [{ id: '1', name: 'Lia', number: 7 }, { id: '2', name: '', number: 7 }, { id: '3', name: 'Rui', number: 120 }] }),
      tournament(),
    )
    expect(errs).toEqual([
      'Já existe um time com esse nome.',
      'A sigla deve ter de 2 a 4 letras ou números.',
      'Informe o técnico(a).',
      'Atleta 2: informe o nome.',
      'Atleta 2: camisa 7 repetida.',
      'Rui: número da camisa deve ser de 0 a 99.',
    ])
  })

  it('editar o próprio time não conta como nome duplicado', () => {
    expect(validateTeam(team('a'), tournament())).toEqual([])
  })
})

describe('upsertTeam', () => {
  it('cadastra e inscreve nas modalidades escolhidas', () => {
    const t = upsertTeam(tournament(), team('c', { name: '  Novos  ', short: 'nov' }), ['m2'])
    expect(t.teams.find((x) => x.id === 'c')).toMatchObject({ name: 'Novos', short: 'NOV' })
    expect(t.modalities[0].teamIds).toEqual(['a', 'b'])
    expect(t.modalities[1].teamIds).toEqual(['c'])
  })

  it('desinscrever remove também da lista de cabeças de chave', () => {
    let t = toggleSeed(tournament(), 'm1', 'a')
    expect(t.modalities[0].seeds).toEqual(['a'])
    t = upsertTeam(t, team('a'), [])
    expect(t.modalities[0].teamIds).toEqual(['b'])
    expect(t.modalities[0].seeds).toEqual([])
  })

  it('não mexe em inscrições de modalidade com jogos gerados', () => {
    const base = tournament()
    base.modalities[0] = generateMatches(base.modalities[0])
    const t = upsertTeam(base, team('a', { name: 'Renomeado' }), [])
    expect(t.modalities[0].teamIds).toContain('a')
    expect(t.teams[0].name).toBe('Renomeado')
  })
})

describe('removeTeam', () => {
  it('remove time e inscrições', () => {
    const t = removeTeam(tournament(), 'a')
    expect(t.teams.map((x) => x.id)).toEqual(['b'])
    expect(t.modalities[0].teamIds).toEqual(['b'])
  })

  it('bloqueia time com jogos gerados', () => {
    const base = tournament()
    base.modalities[0] = generateMatches(base.modalities[0])
    expect(() => removeTeam(base, 'a')).toThrow()
  })
})

describe('prêmios', () => {
  const prize = (p: Partial<Prize> = {}): Prize => ({ id: 'pz', name: 'Troféu', kind: 'coletivo', place: 1, ...p })

  it('valida nome, colocação e valor', () => {
    expect(validatePrize(prize())).toEqual([])
    expect(validatePrize(prize({ name: ' ', place: 0, value: -5 }))).toHaveLength(3)
  })

  it('entrega ao campeão da modalidade quando ela termina', () => {
    let t = tournament()
    t = { ...t, modalities: [generateMatches(t.modalities[0])] }
    const p = prize({ modalityId: 'm1' })
    expect(prizeWinners(t, p)).toEqual([])
    const final = t.modalities[0].matches[0]
    t = { ...t, modalities: [applySumula(t.modalities[0], final.id, { kind: 'pontos', a: 0, b: 1, cards: [] })] }
    expect(prizeWinners(t, p).map((x) => x.id)).toEqual([final.b])
    expect(prizeWinners(t, prize({ modalityId: 'm1', place: 2 })).map((x) => x.id)).toEqual([final.a])
  })

  it('"Geral" só resolve quando há uma única modalidade', () => {
    const t = tournament()
    expect(prizeModality(t, prize())).toBeUndefined()
    expect(prizeModality({ ...t, modalities: [t.modalities[0]] }, prize())?.id).toBe('m1')
  })

  it('cadastra ordenado por colocação e limpa contemplado de prêmio coletivo', () => {
    let t = upsertPrize(tournament(), prize({ id: 'b', place: 2, awardee: 'X' }))
    t = upsertPrize(t, prize({ id: 'a', place: 1, kind: 'individual', awardee: '  Lia  ' }))
    expect(t.prizes.map((p) => [p.id, p.awardee])).toEqual([['a', 'Lia'], ['b', undefined]])
    expect(removePrize(t, 'a').prizes.map((p) => p.id)).toEqual(['b'])
  })
})

describe('árbitros', () => {
  it('valida e adiciona', () => {
    expect(validateReferee('  ', tournament())).toBeDefined()
    expect(validateReferee('rita', tournament())).toBe('Árbitro já cadastrado.')
    expect(addReferee(tournament(), ' Caio ').referees).toEqual(['Rita', 'Caio'])
  })

  it('não remove árbitro escalado em partida pendente', () => {
    const base = tournament()
    base.modalities[0] = { ...generateMatches(base.modalities[0]) }
    base.modalities[0].matches = base.modalities[0].matches.map((m) => ({ ...m, referee: 'Rita' }))
    expect(refereeAssignments(base, 'Rita').length).toBeGreaterThan(0)
    expect(() => removeReferee(base, 'Rita')).toThrow()
    expect(removeReferee(tournament(), 'Rita').referees).toEqual([])
  })
})
