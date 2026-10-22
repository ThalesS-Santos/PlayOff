import type { Group, Match, Modality, Sumula, Tournament } from './types'

/* ───────────────────────── utilidades ───────────────────────── */

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)))

export function phaseName(matchesInRound: number, round: number) {
  switch (matchesInRound) {
    case 1:
      return 'Final'
    case 2:
      return 'Semifinal'
    case 4:
      return 'Quartas'
    case 8:
      return 'Oitavas'
    default:
      return `Rodada ${round}`
  }
}

const phaseAbbr: Record<string, string> = { Final: 'F', Semifinal: 'SF', Quartas: 'QF', Oitavas: 'OF' }

/** Ordem padrão de seeds numa chave de tamanho P (1 x P, 2 x P-1 ... separados em metades). */
export function seedOrder(p: number): number[] {
  let order = [1, 2]
  while (order.length < p) {
    const len = order.length * 2 + 1
    order = order.flatMap((s) => [s, len - s])
  }
  return order
}

/* ───────────────────────── mata-mata ───────────────────────── */

interface Entry {
  teamId?: string
  label?: string
  source?: { groupId: string; place: number }
}

function buildKnockout(modId: string, pairs: [Entry | null, Entry | null][]): Match[] {
  const matches: Match[] = []
  let roundSize = pairs.length
  let round = 1
  while (roundSize >= 1) {
    const phase = phaseName(roundSize, round)
    for (let i = 0; i < roundSize; i++) {
      const m: Match = {
        id: `${modId}-k${round}-${i}`,
        phase,
        round,
        slot: i,
        status: 'agendada',
      }
      if (roundSize > 1) {
        m.nextMatchId = `${modId}-k${round + 1}-${Math.floor(i / 2)}`
        m.nextSide = i % 2 === 0 ? 'a' : 'b'
      }
      if (round === 1) {
        const [ea, eb] = pairs[i]
        m.a = ea?.teamId
        m.b = eb?.teamId
        m.placeholderA = ea?.label
        m.placeholderB = eb?.label
        m.sourceA = ea?.source
        m.sourceB = eb?.source
        if (!ea || !eb) m.bye = true
      } else {
        const prevPhase = phaseName(roundSize * 2, round - 1)
        const ab = phaseAbbr[prevPhase] ?? `R${round - 1}-`
        m.placeholderA = `Venc. ${ab}${i * 2 + 1}`
        m.placeholderB = `Venc. ${ab}${i * 2 + 2}`
      }
      matches.push(m)
    }
    if (roundSize === 1) break
    roundSize /= 2
    round++
  }
  // byes avançam automaticamente (time definido ou classificado de grupo ainda pendente)
  for (const m of matches.filter((x) => x.bye)) {
    m.status = 'encerrada'
    if (!m.nextMatchId) continue
    const next = matches.find((x) => x.id === m.nextMatchId)!
    const side = m.nextSide!
    const fromA = m.a != null || m.sourceA != null
    const w = fromA ? m.a : m.b
    const source = fromA ? m.sourceA : m.sourceB
    const label = fromA ? m.placeholderA : m.placeholderB
    if (w) next[side] = w
    if (source) next[side === 'a' ? 'sourceA' : 'sourceB'] = source
    if (label) next[side === 'a' ? 'placeholderA' : 'placeholderB'] = label
  }
  return matches
}

export function generateElimination(modId: string, seeds: string[]): Match[] {
  const p = nextPow2(seeds.length)
  const order = seedOrder(p)
  const pairs: [Entry | null, Entry | null][] = []
  for (let i = 0; i < p; i += 2) {
    const sa = seeds[order[i] - 1]
    const sb = seeds[order[i + 1] - 1]
    pairs.push([sa ? { teamId: sa } : null, sb ? { teamId: sb } : null])
  }
  return buildKnockout(modId, pairs)
}

/* ───────────────────────── fase de grupos ───────────────────────── */

/** Método do círculo: todos contra todos. */
export function roundRobin(teamIds: string[]): [string, string][][] {
  const list: (string | null)[] = [...teamIds]
  if (list.length % 2) list.push(null)
  const n = list.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b])
    }
    rounds.push(pairs)
    list.splice(1, 0, list.pop()!)
  }
  return rounds
}

const letters = 'ABCDEFGH'

export function generateGroups(
  modId: string,
  seeds: string[],
  groupCount: number,
  advance = 2,
): { groups: Group[]; matches: Match[] } {
  const groups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
    id: `${modId}-g${letters[i]}`,
    name: `Grupo ${letters[i]}`,
    teamIds: [],
  }))
  // distribuição em serpentina: cabeças de chave espalhados
  seeds.forEach((t, i) => {
    const line = Math.floor(i / groupCount)
    const idx = line % 2 === 0 ? i % groupCount : groupCount - 1 - (i % groupCount)
    groups[idx].teamIds.push(t)
  })

  const matches: Match[] = []
  for (const g of groups) {
    roundRobin(g.teamIds).forEach((pairs, r) =>
      pairs.forEach(([a, b], i) =>
        matches.push({
          id: `${g.id}-r${r + 1}-${i}`,
          phase: g.name,
          round: r + 1,
          slot: i,
          groupId: g.id,
          a,
          b,
          status: 'agendada',
        }),
      ),
    )
  }

  const first = (g: Group): Entry => ({ label: `1º ${g.name}`, source: { groupId: g.id, place: 1 } })
  const second = (g: Group): Entry => ({ label: `2º ${g.name}`, source: { groupId: g.id, place: 2 } })

  // nº ímpar de grupos: chave semeada com byes (primeiros colocados, depois segundos em
  // ordem inversa), evitando que dois times do mesmo grupo se reencontrem na 1ª rodada
  if (groupCount > 1 && groupCount % 2) {
    const entries = [...groups.map(first), ...(advance === 1 ? [] : [...groups].reverse().map(second))]
    const p = nextPow2(entries.length)
    const order = seedOrder(p)
    const pairs: [Entry | null, Entry | null][] = []
    for (let i = 0; i < p; i += 2) pairs.push([entries[order[i] - 1] ?? null, entries[order[i + 1] - 1] ?? null])
    return { groups, matches: [...matches, ...buildKnockout(modId, pairs)] }
  }

  // cruzamento olímpico: 1ºA x 2ºB, 1ºB x 2ºA ...
  const qualifiers: Entry[] = []
  for (let i = 0; i < groupCount; i += 2) {
    const g1 = groups[i]
    const g2 = groups[i + 1] ?? groups[i]
    qualifiers.push(
      { label: `1º ${g1.name}`, source: { groupId: g1.id, place: 1 } },
      { label: `2º ${g2.name}`, source: { groupId: g2.id, place: 2 } },
    )
  }
  for (let i = 0; i < groupCount; i += 2) {
    const g1 = groups[i]
    const g2 = groups[i + 1] ?? groups[i]
    qualifiers.push(
      { label: `1º ${g2.name}`, source: { groupId: g2.id, place: 1 } },
      { label: `2º ${g1.name}`, source: { groupId: g1.id, place: 2 } },
    )
  }
  if (groupCount === 1) qualifiers.splice(2)
  const usable = advance === 1 ? qualifiers.filter((q) => q.source?.place === 1) : qualifiers
  const pairs: [Entry, Entry][] = []
  for (let i = 0; i < usable.length; i += 2) pairs.push([usable[i], usable[i + 1]])
  return { groups, matches: [...matches, ...buildKnockout(modId, pairs)] }
}

export function generateProva(modId: string, teamIds: string[]): Match[] {
  return [
    {
      id: `${modId}-prova`,
      phase: 'Final',
      round: 1,
      slot: 0,
      participants: [...teamIds],
      status: 'agendada',
    },
  ]
}

/** Sugestão de nº de grupos: grupos de 3 a 5 times. */
export function defaultGroupCount(teams: number) {
  if (teams <= 5) return 1
  if (teams <= 10) return 2
  return Math.min(8, Math.round(teams / 4))
}

/** Opções válidas de nº de grupos: ao menos 2 times por grupo, até 8 grupos. */
export function groupCountOptions(teams: number) {
  return Array.from({ length: Math.min(8, Math.floor(teams / 2)) }, (_, i) => i + 1)
}

export function generateMatches(mod: Modality, groupCount?: number): Modality {
  const seeds = orderedSeeds(mod)
  if (mod.format === 'prova') return { ...mod, groups: [], matches: generateProva(mod.id, seeds) }
  if (mod.format === 'grupos_mata') {
    const count = Math.max(1, Math.min(groupCount ?? mod.groupCount ?? defaultGroupCount(seeds.length), Math.floor(seeds.length / 2)))
    // com um único grupo, ao menos 2 classificados fazem a final
    const advance = count === 1 ? 2 : (mod.advancePerGroup ?? 2)
    const { groups, matches } = generateGroups(mod.id, seeds, count, advance)
    return { ...mod, groupCount: count, groups, matches }
  }
  return { ...mod, groups: [], matches: generateElimination(mod.id, seeds) }
}

/** Cabeças de chave primeiro (na ordem definida), restante sorteado. */
export function orderedSeeds(mod: Modality, rand: () => number = Math.random) {
  const rest = shuffle(
    mod.teamIds.filter((t) => !mod.seeds.includes(t)),
    rand,
  )
  return [...mod.seeds.filter((s) => mod.teamIds.includes(s)), ...rest]
}

/* ───────────────────────── resultados ───────────────────────── */

export function setsWon(s: Extract<Sumula, { kind: 'set' }>) {
  let a = 0
  let b = 0
  for (const [x, y] of s.sets) {
    if (x > y) a++
    else if (y > x) b++
  }
  return [a, b] as const
}

/** Polimorfismo de calcularResultado() da súmula (diagrama de classes). */
export function winnerOf(m: Match): string | undefined {
  if (m.bye) return m.a ?? m.b
  const s = m.sumula
  if (!s || !m.a || !m.b) return undefined
  if (s.kind === 'pontos') {
    if (s.a !== s.b) return s.a > s.b ? m.a : m.b
    if (s.penA != null && s.penB != null && s.penA !== s.penB) return s.penA > s.penB ? m.a : m.b
    return undefined
  }
  if (s.kind === 'set') {
    const [a, b] = setsWon(s)
    return a === b ? undefined : a > b ? m.a : m.b
  }
  return undefined
}

export function ranking(m: Match) {
  if (m.sumula?.kind !== 'colocacao') return []
  return [...m.sumula.entries].sort((x, y) => x.timeMs - y.timeMs)
}

export interface Standing {
  teamId: string
  j: number
  v: number
  e: number
  d: number
  pp: number
  pc: number
  pts: number
}

export function standings(group: Group, matches: Match[]): Standing[] {
  const table = new Map<string, Standing>(
    group.teamIds.map((t) => [t, { teamId: t, j: 0, v: 0, e: 0, d: 0, pp: 0, pc: 0, pts: 0 }]),
  )
  for (const m of matches) {
    if (m.groupId !== group.id || m.status !== 'encerrada' || !m.sumula || !m.a || !m.b) continue
    const A = table.get(m.a)!
    const B = table.get(m.b)!
    let fa = 0
    let fb = 0
    if (m.sumula.kind === 'pontos') {
      fa = m.sumula.a
      fb = m.sumula.b
    } else if (m.sumula.kind === 'set') {
      ;[fa, fb] = setsWon(m.sumula)
    }
    A.j++
    B.j++
    A.pp += fa
    A.pc += fb
    B.pp += fb
    B.pc += fa
    if (fa > fb) {
      A.v++
      B.d++
      A.pts += 3
    } else if (fb > fa) {
      B.v++
      A.d++
      B.pts += 3
    } else {
      A.e++
      B.e++
      A.pts++
      B.pts++
    }
  }
  const played = matches.filter((m) => m.groupId === group.id && m.status === 'encerrada' && m.sumula)
  // confronto direto: pontos que x fez contra y (3 vitória, 1 empate)
  const headToHead = (x: string, y: string) => {
    let px = 0
    for (const m of played) {
      if (!((m.a === x && m.b === y) || (m.a === y && m.b === x))) continue
      const w = winnerOf(m)
      px += w === x ? 3 : w ? 0 : 1
    }
    return px
  }
  // fair play: amarelo 1, vermelho 3 (menos é melhor)
  const discipline = (team: string) =>
    played.reduce(
      (n, m) =>
        n +
        (m.sumula!.kind === 'colocacao'
          ? 0
          : m.sumula!.cards.filter((c) => c.teamId === team).reduce((k, c) => k + (c.color === 'vermelho' ? 3 : 1), 0)),
      0,
    )
  return [...table.values()].sort(
    (x, y) =>
      y.pts - x.pts ||
      y.pp - y.pc - (x.pp - x.pc) ||
      y.pp - x.pp ||
      y.v - x.v ||
      headToHead(y.teamId, x.teamId) - headToHead(x.teamId, y.teamId) ||
      discipline(x.teamId) - discipline(y.teamId),
  )
}

/** Problemas de preenchimento da súmula (valores negativos, set empatado, tempos inválidos). */
export function sumulaErrors(s: Sumula, m?: Match): string[] {
  const e: string[] = []
  const bad = (n: number) => !Number.isInteger(n) || n < 0
  if (s.kind === 'pontos') {
    if (bad(s.a) || bad(s.b)) e.push('Placar deve ter números inteiros não negativos.')
    if ((s.penA != null && bad(s.penA)) || (s.penB != null && bad(s.penB))) e.push('Pênaltis devem ser números inteiros não negativos.')
  }
  if (s.kind === 'set') {
    if (!s.sets.length) e.push('Informe ao menos um set.')
    s.sets.forEach(([x, y], i) => {
      if (bad(x) || bad(y)) e.push(`Set ${i + 1}: use números inteiros não negativos.`)
      else if (x === y) e.push(`Set ${i + 1} empatado: todo set tem um vencedor.`)
    })
  }
  if (s.kind !== 'colocacao' && s.cards.some((c) => !c.playerId || bad(c.minute))) e.push('Cartão sem atleta ou com minuto inválido.')
  if (s.kind === 'colocacao') {
    if (s.entries.some((x) => !Number.isFinite(x.timeMs) || x.timeMs <= 0)) e.push('Todos os tempos devem ser maiores que zero.')
    if (m?.participants && (s.entries.length !== m.participants.length || s.entries.some((x) => !m.participants!.includes(x.teamId))))
      e.push('A súmula deve trazer o tempo de todos os participantes.')
  }
  return e
}

/**
 * Resultado de partida encerrada só pode ser corrigido enquanto o que depende dele
 * ainda não começou (RN14): a próxima partida da chave, ou o mata-mata, no caso de grupos.
 */
export function resultLocked(mod: Modality, m: Match): boolean {
  if (m.status !== 'encerrada' || m.bye) return false
  const started = (x: Match) => x.status !== 'agendada'
  if (m.nextMatchId) return mod.matches.some((x) => x.id === m.nextMatchId && started(x) && !x.bye)
  if (m.groupId) return mod.matches.some((x) => !x.groupId && !x.bye && started(x))
  return false
}

/** Registra súmula, encerra a partida e propaga o vencedor pela chave. */
export function applySumula(mod: Modality, matchId: string, sumula: Sumula): Modality {
  const target = mod.matches.find((m) => m.id === matchId)
  if (!target) throw new Error('Partida não encontrada.')
  if (target.bye) throw new Error('Partida com bye não tem súmula.')
  if (!(target.participants || (target.a && target.b))) throw new Error('Os adversários desta partida ainda não foram definidos.')
  if (resultLocked(mod, target)) throw new Error('A fase seguinte já começou: este resultado não pode mais ser alterado.')
  const errors = sumulaErrors(sumula, target)
  if (errors.length) throw new Error(errors[0])
  let matches = mod.matches.map((m) =>
    m.id === matchId ? { ...m, sumula, status: 'encerrada' as const } : m,
  )
  const done = matches.find((m) => m.id === matchId)!
  const w = winnerOf(done)
  if (!done.groupId && sumula.kind !== 'colocacao' && !w)
    throw new Error('Partida de mata-mata precisa de vencedor (pênaltis ou set decisivo).')
  if (w && done.nextMatchId) {
    matches = matches.map((m) => (m.id === done.nextMatchId ? { ...m, [done.nextSide!]: w } : m))
  }
  if (done.groupId) {
    const group = mod.groups.find((g) => g.id === done.groupId)!
    const groupDone = matches.filter((m) => m.groupId === group.id).every((m) => m.status === 'encerrada')
    if (groupDone) {
      const table = standings(group, matches)
      matches = matches.map((m) => {
        const patch: Partial<Match> = {}
        if (m.sourceA?.groupId === group.id) patch.a = table[m.sourceA.place - 1]?.teamId
        if (m.sourceB?.groupId === group.id) patch.b = table[m.sourceB.place - 1]?.teamId
        return Object.keys(patch).length ? { ...m, ...patch } : m
      })
    }
  }
  return { ...mod, matches }
}

export function champion(mod: Modality): string | undefined {
  if (mod.format === 'prova') {
    const m = mod.matches[0]
    return m && m.status === 'encerrada' ? ranking(m)[0]?.teamId : undefined
  }
  const final = mod.matches.find((m) => !m.groupId && !m.nextMatchId)
  return final && final.status === 'encerrada' ? winnerOf(final) : undefined
}

/**
 * Times em uma colocação final da modalidade. Sem disputa de 3º lugar, os dois
 * perdedores das semifinais dividem o 3º lugar. Vazio enquanto não definido.
 */
export function placeOf(mod: Modality, place: number): string[] {
  if (mod.format === 'prova') {
    const m = mod.matches[0]
    const id = m && m.status === 'encerrada' ? ranking(m)[place - 1]?.teamId : undefined
    return id ? [id] : []
  }
  const final = mod.matches.find((m) => !m.groupId && !m.nextMatchId)
  if (!final || final.status !== 'encerrada') return []
  const loser = (m: Match) => {
    const w = winnerOf(m)
    return w && !m.bye ? (w === m.a ? m.b : m.a) : undefined
  }
  if (place === 1) return [winnerOf(final)].filter(Boolean) as string[]
  if (place === 2) return [loser(final)].filter(Boolean) as string[]
  if (place === 3) {
    const semis = mod.matches.filter((m) => m.nextMatchId === final.id)
    return semis.map(loser).filter(Boolean) as string[]
  }
  return []
}

export function progress(t: Tournament) {
  const all = t.modalities.flatMap((m) => m.matches.filter((x) => !x.bye))
  if (!all.length) return 0
  return all.filter((m) => m.status === 'encerrada').length / all.length
}

/* ───────────────────────── agenda (RF04) ───────────────────────── */

export const SLOTS = ['09:00', '10:30', '14:00', '15:30', '17:00', '18:30', '20:00']

function daysBetween(start: string, end: string) {
  const out: string[] = []
  const d = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  while (d <= e && out.length < 60) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const stageKey = (m: Match) => (m.groupId ? m.round : 100 + m.round)

/**
 * Heurística gulosa: aloca cada partida no primeiro horário viável sem conflito de
 * local, time ou árbitro, respeitando a ordem das fases, uma partida por time por dia
 * e cada fase começando no dia seguinte à anterior (relaxado se o período não couber).
 * Partidas encerradas ou fixadas pelo organizador permanecem onde estão.
 */
export function scheduleTournament(t: Tournament, notBefore?: string): Tournament {
  const days = daysBetween(t.startDate, t.endDate)
  const firstDay = notBefore ? days.findIndex((d) => d >= notBefore) : 0
  const minSlot = (firstDay < 0 ? 0 : firstDay) * SLOTS.length
  const slotIdx = (date: string, time: string) => days.indexOf(date) * SLOTS.length + SLOTS.indexOf(time)
  const busy = new Map<number, { venues: Set<string>; teams: Set<string>; refs: Set<string> }>()
  const at = (i: number) => {
    if (!busy.has(i)) busy.set(i, { venues: new Set(), teams: new Set(), refs: new Set() })
    return busy.get(i)!
  }
  const teamsOf = (m: Match) => (m.participants ?? [m.a, m.b]).filter(Boolean) as string[]
  const refLoad = new Map<string, number>(t.referees.map((r) => [r, 0]))
  const dayOf = (i: number) => Math.floor(i / SLOTS.length)
  const teamDays = new Map<string, Set<number>>()
  const markDay = (tm: string, i: number) => {
    if (!teamDays.has(tm)) teamDays.set(tm, new Set())
    teamDays.get(tm)!.add(dayOf(i))
  }

  const stageEnd = new Map<string, number>()
  const fixed = t.modalities.flatMap((mod) =>
    mod.matches.filter((m) => (m.status !== 'agendada' || m.pinned) && m.date && m.time).map((m) => ({ m, mod })),
  )
  for (const { m, mod } of fixed) {
    const i = slotIdx(m.date!, m.time!)
    const key = `${mod.id}:${stageKey(m)}`
    stageEnd.set(key, Math.max(stageEnd.get(key) ?? 0, i))
    const b = at(i)
    if (m.venue) b.venues.add(m.venue)
    if (m.referee) {
      b.refs.add(m.referee)
      refLoad.set(m.referee, (refLoad.get(m.referee) ?? 0) + 1)
    }
    teamsOf(m).forEach((tm) => {
      b.teams.add(tm)
      markDay(tm, i)
    })
  }

  const modalities = t.modalities.map((mod) => ({ ...mod, matches: mod.matches.map((m) => ({ ...m })) }))
  // intercala modalidades por estágio para distribuir o calendário
  const queue = modalities
    .flatMap((mod, mi) => mod.matches.filter((m) => !m.bye && m.status === 'agendada' && !m.pinned).map((m) => ({ m, mi, mod })))
    .sort((x, y) => stageKey(x.m) - stageKey(y.m) || x.mi - y.mi || x.m.slot - y.m.slot)

  for (const { m, mod } of queue) {
    const prevStages = [...stageEnd.entries()].filter(
      ([k]) => k.startsWith(mod.id + ':') && Number(k.split(':')[1]) < stageKey(m),
    )
    const prevEnd = prevStages.length ? Math.max(...prevStages.map(([, v]) => v)) : -1
    // partidas fixadas de fases posteriores limitam até quando esta pode acontecer
    const laterFixed = fixed.filter((f) => f.mod.id === mod.id && stageKey(f.m) > stageKey(m)).map((f) => slotIdx(f.m.date!, f.m.time!))
    const maxBefore = laterFixed.length ? Math.min(...laterFixed) : days.length * SLOTS.length
    const teams = teamsOf(m)
    // limpa a alocação anterior: se não couber, fica sem horário (e é sinalizado em detectConflicts)
    m.date = m.time = m.venue = m.referee = undefined

    const tryPlace = (from: number, perDay: boolean) => {
      for (let i = Math.max(from, minSlot); i < maxBefore; i++) {
        const b = at(i)
        if (teams.some((tm) => b.teams.has(tm))) continue
        // descanso: cada time joga no máximo uma partida por dia
        if (perDay && teams.some((tm) => teamDays.get(tm)?.has(dayOf(i)))) continue
        const venue = (mod.venues?.length ? mod.venues : t.venues).find((v) => !b.venues.has(v))
        if (!venue) continue
        const referee = [...t.referees].sort((x, y) => (refLoad.get(x) ?? 0) - (refLoad.get(y) ?? 0)).find((r) => !b.refs.has(r))
        if (!referee) continue
        m.date = days[dayOf(i)]
        m.time = SLOTS[i % SLOTS.length]
        m.venue = venue
        m.referee = referee
        b.venues.add(venue)
        b.refs.add(referee)
        teams.forEach((tm) => {
          b.teams.add(tm)
          markDay(tm, i)
        })
        refLoad.set(referee, (refLoad.get(referee) ?? 0) + 1)
        const key = `${mod.id}:${stageKey(m)}`
        stageEnd.set(key, Math.max(stageEnd.get(key) ?? 0, i))
        return true
      }
      return false
    }
    // preferência: fase nova começa no dia seguinte e cada time joga uma vez por dia;
    // se o período não comportar, relaxa para o horário seguinte e só o intervalo mínimo
    const nextDay = prevEnd < 0 ? 0 : (dayOf(prevEnd) + 1) * SLOTS.length
    if (!tryPlace(nextDay, true)) tryPlace(prevEnd + 1, false)
  }
  return { ...t, modalities }
}

export interface Slot {
  date: string
  time: string
  venue: string
  referee: string
}

/** Dias do torneio disponíveis para agendamento. */
export const tournamentDays = (t: Tournament) => daysBetween(t.startDate, t.endDate)

/**
 * Motivos que impedem colocar a partida no horário indicado: fora do período,
 * local/árbitro/time ocupados no mesmo horário, ou fase anterior ainda depois dele.
 */
export function slotConflicts(t: Tournament, matchId: string, slot: Slot): string[] {
  const mod = t.modalities.find((m) => m.matches.some((x) => x.id === matchId))
  const match = mod?.matches.find((x) => x.id === matchId)
  if (!mod || !match) return ['Partida não encontrada.']
  const reasons: string[] = []
  if (!tournamentDays(t).includes(slot.date)) reasons.push('Data fora do período do torneio.')
  if (!SLOTS.includes(slot.time)) reasons.push('Horário fora da grade.')
  const teams = (m: Match) => (m.participants ?? [m.a, m.b]).filter(Boolean) as string[]
  const mine = teams(match)
  for (const md of t.modalities)
    for (const m of md.matches) {
      if (m.id === matchId || m.bye || m.date !== slot.date || m.time !== slot.time) continue
      if (m.venue === slot.venue) reasons.push(`${slot.venue} já recebe outra partida nesse horário.`)
      if (m.referee === slot.referee) reasons.push(`${slot.referee} já apita outra partida nesse horário.`)
      const clash = teams(m).find((x) => mine.includes(x))
      if (clash) reasons.push(`${t.teams.find((x) => x.id === clash)?.name ?? 'Um time'} já joga nesse horário.`)
    }
  // ordem das fases: não pode acontecer antes de uma partida de estágio anterior
  const key = `${slot.date} ${slot.time}`
  const earlier = mod.matches.find((m) => !m.bye && stageKey(m) < stageKey(match) && m.date && m.time && `${m.date} ${m.time}` >= key)
  if (earlier) reasons.push(`Precisa ser depois de ${earlier.phase} (${fmtSlot(earlier.date!, earlier.time!)}).`)
  const later = mod.matches.find((m) => !m.bye && stageKey(m) > stageKey(match) && m.date && m.time && `${m.date} ${m.time}` <= key)
  if (later) reasons.push(`Precisa ser antes de ${later.phase} (${fmtSlot(later.date!, later.time!)}).`)
  return [...new Set(reasons)]
}

const fmtSlot = (date: string, time: string) => `${date.split('-').reverse().slice(0, 2).join('/')} às ${time}`

/** Coloca a partida no horário escolhido e a fixa (a otimização não a move mais). */
export function reschedule(t: Tournament, matchId: string, slot: Slot): Tournament {
  const reasons = slotConflicts(t, matchId, slot)
  if (reasons.length) throw new Error(reasons[0])
  return {
    ...t,
    modalities: t.modalities.map((md) => ({
      ...md,
      matches: md.matches.map((m) => (m.id === matchId ? { ...m, ...slot, pinned: true } : m)),
    })),
  }
}

/** Devolve a partida para a otimização automática. */
export function unpin(t: Tournament, matchId: string): Tournament {
  return {
    ...t,
    modalities: t.modalities.map((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, pinned: undefined } : m)) })),
  }
}

export interface Conflict {
  matchIds: string[]
  reason: string
}

export function detectConflicts(t: Tournament): Conflict[] {
  const all = t.modalities.flatMap((mod) => mod.matches.filter((m) => !m.bye && m.date && m.time && m.status !== 'encerrada'))
  const conflicts: Conflict[] = []
  const bucket = new Map<string, Match[]>()
  for (const m of all) {
    const k = `${m.date} ${m.time}`
    bucket.set(k, [...(bucket.get(k) ?? []), m])
  }
  for (const [key, ms] of bucket) {
    const [d, hm] = key.split(' ')
    const k = `${d.split('-').reverse().slice(0, 2).join('/')} às ${hm}`
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) {
        const x = ms[i]
        const y = ms[j]
        const tx = (x.participants ?? [x.a, x.b]).filter(Boolean)
        const ty = (y.participants ?? [y.a, y.b]).filter(Boolean)
        if (x.venue && x.venue === y.venue) conflicts.push({ matchIds: [x.id, y.id], reason: `${x.venue} ocupado duas vezes em ${k}` })
        else if (x.referee && x.referee === y.referee) conflicts.push({ matchIds: [x.id, y.id], reason: `Árbitro ${x.referee} escalado duas vezes em ${k}` })
        else if (tx.some((tm) => ty.includes(tm))) conflicts.push({ matchIds: [x.id, y.id], reason: `Time com dois jogos em ${k}` })
      }
  }
  // partidas que a agenda não conseguiu alocar, ou que ficaram fora do período (após editar datas)
  const days = new Set(tournamentDays(t))
  for (const mod of t.modalities)
    for (const m of mod.matches) {
      if (m.bye || m.status !== 'agendada') continue
      if (!(m.date && m.time)) conflicts.push({ matchIds: [m.id], reason: 'Sem horário livre no período do torneio' })
      else if (!days.has(m.date)) conflicts.push({ matchIds: [m.id], reason: 'Partida fora do período do torneio' })
    }
  return conflicts
}
