import { describe, expect, it } from 'vitest'
import { detectConflicts, generateMatches } from './engine'
import { freshState } from './state'
import {
  canRecord,
  createTournament,
  draw,
  editDetails,
  isClosed,
  optimize,
  recordLive,
  recordSumula,
  splitList,
  transition,
  transitionErrors,
  validateDetails,
  type TournamentDetails,
  type TournamentDraft,
} from './tournament'
import type { Modality, Sumula, Tournament } from './types'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`)
const mod = (id: string, teamIds: string[], p: Partial<Modality> = {}): Modality => ({ id, sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teamIds, seeds: [], groups: [], matches: [], ...p })
const base = (p: Partial<Tournament> = {}): Tournament => ({
  id: 'T', name: 'Copa', description: 'd', orgId: 'o1', organizerId: 'u1', visibility: 'publico', status: 'publicado',
  startDate: '2026-11-10', endDate: '2026-11-20', city: 'Salvador', venueName: 'Ginásio', venues: ['Q1', 'Q2'], referees: ['R1', 'R2'],
  cover: ['#000', '#fff'], teams: [], prizes: [], favoritedBy: [], createdAt: 0, modalities: [mod('m', ids(4))], ...p,
})
const win = (a: number, b: number): Sumula => ({ kind: 'pontos', a, b, cards: [] })

/** Joga todas as partidas disponíveis (time de menor índice vence). */
function playAll(t: Tournament) {
  for (let guard = 0; guard < 100; guard++) {
    const m = t.modalities[0].matches.find((x) => !x.bye && x.status !== 'encerrada' && x.a && x.b)
    if (!m) break
    t = recordSumula(t, 'm', m.id, Number(m.a!.slice(1)) < Number(m.b!.slice(1)) ? win(1, 0) : win(0, 1))
  }
  return t
}

describe('máquina de estados do torneio (RN11)', () => {
  it('segue publicado → chaveamento → andamento → finalizado', () => {
    let t = transition(base({ status: 'criacao' }), 'publicado')
    expect(t.status).toBe('publicado')
    t = transition(t, 'chaveamento')
    expect(t.status).toBe('chaveamento')
    expect(t.modalities[0].matches.length).toBeGreaterThan(0) // fechar inscrições gera os jogos
    t = transition(t, 'andamento')
    expect(transitionErrors(t, 'finalizado')[0]).toMatch(/partidas sem resultado/)
    t = playAll(t)
    expect(t.status).toBe('finalizado') // a última súmula encerra o torneio sozinha
  })

  it('fechar inscrições mantém modalidades já sorteadas', () => {
    const sorteada = generateMatches(mod('m', ids(4)))
    const t = transition(base({ modalities: [sorteada, mod('n', ids(2))] }), 'chaveamento')
    // mesmos confrontos (a agenda é refeita para incluir a modalidade nova)
    const pairs = (ms: typeof sorteada.matches) => ms.map((m) => [m.id, m.a, m.b])
    expect(pairs(t.modalities[0].matches)).toEqual(pairs(sorteada.matches))
    expect(t.modalities[1].matches.length).toBe(1)
    // tudo já sorteado: só muda o estado
    expect(transition({ ...t, status: 'publicado' }, 'chaveamento').modalities).toEqual(t.modalities)
  })

  it('bloqueia saltos e voltas', () => {
    expect(() => transition(base(), 'andamento')).toThrow(/Não é possível/)
    expect(() => transition(base({ status: 'andamento' }), 'publicado')).toThrow(/Não é possível/)
    expect(() => transition(base({ status: 'finalizado' }), 'cancelado')).toThrow(/encerrado/)
  })

  it('não fecha inscrições com modalidade sem 2 times ou sem modalidades', () => {
    expect(transitionErrors(base({ modalities: [mod('m', ['t1'])] }), 'chaveamento')).toEqual(['Futsal: inscreva ao menos 2 times.'])
    expect(transitionErrors(base({ modalities: [] }), 'chaveamento')).toEqual(['Cadastre ao menos uma modalidade.'])
  })

  it('cancelar vale para qualquer estado ativo', () => {
    for (const status of ['criacao', 'publicado', 'chaveamento', 'andamento'] as const) expect(transition(base({ status }), 'cancelado').status).toBe('cancelado')
    expect(isClosed(base({ status: 'cancelado' }))).toBe(true)
  })
})

describe('súmulas e estados', () => {
  it('só registra com chave definida ou em andamento', () => {
    expect(canRecord(base({ status: 'chaveamento' }))).toBe(true)
    for (const status of ['publicado', 'finalizado', 'cancelado'] as const) {
      const t = draw(base(), 'm')
      const m = t.modalities[0].matches.find((x) => x.a && x.b)!
      expect(() => recordSumula({ ...t, status }, 'm', m.id, win(1, 0))).toThrow(/em andamento/)
      expect(() => recordLive({ ...t, status }, 'm', m.id, win(1, 0))).toThrow(/em andamento/)
    }
  })

  it('placar ao vivo coloca a partida e o torneio em andamento', () => {
    const t = draw(base(), 'm')
    const m = t.modalities[0].matches.find((x) => x.a && x.b)!
    const live = recordLive(t, 'm', m.id, win(1, 1))
    expect(live.status).toBe('andamento')
    expect(live.modalities[0].matches.find((x) => x.id === m.id)).toMatchObject({ status: 'ao_vivo', sumula: win(1, 1) })
  })

  it('ao vivo recusa partida sem adversários, já encerrada ou súmula inválida', () => {
    const t = draw(base(), 'm')
    const final = t.modalities[0].matches.find((x) => !x.nextMatchId)!
    expect(() => recordLive(t, 'm', final.id, win(0, 0))).toThrow(/adversários/)
    const m = t.modalities[0].matches.find((x) => x.a && x.b)!
    expect(() => recordLive(t, 'm', m.id, win(-1, 0))).toThrow(/não negativos/)
    const done = recordSumula(t, 'm', m.id, win(1, 0))
    expect(() => recordLive(done, 'm', m.id, win(2, 0))).toThrow(/encerrada/)
  })
})

describe('sorteio', () => {
  it('gera, agenda e fecha as inscrições', () => {
    const t = draw(base(), 'm')
    expect(t.status).toBe('chaveamento')
    expect(detectConflicts(t)).toEqual([])
    // em andamento continua em andamento
    expect(draw({ ...t, status: 'andamento' }, 'm').status).toBe('andamento')
  })

  it('aceita nº de grupos e classificados', () => {
    const t = draw(base({ modalities: [mod('m', ids(9), { format: 'grupos_mata' })] }), 'm', { groupCount: 3, advance: 1 })
    expect(t.modalities[0].groups).toHaveLength(3)
    expect(t.modalities[0].advancePerGroup).toBe(1)
  })

  it('recusa torneio encerrado, modalidade inexistente ou com menos de 2 times', () => {
    expect(() => draw(base({ status: 'finalizado' }), 'm')).toThrow(/encerrado/)
    expect(() => draw(base(), 'x')).toThrow(/não encontrada/)
    expect(() => draw(base({ modalities: [mod('m', ['t1'])] }), 'm')).toThrow(/ao menos 2/)
  })
})

describe('otimização', () => {
  it('reagenda a partir da data indicada e recusa torneio encerrado', () => {
    const t = optimize(draw(base(), 'm'), '2026-11-15')
    expect(t.modalities[0].matches.filter((m) => !m.bye).every((m) => m.date! >= '2026-11-15')).toBe(true)
    expect(() => optimize(base({ status: 'cancelado' }))).toThrow()
    // sem data: usa hoje (aqui, antes do período → começa no primeiro dia)
    expect(optimize(draw(base(), 'm')).modalities[0].matches.some((m) => m.date)).toBe(true)
  })
})

describe('dados do torneio (criar/editar)', () => {
  const details = (p: Partial<TournamentDetails> = {}): TournamentDetails => ({
    name: 'Copa Nova', description: '', startDate: '2026-11-10', endDate: '2026-11-20', city: 'X', venueName: 'Y', venues: ['Q1'], visibility: 'publico', ...p,
  })

  it('valida nome, datas, espaços e código', () => {
    expect(validateDetails(details(), [], 'u1')).toEqual([])
    expect(validateDetails(details({ name: 'ab', startDate: '', venues: [], visibility: 'privado', accessCode: 'x' }), [], 'u1')).toEqual([
      'Dê um nome ao torneio (mín. 3 letras).',
      'Informe as datas de início e fim.',
      'Informe ao menos uma quadra ou espaço.',
      'Torneio privado precisa de um código com 4+ caracteres.',
    ])
    expect(validateDetails(details({ endDate: '2026-11-01' }), [], 'u1')).toEqual(['A data final deve ser depois da inicial.'])
  })

  it('nome único por organizador (RN02), ignorando maiúsculas e o próprio torneio', () => {
    const existentes = [base({ id: 'A', name: 'Copa Nova' }), base({ id: 'B', name: 'Outra', organizerId: 'u2' })]
    expect(validateDetails(details({ name: ' copa nova ' }), existentes, 'u1')).toEqual(['Você já tem um torneio com esse nome.'])
    expect(validateDetails(details({ name: 'Copa Nova' }), existentes, 'u1', 'A')).toEqual([])
    expect(validateDetails(details({ name: 'Outra' }), existentes, 'u1')).toEqual([])
  })

  it('edita dados e visibilidade', () => {
    const t = editDetails(base(), details({ name: ' Copa 2 ', description: ' ', visibility: 'privado', accessCode: ' abcd ' }), [])
    expect(t).toMatchObject({ name: 'Copa 2', description: 'd', visibility: 'privado', accessCode: 'ABCD' })
    expect(editDetails(t, details({ visibility: 'publico', accessCode: 'ABCD' }), []).accessCode).toBeUndefined()
    expect(() => editDetails(base(), details({ name: '' }), [])).toThrow()
  })

  it('mudar período ou espaços reagenda pendentes e limpa espaços removidos das modalidades', () => {
    const t = draw(base({ modalities: [mod('m', ids(4), { venues: ['Q1', 'Q2'] })] }), 'm')
    const moved = editDetails(t, details({ name: 'Copa', startDate: '2026-12-01', endDate: '2026-12-10', venues: ['Q2'] }), [])
    expect(moved.modalities[0].venues).toEqual(['Q2'])
    expect(moved.modalities[0].matches.filter((m) => !m.bye).every((m) => m.date! >= '2026-12-01' && m.venue === 'Q2')).toBe(true)
    expect(detectConflicts(moved)).toEqual([])
  })

  it('torneio encerrado não é reagendado; datas novas deixam partida fixada fora do período sinalizada', () => {
    const t = draw(base(), 'm')
    const closed = editDetails({ ...t, status: 'cancelado' }, details({ name: 'Copa', startDate: '2026-12-01', endDate: '2026-12-10', venues: ['Q1', 'Q2'] }), [])
    expect(closed.modalities).toEqual(t.modalities)
    const pinned = { ...t, modalities: [{ ...t.modalities[0], matches: t.modalities[0].matches.map((m) => ({ ...m, pinned: true })) }] }
    const out = editDetails(pinned, details({ name: 'Copa', startDate: '2026-12-01', endDate: '2026-12-10', venues: ['Q1', 'Q2'] }), [])
    expect(detectConflicts(out).some((c) => c.reason === 'Partida fora do período do torneio')).toBe(true)
  })

  it('splitList limpa espaços, vazios e repetidos', () => {
    expect(splitList(' Quadra 1, Quadra 2 ,, Quadra 1 ')).toEqual(['Quadra 1', 'Quadra 2'])
  })
})

describe('criação de torneio (compartilhada com o servidor)', () => {
  const org = { id: 'u1', name: 'Org', role: 'organizador' as const, orgId: 'o1' }
  const draft = (p: Partial<TournamentDraft> = {}): TournamentDraft => ({
    name: 'Copa', description: '', startDate: '2026-11-10', endDate: '2026-11-20', city: 'X', venueName: 'Y', venues: ['Q1'], visibility: 'publico',
    referees: ['R'], cover: ['#000000', '#ffffff'], prizes: [{ name: 'T', kind: 'coletivo', place: 1, modalityId: 'm' }], generateNow: false,
    modalities: [{ id: 'm', sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teams: ['A', 'B'], seeds: ['B'] }],
    ...p,
  })

  it('monta times, modalidades, cabeças de chave e prêmios; sem sortear fica publicado', () => {
    const t = createTournament(draft({ description: '  ' }), org, [], 123)
    expect(t).toMatchObject({ status: 'publicado', organizerId: 'u1', orgId: 'o1', createdAt: 123, description: 'Torneio criado no PlayOff.' })
    expect(t.teams.map((x) => x.name)).toEqual(['A', 'B'])
    expect(t.modalities[0].seeds).toEqual([t.teams[1].id])
    expect(t.prizes[0].modalityId).toBe('m')
  })

  it('sorteando na criação: chaveamento definido; prêmio de modalidade inexistente vira Geral', () => {
    const t = createTournament(draft({ generateNow: true, visibility: 'privado', accessCode: 'abcd', prizes: [{ name: 'T', kind: 'coletivo', place: 1, modalityId: 'outra' }] }), { ...org, orgId: undefined }, [])
    expect(t).toMatchObject({ status: 'chaveamento', accessCode: 'ABCD', orgId: 'o1' })
    expect(t.modalities[0].matches.length).toBe(1)
    expect(t.prizes[0].modalityId).toBeUndefined()
  })

  it('recusa espectador e cada tipo de erro do rascunho', () => {
    expect(() => createTournament(draft(), { id: 'u2', name: 'F', role: 'espectador' }, [])).toThrow(/Só organizadores/)
    const err = (p: Partial<TournamentDraft>) => () => createTournament(draft(p), org, [])
    expect(err({ referees: [] })).toThrow('Informe ao menos um árbitro.')
    expect(err({ modalities: [] })).toThrow('Adicione pelo menos uma modalidade.')
    expect(err({ modalities: [{ sport: 'Nado', kind: 'colocacao', category: 'M', format: 'eliminacao', teams: ['A', 'B'], seeds: [] }] })).toThrow(/combina só com o formato prova/)
    expect(err({ modalities: [{ sport: 'F', kind: 'pontos', category: 'M', format: 'eliminacao', teams: ['A', ' a '], seeds: [] }] })).toThrow(/vazios ou repetidos/)
    expect(err({ modalities: [{ sport: 'F', kind: 'pontos', category: 'M', format: 'eliminacao', teams: ['A', 'B'], seeds: ['Z'] }] })).toThrow(/fora da lista/)
    expect(err({ prizes: [{ name: '', kind: 'coletivo', place: 1 }] })).toThrow(/Prêmio 1/)
    expect(err({ generateNow: true, modalities: [{ sport: 'V', kind: 'set', category: 'F', format: 'dupla_eliminacao', teams: ['A', 'B', 'C'], seeds: [] }] })).toThrow(/dupla eliminação/)
  })

  it('pontos corridos guarda turno/returno; id e submodalidade opcionais', () => {
    const t = createTournament(draft({ modalities: [{ sport: 'Liga', kind: 'pontos', category: 'Misto', sub: ' Dupla ', format: 'pontos_corridos', returno: true, teams: ['A', 'B', 'C'], seeds: [] }] }), org, [])
    expect(t.modalities[0]).toMatchObject({ returno: true, sub: 'Dupla' })
    expect(t.modalities[0].id).toMatch(/^md_/)
  })

  it('editar removendo todos os espaços próprios da modalidade volta a usar os do torneio', () => {
    const t = base({ modalities: [mod('m', ids(2), { venues: ['Q1'] })] })
    const e = editDetails(t, { name: 'Copa', description: '', startDate: t.startDate, endDate: t.endDate, city: 'X', venueName: 'Y', venues: ['Q2'], visibility: 'publico' }, [])
    expect(e.modalities[0].venues).toBeUndefined()
  })
})

describe('dados de demonstração continuam válidos com as regras novas', () => {
  it('seed carrega sem violar regras', () => {
    expect(freshState().tournaments).toHaveLength(4)
  })
})
