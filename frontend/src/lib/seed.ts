import { applySumula, generateMatches, rng, scheduleTournament } from './engine'
import type { Match, Modality, Organization, Sumula, Team, Tournament, User } from './types'

const FIRST = ['Lucas', 'Gabriel', 'Rafael', 'Mateus', 'João', 'Pedro', 'Caio', 'Bruno', 'Thiago', 'Igor', 'Davi', 'Enzo', 'Vitor', 'Samuel', 'Leo', 'Arthur']
const FIRST_F = ['Ana', 'Beatriz', 'Camila', 'Júlia', 'Larissa', 'Marina', 'Bianca', 'Letícia', 'Sofia', 'Clara', 'Lívia', 'Yasmin', 'Helena', 'Manu', 'Alice', 'Lara']
const LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Costa', 'Ribeiro', 'Almeida', 'Carvalho', 'Rocha', 'Moura', 'Teixeira', 'Barbosa', 'Freitas']
const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#84cc16', '#14b8a6', '#ef4444', '#3b82f6', '#eab308']

function makeTeams(prefix: string, names: string[], female: boolean, size: number, seed: number): Team[] {
  const r = rng(seed)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  return names.map((name, i) => ({
    id: `${prefix}${i + 1}`,
    name,
    short: name
      .replace(/^(Atlético|Esporte|Clube)\s/, '')
      .slice(0, 3)
      .toUpperCase(),
    color: COLORS[(i + seed) % COLORS.length],
    coach: `${pick(female ? FIRST_F : FIRST)} ${pick(LAST)}`,
    players: Array.from({ length: size }, (_, j) => ({
      id: `${prefix}${i + 1}p${j + 1}`,
      name: `${pick(female ? FIRST_F : FIRST)} ${pick(LAST)}`,
      number: j === 0 ? 1 : 2 + Math.floor(r() * 97),
    })),
  }))
}

function pontos(r: () => number, max: number, allowDraw: boolean): Sumula {
  let a = Math.floor(r() * max)
  const b = Math.floor(r() * max)
  if (!allowDraw && a === b) a++
  return { kind: 'pontos', a, b, cards: [] }
}

function sets(r: () => number, bestOf: number, target: number): Sumula {
  const need = Math.ceil(bestOf / 2)
  const out: [number, number][] = []
  let wa = 0
  let wb = 0
  while (wa < need && wb < need) {
    const aWins = r() > 0.5
    const loser = Math.floor(target * 0.55 + r() * target * 0.4)
    out.push(aWins ? [target, loser] : [loser, target])
    if (aWins) wa++
    else wb++
  }
  return { kind: 'set', sets: out, cards: [] }
}

function playUntil(mod: Modality, r: () => number, gen: () => Sumula, stop: (m: Match) => boolean): Modality {
  let cur = mod
  const order = [...cur.matches].sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`))
  for (const o of order) {
    const m = cur.matches.find((x) => x.id === o.id)!
    if (m.bye || m.status === 'encerrada' || !m.a || !m.b) continue
    if (stop(m)) break
    let s = gen()
    if (s.kind === 'pontos' && !m.groupId && s.a === s.b) s = { ...s, penA: 4, penB: 3 }
    if (s.kind === 'pontos' && m.a && m.b && r() > 0.6) {
      const team = r() > 0.5 ? m.a : m.b
      s = { ...s, cards: [{ teamId: team, playerId: `${team}p${2 + Math.floor(r() * 4)}`, color: r() > 0.85 ? 'vermelho' : 'amarelo', minute: 3 + Math.floor(r() * 35) }] }
    }
    cur = applySumula(cur, m.id, s)
  }
  return cur
}

const withMods = (t: Tournament, f: (m: Modality, i: number) => Modality): Tournament => ({
  ...t,
  modalities: t.modalities.map(f),
})

const baseMod = (id: string, p: Partial<Modality> & Pick<Modality, 'sport' | 'kind' | 'format' | 'teamIds' | 'category'>): Modality => ({
  id,
  seeds: p.teamIds.slice(0, 2),
  groups: [],
  matches: [],
  ...p,
})

export const ORGS: Organization[] = [
  { id: 'o1', name: 'Liga Horizonte', short: 'LH', hue: 285 },
  { id: 'o2', name: 'Arena Litoral', short: 'AL', hue: 195 },
]

export const DEMO_USERS: User[] = [
  { id: 'u1', name: 'Thales Sena', role: 'organizador', orgId: 'o1' },
  { id: 'u2', name: 'Visitante', role: 'espectador' },
]

export function buildSeed(): Tournament[] {
  const r = rng(2026)

  /* 1 — Copa Interclasse: em andamento, 3 tipos de súmula */
  const futsal = makeTeams('fs', ['Leões do Norte', 'Tubarões', 'Falcões', 'Raposas', 'Trovão', 'Atlético Vila', 'Furacão', 'Dragões'], false, 8, 1)
  const volei = makeTeams('vf', ['Aurora', 'Sereias', 'Fênix', 'Panteras', 'Estrelas', 'Vespas', 'Brisa', 'Onças'], true, 8, 4)
  const nat = makeTeams('nt', ['Golfinhos', 'Marlins', 'Arraias', 'Orcas', 'Tritões', 'Piranhas'], false, 4, 7)
  let copa: Tournament = {
    id: 't1',
    name: 'Copa Interclasse Horizonte 2026',
    description: 'O maior campeonato estudantil da região: futsal, vôlei e natação em três semanas de disputa.',
    orgId: 'o1',
    organizerId: 'u1',
    visibility: 'publico',
    status: 'andamento',
    startDate: '2026-10-15',
    endDate: '2026-11-04',
    city: 'Salvador, BA',
    venueName: 'Complexo Esportivo Horizonte',
    venues: ['Quadra 1', 'Quadra 2', 'Piscina Olímpica'],
    referees: ['Carla Mendes', 'Rogério Pinto', 'Sandra Luz', 'Marcos Vieira'],
    cover: ['#7c5cff', '#ff5c8a'],
    teams: [...futsal, ...volei, ...nat],
    modalities: [
      baseMod('t1m1', { sport: 'Futsal', kind: 'pontos', category: 'M', format: 'eliminacao', teamIds: futsal.map((t) => t.id), venues: ['Quadra 1', 'Quadra 2'] }),
      baseMod('t1m2', { sport: 'Vôlei', kind: 'set', category: 'F', sub: 'Sexteto', format: 'grupos_mata', teamIds: volei.map((t) => t.id), advancePerGroup: 2, venues: ['Quadra 1', 'Quadra 2'] }),
      baseMod('t1m3', { sport: 'Natação 50m livre', kind: 'colocacao', category: 'M', sub: 'Revezamento 4x50', format: 'prova', teamIds: nat.map((t) => t.id), venues: ['Piscina Olímpica'] }),
    ],
    prizes: [
      { id: 'pz1', name: 'Troféu Campeão Futsal', kind: 'coletivo', value: 1500, place: 1, modalityId: 't1m1' },
      { id: 'pz2', name: 'Medalhas de Prata', kind: 'coletivo', place: 2, modalityId: 't1m1' },
      { id: 'pz3', name: 'Troféu Campeã Vôlei', kind: 'coletivo', value: 1500, place: 1, modalityId: 't1m2' },
      { id: 'pz4', name: 'Artilheiro da Copa', kind: 'individual', value: 300, place: 1 },
      { id: 'pz5', name: 'Melhor Revezamento', kind: 'coletivo', value: 800, place: 1, modalityId: 't1m3' },
    ],
    favoritedBy: [],
    createdAt: Date.parse('2026-09-01'),
  }
  copa = withMods(copa, (m) => generateMatches({ ...m, teamIds: m.teamIds }, 2))
  copa = scheduleTournament(copa)
  copa = withMods(copa, (m) => {
    if (m.kind === 'pontos') return playUntil(m, r, () => pontos(r, 6, false), (x) => x.phase === 'Semifinal' && x.slot === 1)
    if (m.kind === 'set') return playUntil(m, r, () => sets(r, 3, 25), (x) => x.phase === 'Semifinal')
    return m
  })
  // semifinal 2 do futsal ao vivo
  copa = withMods(copa, (m) =>
    m.id !== 't1m1'
      ? m
      : {
          ...m,
          matches: m.matches.map((x) =>
            x.phase === 'Semifinal' && x.slot === 1
              ? { ...x, status: 'ao_vivo', date: '2026-10-21', time: '20:00', venue: 'Quadra 1', sumula: { kind: 'pontos', a: 2, b: 2, cards: [] } }
              : x,
          ),
        },
  )
  copa = scheduleTournament(copa, '2026-10-22')

  /* 2 — Beach tennis: inscrições abertas, sem chaveamento */
  const duplas = makeTeams('bt', ['Sol & Mar', 'Areia Fina', 'Maré Alta', 'Coqueiros', 'Vento Sul', 'Ondas'], false, 2, 11)
  const beach: Tournament = {
    id: 't2',
    name: 'Circuito Beach Tennis Verão',
    description: 'Duplas mistas na areia. Inscrições abertas até 30/11 — chave sai no fechamento.',
    orgId: 'o2',
    organizerId: 'u1',
    visibility: 'publico',
    status: 'publicado',
    startDate: '2026-12-05',
    endDate: '2026-12-07',
    city: 'Ilhéus, BA',
    venueName: 'Arena Litoral',
    venues: ['Quadra Areia 1', 'Quadra Areia 2'],
    referees: ['Paula Reis', 'Diego Matos'],
    cover: ['#06b6d4', '#facc15'],
    teams: duplas,
    modalities: [baseMod('t2m1', { sport: 'Beach Tennis', kind: 'set', category: 'Misto', sub: 'Dupla', format: 'eliminacao', teamIds: duplas.map((t) => t.id) })],
    prizes: [{ id: 'pz6', name: 'Raquetes profissionais', kind: 'coletivo', value: 2000, place: 1 }],
    favoritedBy: [],
    createdAt: Date.parse('2026-10-10'),
  }

  /* 3 — Liga corporativa: privada, com conflitos na agenda */
  const soc = makeTeams('sc', ['Atlético Dados', 'Esporte Logística', 'Clube Contábil', 'TI United', 'Marketing FC', 'Jurídico 10', 'RH Stars', 'Vendas City'], false, 7, 21)
  let liga: Tournament = {
    id: 't3',
    name: 'Liga Corporativa Society',
    description: 'Campeonato interno entre departamentos. Acesso restrito aos colaboradores.',
    orgId: 'o1',
    organizerId: 'u1',
    visibility: 'privado',
    accessCode: 'PLAY2026',
    status: 'andamento',
    startDate: '2026-10-19',
    endDate: '2026-11-15',
    city: 'Salvador, BA',
    venueName: 'Society Paralela',
    venues: ['Campo A', 'Campo B'],
    referees: ['Ivan Coelho', 'Telma Rios', 'Jonas Prado'],
    cover: ['#10b981', '#3b82f6'],
    teams: soc,
    modalities: [baseMod('t3m1', { sport: 'Futebol Society', kind: 'pontos', category: 'M', format: 'grupos_mata', teamIds: soc.map((t) => t.id), advancePerGroup: 2 })],
    prizes: [{ id: 'pz7', name: 'Taça Liga Corporativa', kind: 'coletivo', value: 1000, place: 1 }],
    favoritedBy: [],
    createdAt: Date.parse('2026-10-01'),
  }
  liga = withMods(liga, (m) => generateMatches(m, 2))
  liga = scheduleTournament(liga)
  let played = 0
  liga = withMods(liga, (m) => playUntil(m, r, () => pontos(r, 5, true), () => played++ >= 5))
  liga = scheduleTournament(liga, '2026-10-22')
  // conflitos propositais para demonstrar o otimizador
  liga = withMods(liga, (m) => {
    const pending = m.matches.filter((x) => x.status === 'agendada' && x.groupId)
    const [p1, p2, p3] = pending
    return {
      ...m,
      matches: m.matches.map((x) => {
        if (p2 && x.id === p2.id) return { ...x, date: p1.date, time: p1.time, venue: p1.venue }
        if (p3 && x.id === p3.id) return { ...x, date: p1.date, time: p1.time, referee: p1.referee, venue: 'Campo B' }
        return x
      }),
    }
  })

  /* 4 — Basquete 3x3: finalizado */
  const bsq = makeTeams('bq', ['Garrafão', 'Cesta Certa', 'Rebote', 'Enterrada'], false, 4, 31)
  let b3: Tournament = {
    id: 't4',
    name: 'Copa Bairro Basquete 3x3',
    description: 'Edição de inverno do torneio de rua mais animado do bairro.',
    orgId: 'o2',
    organizerId: 'u3',
    visibility: 'publico',
    status: 'finalizado',
    startDate: '2026-07-11',
    endDate: '2026-07-12',
    city: 'Feira de Santana, BA',
    venueName: 'Praça da Juventude',
    venues: ['Quadra Central'],
    referees: ['Bia Torres', 'Edu Lago'],
    cover: ['#f97316', '#ef4444'],
    teams: bsq,
    modalities: [baseMod('t4m1', { sport: 'Basquete 3x3', kind: 'pontos', category: 'Misto', format: 'eliminacao', teamIds: bsq.map((t) => t.id) })],
    prizes: [{ id: 'pz8', name: 'Troféu + camisas oficiais', kind: 'coletivo', place: 1 }],
    favoritedBy: ['u2'],
    createdAt: Date.parse('2026-06-01'),
  }
  b3 = withMods(b3, (m) => generateMatches(m))
  b3 = scheduleTournament(b3)
  b3 = withMods(b3, (m) =>
    playUntil(m, r, () => {
      const a = 12 + Math.floor(r() * 10)
      const b = 12 + Math.floor(r() * 10)
      return { kind: 'pontos', a: a === b ? a + 2 : a, b, cards: [] }
    }, () => false),
  )

  return [copa, liga, beach, b3]
}
