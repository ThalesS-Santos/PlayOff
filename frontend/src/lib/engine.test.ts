import { describe, expect, it } from 'vitest'
import {
  applySumula,
  champion,
  defaultGroupCount,
  detectConflicts,
  formatErrors,
  generateDoubleElimination,
  generateElimination,
  generateGroups,
  generateMatches,
  groupCountOptions,
  MAX_SCORE,
  MAX_SET,
  MAX_TIME_MS,
  placeOf,
  reschedule,
  resultLocked,
  sumulaErrors,
  roundRobin,
  scheduleTournament,
  seedOrder,
  slotConflicts,
  standings,
  unpin,
  winnerOf,
} from './engine'
import { buildSeed } from './seed'
import type { Match, Modality, Sumula, Tournament } from './types'

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`)
const win = (a: number, b: number): Sumula => ({ kind: 'pontos', a, b, cards: [] })

function mod(p: Partial<Modality> & Pick<Modality, 'format' | 'teamIds'>): Modality {
  return { id: 'm', sport: 'Futsal', kind: 'pontos', category: 'M', seeds: [], groups: [], matches: [], ...p }
}

/** Joga todas as partidas disponíveis; o time "mais forte" (menor índice) vence. */
function playAll(m: Modality, sumula = (x: Match): Sumula => (Number(x.a!.slice(1)) < Number(x.b!.slice(1)) ? win(2, 0) : win(0, 2))) {
  let cur = m
  for (let guard = 0; guard < 200; guard++) {
    const next = cur.matches.find((x) => !x.bye && x.status !== 'encerrada' && x.a && x.b)
    if (!next) break
    cur = applySumula(cur, next.id, sumula(next))
  }
  return cur
}

describe('seedOrder', () => {
  it('separa os cabeças de chave em metades opostas', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3])
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
})

describe('eliminação simples', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 13, 16])('%i times: chave completa e um campeão', (n) => {
    const seeds = teams(n)
    const matches = generateElimination('m', seeds)
    const p = 2 ** Math.ceil(Math.log2(n))
    expect(matches).toHaveLength(p - 1)
    expect(matches.filter((m) => m.bye)).toHaveLength(p - n)
    // todo time aparece exatamente uma vez na 1ª rodada
    const r1 = matches.filter((m) => m.round === 1).flatMap((m) => [m.a, m.b]).filter(Boolean)
    expect(r1.sort()).toEqual([...seeds].sort())
    const done = playAll(mod({ format: 'eliminacao', teamIds: seeds, matches }))
    expect(champion(done)).toBe('t1')
  })

  it('byes vão para os melhores cabeças de chave', () => {
    const matches = generateElimination('m', teams(6))
    const byeTeams = matches.filter((m) => m.bye).map((m) => m.a ?? m.b)
    expect(byeTeams.sort()).toEqual(['t1', 't2'])
  })

  it('recusa encerrar mata-mata empatado sem pênaltis', () => {
    const m = mod({ format: 'eliminacao', teamIds: teams(4), matches: generateElimination('m', teams(4)) })
    const first = m.matches[0]
    expect(() => applySumula(m, first.id, win(1, 1))).toThrow(/vencedor/)
    const ok = applySumula(m, first.id, { ...win(1, 1), penA: 5, penB: 4 } as Sumula)
    expect(ok.matches.find((x) => x.id === first.nextMatchId)![first.nextSide!]).toBe(first.a)
  })

  it('súmula de set: vence quem ganha mais sets', () => {
    const m: Match = { id: 'x', phase: 'Final', round: 1, slot: 0, a: 'A', b: 'B', status: 'encerrada', sumula: { kind: 'set', sets: [[25, 20], [18, 25], [15, 10]], cards: [] } }
    expect(winnerOf(m)).toBe('A')
  })
})

describe('round-robin', () => {
  it.each([3, 4, 5, 6, 7])('%i times: todos se enfrentam uma vez, sem jogar duas vezes na rodada', (n) => {
    const rounds = roundRobin(teams(n))
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join('-'))
    expect(new Set(pairs).size).toBe((n * (n - 1)) / 2)
    expect(pairs).toHaveLength((n * (n - 1)) / 2)
    for (const r of rounds) {
      const ids = r.flat()
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('fase de grupos + mata-mata', () => {
  it.each([
    [8, 2],
    [12, 3],
    [16, 4],
    [15, 5],
    [14, 7],
  ])('%i times em %i grupos: classificados preenchem a chave e há campeão', (n, g) => {
    const seeds = teams(n)
    const { groups, matches } = generateGroups('m', seeds, g)
    expect(groups.flatMap((x) => x.teamIds).sort()).toEqual([...seeds].sort())
    // na 1ª rodada do mata-mata, nunca dois classificados do mesmo grupo
    for (const m of matches.filter((x) => !x.groupId && x.round === 1 && x.sourceA && x.sourceB))
      expect(m.sourceA!.groupId).not.toBe(m.sourceB!.groupId)
    const done = playAll(mod({ format: 'grupos_mata', teamIds: seeds, groups, matches }))
    expect(done.matches.every((m) => m.status === 'encerrada')).toBe(true)
    expect(champion(done)).toBe('t1')
  })

  it('3 grupos não geram confronto repetido do mesmo grupo', () => {
    const { matches } = generateGroups('m', teams(9), 3)
    const ko = matches.filter((x) => !x.groupId)
    const labels = ko.filter((x) => x.round === 1 && !x.bye).map((x) => `${x.placeholderA} x ${x.placeholderB}`)
    expect(labels).not.toContain('1º Grupo C x 2º Grupo C')
    // 6 classificados únicos entre todos os lados da chave
    const sources = ko.flatMap((x) => [x.sourceA, x.sourceB]).filter(Boolean).map((s) => `${s!.groupId}:${s!.place}`)
    expect(new Set(sources).size).toBe(6)
  })

  it('desempate por confronto direto', () => {
    const group = { id: 'g', name: 'Grupo A', teamIds: ['D', 'C', 'B', 'A'] }
    const mk = (id: string, a: string, b: string, s: Sumula): Match => ({ id, phase: 'Grupo A', round: 1, slot: 0, groupId: 'g', a, b, status: 'encerrada', sumula: s })
    // A e B empatam em pontos, saldo, gols pró e vitórias; A venceu o confronto direto
    const table = standings(group, [mk('1', 'B', 'A', win(0, 1)), mk('2', 'C', 'A', win(1, 0)), mk('3', 'B', 'D', win(1, 0))])
    expect(table.map((s) => s.teamId)).toEqual(['C', 'A', 'B', 'D'])
  })

  it('desempate por fair play quando tudo empata', () => {
    const group = { id: 'g', name: 'Grupo A', teamIds: ['A', 'B'] }
    const m: Match = { id: '1', phase: 'Grupo A', round: 1, slot: 0, groupId: 'g', a: 'A', b: 'B', status: 'encerrada', sumula: { kind: 'pontos', a: 1, b: 1, cards: [{ teamId: 'A', playerId: 'p', color: 'vermelho', minute: 10 }] } }
    expect(standings(group, [m]).map((s) => s.teamId)).toEqual(['B', 'A'])
  })
})

describe('prova (colocação)', () => {
  it('campeão é o menor tempo', () => {
    let m = generateMatches(mod({ format: 'prova', kind: 'colocacao', teamIds: ['A', 'B', 'C'] }))
    m = applySumula(m, m.matches[0].id, { kind: 'colocacao', entries: [{ teamId: 'A', timeMs: 3000 }, { teamId: 'B', timeMs: 2500 }, { teamId: 'C', timeMs: 2800 }] })
    expect(champion(m)).toBe('B')
  })
})

describe('agenda (RF04)', () => {
  function tournament(days: [string, string], venues: string[], referees: string[], n = 8): Tournament {
    return {
      id: 't', name: 'T', description: '', orgId: 'o', organizerId: 'u', visibility: 'publico', status: 'chaveamento',
      startDate: days[0], endDate: days[1], city: '', venueName: '', venues, referees, cover: ['#000', '#fff'],
      teams: [], prizes: [], favoritedBy: [], createdAt: 0,
      modalities: [generateMatches(mod({ format: 'grupos_mata', teamIds: teams(n) }))],
    }
  }

  it('aloca tudo sem conflitos quando há espaço', () => {
    const t = scheduleTournament(tournament(['2026-11-10', '2026-11-20'], ['Quadra 1', 'Quadra 2'], ['R1', 'R2']))
    expect(detectConflicts(t)).toEqual([])
    const ms = t.modalities[0].matches.filter((m) => !m.bye)
    expect(ms.every((m) => m.date && m.time && m.venue && m.referee)).toBe(true)
  })

  it('respeita a ordem das fases', () => {
    const t = scheduleTournament(tournament(['2026-11-10', '2026-11-20'], ['Q1', 'Q2'], ['R1', 'R2']))
    const key = (m: Match) => `${m.date} ${m.time}`
    const ms = t.modalities[0].matches
    const lastGroup = ms.filter((m) => m.groupId).map(key).sort().pop()!
    for (const m of ms.filter((x) => !x.groupId && !x.bye)) expect(key(m) > lastGroup).toBe(true)
  })

  it('cada time joga uma vez por dia e o mata-mata começa no dia seguinte aos grupos', () => {
    const t = scheduleTournament(tournament(['2026-11-10', '2026-11-20'], ['Q1', 'Q2'], ['R1', 'R2']))
    const ms = t.modalities[0].matches.filter((m) => !m.bye)
    const seen = new Set<string>()
    for (const m of ms.filter((x) => x.groupId))
      for (const tm of [m.a, m.b]) {
        expect(seen.has(`${tm}@${m.date}`)).toBe(false)
        seen.add(`${tm}@${m.date}`)
      }
    const lastGroupDay = ms.filter((m) => m.groupId).map((m) => m.date!).sort().pop()!
    for (const m of ms.filter((x) => !x.groupId)) expect(m.date! > lastGroupDay).toBe(true)
    // e cada fase do mata-mata (semifinal → final) em dia posterior à anterior
    const ko = ms.filter((x) => !x.groupId && !x.bye)
    for (const m of ko.filter((x) => x.nextMatchId)) expect(ko.find((x) => x.id === m.nextMatchId)!.date! > m.date!).toBe(true)
  })

  it('torneio de um dia ainda cabe, relaxando o descanso', () => {
    const t = scheduleTournament(tournament(['2026-11-10', '2026-11-10'], ['Q1', 'Q2', 'Q3'], ['R1', 'R2', 'R3'], 4))
    expect(detectConflicts(t)).toEqual([])
  })

  it('sinaliza partidas que não couberam no período', () => {
    const t = scheduleTournament(tournament(['2026-11-10', '2026-11-10'], ['Q1'], ['R1'], 16))
    const c = detectConflicts(t)
    expect(c.some((x) => x.reason.startsWith('Sem horário'))).toBe(true)
  })
})

describe('sorteio configurável', () => {
  it.each([
    [5, 1],
    [6, 2],
    [8, 2],
    [12, 3],
    [20, 5],
  ])('%i times: sugere %i grupo(s)', (n, g) => expect(defaultGroupCount(n)).toBe(g))

  it('respeita nº de grupos e classificados escolhidos', () => {
    const m = generateMatches(mod({ format: 'grupos_mata', teamIds: teams(12), advancePerGroup: 1 }), 4)
    expect(m.groups).toHaveLength(4)
    expect(m.groupCount).toBe(4)
    // 4 classificados → semifinal + final
    expect(m.matches.filter((x) => !x.groupId)).toHaveLength(3)
    expect(champion(playAll(m))).toBe('t1')
  })

  it('grupo único sempre leva 1º e 2º para a final', () => {
    const m = generateMatches(mod({ format: 'grupos_mata', teamIds: teams(4), advancePerGroup: 1 }), 1)
    const ko = m.matches.filter((x) => !x.groupId)
    expect(ko).toHaveLength(1)
    expect(champion(playAll(m))).toBe('t1')
  })

  it('limita grupos a ao menos 2 times cada', () => {
    expect(groupCountOptions(7)).toEqual([1, 2, 3])
    expect(generateMatches(mod({ format: 'grupos_mata', teamIds: teams(6) }), 5).groups).toHaveLength(3)
  })
})

describe('pódio', () => {
  it('eliminação: campeão, vice e semifinalistas em 3º', () => {
    const m = playAll(mod({ format: 'eliminacao', teamIds: teams(8), matches: generateElimination('m', teams(8)) }))
    expect(placeOf(m, 1)).toEqual(['t1'])
    expect(placeOf(m, 2)).toEqual(['t2'])
    expect(placeOf(m, 3).sort()).toEqual(['t3', 't4'])
  })

  it('vazio enquanto a final não acaba', () => {
    expect(placeOf(mod({ format: 'eliminacao', teamIds: teams(4), matches: generateElimination('m', teams(4)) }), 1)).toEqual([])
  })

  it('prova: ordem dos tempos', () => {
    let m = generateMatches(mod({ format: 'prova', kind: 'colocacao', teamIds: ['A', 'B', 'C'] }))
    m = applySumula(m, m.matches[0].id, { kind: 'colocacao', entries: [{ teamId: 'A', timeMs: 3 }, { teamId: 'B', timeMs: 1 }, { teamId: 'C', timeMs: 2 }] })
    expect([1, 2, 3].map((p) => placeOf(m, p)[0])).toEqual(['B', 'C', 'A'])
  })
})

describe('reagendamento manual', () => {
  const base = () =>
    scheduleTournament({
      id: 't', name: 'T', description: '', orgId: 'o', organizerId: 'u', visibility: 'publico', status: 'chaveamento',
      startDate: '2026-11-10', endDate: '2026-11-20', city: '', venueName: '', venues: ['Q1', 'Q2'], referees: ['R1', 'R2'], cover: ['#000', '#fff'],
      teams: [], prizes: [], favoritedBy: [], createdAt: 0,
      modalities: [generateMatches(mod({ format: 'grupos_mata', teamIds: teams(8) }), 2)],
    })

  it('aponta local, árbitro e time ocupados no mesmo horário', () => {
    const t = base()
    const [x, y] = t.modalities[0].matches.filter((m) => m.groupId)
    const sameAsX = { date: x.date!, time: x.time!, venue: x.venue!, referee: x.referee! }
    const r = slotConflicts(t, y.id, sameAsX)
    expect(r.some((s) => s.includes('Q') && s.includes('recebe'))).toBe(true)
    expect(r.some((s) => s.includes('apita'))).toBe(true)
  })

  it('local e árbitro precisam ser do torneio (o servidor não confia na tela)', () => {
    const t = base()
    const x = t.modalities[0].matches.find((m) => m.groupId)!
    const slot = { date: '2026-11-19', time: '20:00', venue: 'Q1', referee: 'R1' }
    expect(slotConflicts(t, x.id, { ...slot, venue: 'Quadra inventada' })).toContain('Quadra inventada não é um espaço desta modalidade.')
    expect(slotConflicts(t, x.id, { ...slot, referee: '' })).toContain('Árbitro não é árbitro deste torneio.')
    expect(slotConflicts(t, x.id, slot).join()).not.toMatch(/não é/)
    // modalidade com espaços próprios: só eles valem
    const own = { ...t, modalities: [{ ...t.modalities[0], venues: ['Q2'] }] }
    expect(slotConflicts(own, x.id, slot)).toContain('Q1 não é um espaço desta modalidade.')
    expect(() => reschedule(t, x.id, { ...slot, venue: 'Lua' })).toThrow('Lua não é um espaço desta modalidade.')
  })

  it('não deixa o mata-mata antes da fase de grupos', () => {
    const t = base()
    const final = t.modalities[0].matches.find((m) => !m.groupId && !m.nextMatchId)!
    expect(slotConflicts(t, final.id, { date: '2026-11-10', time: '09:00', venue: 'Q2', referee: 'R2' }).join()).toMatch(/depois de Grupo/)
    expect(slotConflicts(t, final.id, { date: '2026-12-01', time: '09:00', venue: 'Q2', referee: 'R2' })).toContain('Data fora do período do torneio.')
  })

  it('partida reagendada fica fixa na otimização', () => {
    let t = base()
    const final = t.modalities[0].matches.find((m) => !m.groupId && !m.nextMatchId)!
    const slot = { date: '2026-11-20', time: '20:00', venue: 'Q1', referee: 'R1' }
    t = reschedule(t, final.id, slot)
    t = scheduleTournament(t)
    expect(t.modalities[0].matches.find((m) => m.id === final.id)).toMatchObject({ ...slot, pinned: true })
    expect(detectConflicts(t)).toEqual([])
    t = scheduleTournament(unpin(t, final.id))
    expect(t.modalities[0].matches.find((m) => m.id === final.id)!.date).not.toBe('2026-11-20')
  })

  it('jogos de grupo não vão para depois de um mata-mata fixado', () => {
    let t = base()
    const semi = t.modalities[0].matches.find((m) => !m.groupId && m.nextMatchId)!
    t = reschedule(t, semi.id, { date: semi.date!, time: semi.time!, venue: semi.venue!, referee: semi.referee! })
    t = scheduleTournament(t, '2026-11-10')
    const semiKey = `${semi.date} ${semi.time}`
    for (const m of t.modalities[0].matches.filter((x) => x.groupId)) expect(`${m.date} ${m.time}` < semiKey).toBe(true)
  })
})

describe('validação da súmula', () => {
  it('pontos, pênaltis e cartões', () => {
    expect(sumulaErrors(win(2, 1))).toEqual([])
    expect(sumulaErrors(win(-1, 1.5))).toEqual(['Placar deve ter números inteiros de 0 a 9999.'])
    expect(sumulaErrors({ ...win(1, 1), penA: -1, penB: 2 } as Sumula)).toEqual(['Pênaltis devem ser números inteiros de 0 a 999.'])
    // limites das colunas do banco: o maior valor passa, o seguinte é recusado
    expect(sumulaErrors(win(MAX_SCORE, 0))).toEqual([])
    expect(sumulaErrors(win(MAX_SCORE + 1, 0))).toHaveLength(1)
    expect(sumulaErrors({ ...win(1, 1), penA: MAX_SET + 1, penB: 0 } as Sumula)).toHaveLength(1)
    expect(sumulaErrors({ kind: 'pontos', a: 1, b: 0, cards: [{ teamId: 'a', playerId: 'p', color: 'amarelo', minute: MAX_SET }] })).toEqual([])
    expect(sumulaErrors({ kind: 'pontos', a: 1, b: 0, cards: [{ teamId: 'a', playerId: 'p', color: 'amarelo', minute: MAX_SET + 1 }] })).toEqual(['Cartão sem atleta ou com minuto inválido.'])
    expect(sumulaErrors({ kind: 'pontos', a: 1, b: 0, cards: [{ teamId: 'a', playerId: '', color: 'amarelo', minute: 3 }] })).toEqual(['Cartão sem atleta ou com minuto inválido.'])
  })

  it('sets: sem sets, set empatado ou negativo', () => {
    expect(sumulaErrors({ kind: 'set', sets: [], cards: [] })).toEqual(['Informe ao menos um set.'])
    expect(sumulaErrors({ kind: 'set', sets: [[25, 25], [-1, 3]], cards: [] })).toEqual(['Set 1 empatado: todo set tem um vencedor.', 'Set 2: use números inteiros de 0 a 999.'])
    expect(sumulaErrors({ kind: 'set', sets: [[MAX_SET + 1, 0]], cards: [] })).toEqual(['Set 1: use números inteiros de 0 a 999.'])
  })

  it('colocação: tempos positivos e todos os participantes', () => {
    const m: Match = { id: 'p', phase: 'Final', round: 1, slot: 0, participants: ['A', 'B'], status: 'agendada' }
    expect(sumulaErrors({ kind: 'colocacao', entries: [{ teamId: 'A', timeMs: 1 }, { teamId: 'B', timeMs: 2 }] }, m)).toEqual([])
    expect(sumulaErrors({ kind: 'colocacao', entries: [{ teamId: 'A', timeMs: 0 }] }, m)).toEqual(['Todos os tempos devem ser maiores que zero (e menores que 100 dias).', 'A súmula deve trazer o tempo de todos os participantes.'])
    for (const timeMs of [1.5, MAX_TIME_MS + 1])
      expect(sumulaErrors({ kind: 'colocacao', entries: [{ teamId: 'A', timeMs }, { teamId: 'B', timeMs: 2 }] }, m)).toHaveLength(1)
    expect(sumulaErrors({ kind: 'colocacao', entries: [{ teamId: 'A', timeMs: MAX_TIME_MS }, { teamId: 'B', timeMs: 2 }] }, m)).toEqual([])
    expect(sumulaErrors({ kind: 'colocacao', entries: [{ teamId: 'A', timeMs: 1 }, { teamId: 'X', timeMs: 2 }] }, m)).toEqual(['A súmula deve trazer o tempo de todos os participantes.'])
  })

  it('applySumula recusa partida inexistente, bye, sem adversários e súmula inválida', () => {
    const m = mod({ format: 'eliminacao', teamIds: teams(3), matches: generateElimination('m', teams(3)) })
    const bye = m.matches.find((x) => x.bye)!
    const final = m.matches.find((x) => !x.nextMatchId)!
    const real = m.matches.find((x) => !x.bye && x.round === 1)!
    expect(() => applySumula(m, 'nada', win(1, 0))).toThrow(/não encontrada/)
    expect(() => applySumula(m, bye.id, win(1, 0))).toThrow(/bye/)
    expect(() => applySumula(m, final.id, win(1, 0))).toThrow(/adversários/)
    expect(() => applySumula(m, real.id, win(-2, 0))).toThrow(/de 0 a 9999/)
  })
})

describe('resultado travado (RN14)', () => {
  it('mata-mata: corrige até a próxima partida começar', () => {
    let m = mod({ format: 'eliminacao', teamIds: teams(4), matches: generateElimination('m', teams(4)) })
    const [sf1, sf2] = m.matches.filter((x) => x.round === 1)
    m = applySumula(m, sf1.id, win(2, 0))
    m = applySumula(m, sf1.id, win(0, 2)) // correção permitida: a final ainda não começou
    expect(m.matches.find((x) => !x.nextMatchId)!.a).toBe(sf1.b)
    m = applySumula(m, sf2.id, win(1, 0))
    const final = m.matches.find((x) => !x.nextMatchId)!
    m = { ...m, matches: m.matches.map((x) => (x.id === final.id ? { ...x, status: 'ao_vivo' as const } : x)) }
    expect(resultLocked(m, m.matches.find((x) => x.id === sf1.id)!)).toBe(true)
    expect(() => applySumula(m, sf1.id, win(3, 0))).toThrow(/fase seguinte/)
  })

  it('grupos: travam quando o mata-mata começa; partidas pendentes nunca travam', () => {
    let m = generateMatches(mod({ format: 'grupos_mata', teamIds: teams(8) }), 2)
    const g = m.matches.find((x) => x.groupId)!
    expect(resultLocked(m, g)).toBe(false)
    m = applySumula(m, g.id, win(1, 0))
    expect(resultLocked(m, m.matches.find((x) => x.id === g.id)!)).toBe(false)
    const ko = m.matches.find((x) => !x.groupId)!
    m = { ...m, matches: m.matches.map((x) => (x.id === ko.id ? { ...x, status: 'encerrada' as const } : x)) }
    expect(resultLocked(m, m.matches.find((x) => x.id === g.id)!)).toBe(true)
    // prova (sem próxima partida nem grupo) nunca trava
    const p = generateMatches(mod({ format: 'prova', kind: 'colocacao', teamIds: ['A', 'B'] }))
    expect(resultLocked(p, { ...p.matches[0], status: 'encerrada' })).toBe(false)
  })
})

describe('pontos corridos', () => {
  it.each([4, 5, 6])('turno único com %i times: todos se enfrentam uma vez; campeão é o 1º', (n) => {
    const m = generateMatches(mod({ format: 'pontos_corridos', teamIds: teams(n) }))
    expect(m.groups).toHaveLength(1)
    expect(m.matches).toHaveLength((n * (n - 1)) / 2)
    expect(m.matches.every((x) => x.groupId === m.groups[0].id && x.phase.startsWith('Rodada'))).toBe(true)
    expect(champion(m)).toBeUndefined()
    const done = playAll(m)
    expect(champion(done)).toBe('t1')
    expect(placeOf(done, 2)).toEqual(['t2'])
    expect(placeOf(done, 99)).toEqual([])
  })

  it('turno e returno: cada dupla joga duas vezes com mando invertido', () => {
    const m = generateMatches(mod({ format: 'pontos_corridos', teamIds: teams(4), returno: true }))
    expect(m.matches).toHaveLength(12)
    expect(Math.max(...m.matches.map((x) => x.round))).toBe(6)
    const ida = m.matches.find((x) => x.a === 't1' && x.b === 't2') ?? m.matches.find((x) => x.a === 't2' && x.b === 't1')!
    expect(m.matches.some((x) => x.a === ida.b && x.b === ida.a)).toBe(true)
  })

  it('aceita empate (não é mata-mata) e agenda uma rodada por dia', () => {
    let m = generateMatches(mod({ format: 'pontos_corridos', teamIds: teams(4) }))
    m = applySumula(m, m.matches[0].id, win(1, 1))
    expect(m.matches[0].status).toBe('encerrada')
    const t: Tournament = {
      id: 't', name: 'T', description: '', orgId: 'o', organizerId: 'u', visibility: 'publico', status: 'chaveamento',
      startDate: '2026-11-10', endDate: '2026-11-20', city: '', venueName: '', venues: ['Q1', 'Q2'], referees: ['R1', 'R2'], cover: ['#000', '#fff'],
      teams: [], prizes: [], favoritedBy: [], createdAt: 0, modalities: [generateMatches(mod({ format: 'pontos_corridos', teamIds: teams(6) }))],
    }
    const s = scheduleTournament(t)
    expect(detectConflicts(s)).toEqual([])
    const ms = s.modalities[0].matches
    for (let r = 2; r <= 5; r++) {
      const prev = ms.filter((x) => x.round === r - 1).map((x) => x.date!).sort().pop()!
      expect(ms.filter((x) => x.round === r).every((x) => x.date! > prev)).toBe(true)
    }
  })
})

describe('dupla eliminação', () => {
  it.each([3, 4, 5, 6, 7, 8, 11, 12, 16, 20, 32])('%i times: 2n-1 partidas, ninguém sai com uma derrota, campeão e pódio', (n) => {
    const m = generateMatches(mod({ format: 'dupla_eliminacao', teamIds: teams(n) }))
    const W = m.matches.filter((x) => x.bracket === 'W' && !x.bye)
    const L = m.matches.filter((x) => x.bracket === 'L')
    expect(W).toHaveLength(n - 1)
    expect(L).toHaveLength(n - 2)
    expect(L.every((x) => !x.bye)).toBe(true)
    expect(m.matches.filter((x) => x.bracket === 'F')).toHaveLength(1)
    // toda partida jogada da chave principal manda o perdedor para a chave dos perdedores; bye não
    expect(W.every((x) => x.loserNextMatchId && L.some((l) => l.id === x.loserNextMatchId))).toBe(true)
    expect(m.matches.filter((x) => x.bye).every((x) => !x.loserNextMatchId)).toBe(true)
    // cada partida dos perdedores recebe exatamente dois times, e cada lado tem um rótulo
    for (const l of L) {
      const feeds = m.matches.filter((x) => x.nextMatchId === l.id || x.loserNextMatchId === l.id)
      expect(feeds, l.id).toHaveLength(2)
      expect(l.placeholderA && l.placeholderB, l.id).toBeTruthy()
    }
    // rodadas dos perdedores numeradas a partir de 1 e posições sem buracos
    const rounds = [...new Set(L.map((x) => x.round))].sort((a, b) => a - b)
    expect(rounds).toEqual(rounds.map((_, i) => i + 1))
    for (const r of rounds) expect(L.filter((x) => x.round === r).map((x) => x.slot)).toEqual(L.filter((x) => x.round === r).map((_, i) => i))

    const done = playAll(m)
    expect(done.matches.every((x) => x.status === 'encerrada')).toBe(true)
    // cada time perde no máximo duas vezes; só o campeão termina invicto ou com uma derrota
    const losses = new Map<string, number>()
    for (const x of done.matches.filter((y) => !y.bye)) {
      const w = winnerOf(x)!
      const l = w === x.a ? x.b! : x.a!
      losses.set(l, (losses.get(l) ?? 0) + 1)
    }
    expect([...losses.values()].every((v) => v <= 2)).toBe(true)
    expect(champion(done)).toBe('t1')
    expect(losses.get('t1')).toBeUndefined()
    expect(placeOf(done, 2)).toEqual(['t2'])
    expect(placeOf(done, 3)).toHaveLength(1)
  })

  it('6 times: rótulos apontam para a partida certa depois da poda', () => {
    const m = generateMatches(mod({ format: 'dupla_eliminacao', teamIds: teams(6) }))
    const L = m.matches.filter((x) => x.bracket === 'L').map((x) => [x.phase, x.placeholderA, x.placeholderB])
    expect(L).toEqual([
      ['Perdedores · R1', 'Perd. V1-2', 'Perd. V2-2'],
      ['Perdedores · R1', 'Perd. V1-4', 'Perd. V2-1'],
      ['Perdedores · R2', 'Venc. P1-1', 'Venc. P1-2'],
      ['Final dos perdedores', 'Venc. P2-1', 'Perd. V3-1'],
    ])
  })

  it('quem perde na chave principal reaparece na chave dos perdedores', () => {
    let m = generateMatches(mod({ format: 'dupla_eliminacao', teamIds: teams(4) }))
    const w1 = m.matches.find((x) => x.bracket === 'W' && x.round === 1)!
    m = applySumula(m, w1.id, win(0, 3))
    const l1 = m.matches.find((x) => x.id === w1.loserNextMatchId)!
    expect(l1[w1.loserNextSide!]).toBe(w1.a)
    // corrigir o resultado antes da próxima partida começar troca quem caiu
    m = applySumula(m, w1.id, win(3, 0))
    expect(m.matches.find((x) => x.id === w1.loserNextMatchId)![w1.loserNextSide!]).toBe(w1.b)
  })

  it('resultado trava quando a partida do perdedor já começou', () => {
    let m = generateMatches(mod({ format: 'dupla_eliminacao', teamIds: teams(4) }))
    const [a, b] = m.matches.filter((x) => x.bracket === 'W' && x.round === 1)
    m = applySumula(applySumula(m, a.id, win(1, 0)), b.id, win(1, 0))
    const l1 = m.matches.find((x) => x.id === a.loserNextMatchId)!
    m = { ...m, matches: m.matches.map((x) => (x.id === l1.id ? { ...x, status: 'ao_vivo' as const } : x)) }
    expect(resultLocked(m, m.matches.find((x) => x.id === a.id)!)).toBe(true)
  })

  it('agenda respeita dependências entre as chaves, sem conflitos', () => {
    const t: Tournament = {
      id: 't', name: 'T', description: '', orgId: 'o', organizerId: 'u', visibility: 'publico', status: 'chaveamento',
      startDate: '2026-11-10', endDate: '2026-11-30', city: '', venueName: '', venues: ['Q1', 'Q2'], referees: ['R1', 'R2'], cover: ['#000', '#fff'],
      teams: [], prizes: [], favoritedBy: [], createdAt: 0, modalities: [generateMatches(mod({ format: 'dupla_eliminacao', teamIds: teams(8) }))],
    }
    const s = scheduleTournament(t)
    expect(detectConflicts(s)).toEqual([])
    const ms = s.modalities[0].matches
    const key = (x: Match) => `${x.date} ${x.time}`
    for (const x of ms)
      for (const to of [x.nextMatchId, x.loserNextMatchId].filter(Boolean)) expect(key(ms.find((y) => y.id === to)!) > key(x)).toBe(true)
  })

  it('quantidade de times', () => {
    expect(formatErrors('dupla_eliminacao', 2)).toEqual(['dupla eliminação exige de 3 a 32 times'])
    expect(formatErrors('dupla_eliminacao', 33)).toHaveLength(1)
    expect(formatErrors('dupla_eliminacao', 3)).toEqual([])
    expect(formatErrors('dupla_eliminacao', 6)).toEqual([])
    expect(formatErrors('eliminacao', 1)).toEqual(['inscreva ao menos 2 times'])
    expect(formatErrors('pontos_corridos', 3)).toEqual([])
    expect(() => generateDoubleElimination('m', teams(2))).toThrow(/de 3 a 32/)
    expect(() => generateDoubleElimination('m', teams(33))).toThrow(/de 3 a 32/)
  })
})

describe('dados de demonstração', () => {
  it('só a Liga Corporativa tem conflitos (propositais), e o otimizador os resolve', () => {
    for (const t of buildSeed()) {
      if (t.id === 't3') {
        expect(detectConflicts(t).length).toBeGreaterThan(0)
        expect(detectConflicts(scheduleTournament(t, '2026-10-22'))).toEqual([])
      } else expect(detectConflicts(t), t.name).toEqual([])
    }
  })
})
