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
  // byes avançam automaticamente
  for (const m of matches.filter((x) => x.bye)) {
    const w = m.a ?? m.b
    m.status = 'encerrada'
    if (w && m.nextMatchId) {
      const next = matches.find((x) => x.id === m.nextMatchId)!
      next[m.nextSide!] = w
    }
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

export function generateMatches(mod: Modality, groupCount = 2): Modality {
  const seeds = orderedSeeds(mod)
  if (mod.format === 'prova') return { ...mod, groups: [], matches: generateProva(mod.id, seeds) }
  if (mod.format === 'grupos_mata') {
    const { groups, matches } = generateGroups(mod.id, seeds, groupCount, mod.advancePerGroup ?? 2)
    return { ...mod, groups, matches }
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
  return [...table.values()].sort(
    (x, y) => y.pts - x.pts || y.pp - y.pc - (x.pp - x.pc) || y.pp - x.pp || y.v - x.v,
  )
}

/** Registra súmula, encerra a partida e propaga o vencedor pela chave. */
export function applySumula(mod: Modality, matchId: string, sumula: Sumula): Modality {
  let matches = mod.matches.map((m) =>
    m.id === matchId ? { ...m, sumula, status: 'encerrada' as const } : m,
  )
  const done = matches.find((m) => m.id === matchId)!
  const w = winnerOf(done)
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
 * local, time ou árbitro, respeitando a ordem das fases e um intervalo de descanso.
 * Partidas encerradas permanecem fixas.
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
  const lastSlotOfTeam = new Map<string, number>()

  const stageEnd = new Map<string, number>()
  const fixed = t.modalities.flatMap((mod) =>
    mod.matches.filter((m) => m.status !== 'agendada' && m.date && m.time).map((m) => ({ m, mod })),
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
      lastSlotOfTeam.set(tm, Math.max(lastSlotOfTeam.get(tm) ?? -9, i))
    })
  }

  const modalities = t.modalities.map((mod) => ({ ...mod, matches: mod.matches.map((m) => ({ ...m })) }))
  // intercala modalidades por estágio para distribuir o calendário
  const queue = modalities
    .flatMap((mod, mi) => mod.matches.filter((m) => !m.bye && m.status === 'agendada').map((m) => ({ m, mi, mod })))
    .sort((x, y) => stageKey(x.m) - stageKey(y.m) || x.mi - y.mi || x.m.slot - y.m.slot)

  for (const { m, mod } of queue) {
    const prevStages = [...stageEnd.entries()].filter(
      ([k]) => k.startsWith(mod.id + ':') && Number(k.split(':')[1]) < stageKey(m),
    )
    const minAfter = prevStages.length ? Math.max(...prevStages.map(([, v]) => v)) + 1 : 0
    const teams = teamsOf(m)
    let placed = false
    for (let i = Math.max(minAfter, minSlot); i < days.length * SLOTS.length && !placed; i++) {
      const b = at(i)
      if (teams.some((tm) => b.teams.has(tm))) continue
      if (teams.some((tm) => i - (lastSlotOfTeam.get(tm) ?? -9) < 2)) continue
      const venue = (mod.venues?.length ? mod.venues : t.venues).find((v) => !b.venues.has(v))
      if (!venue) continue
      const referee = [...t.referees].sort((x, y) => (refLoad.get(x) ?? 0) - (refLoad.get(y) ?? 0)).find((r) => !b.refs.has(r))
      if (!referee) continue
      m.date = days[Math.floor(i / SLOTS.length)]
      m.time = SLOTS[i % SLOTS.length]
      m.venue = venue
      m.referee = referee
      b.venues.add(venue)
      b.refs.add(referee)
      teams.forEach((tm) => {
        b.teams.add(tm)
        lastSlotOfTeam.set(tm, i)
      })
      refLoad.set(referee, (refLoad.get(referee) ?? 0) + 1)
      const key = `${mod.id}:${stageKey(m)}`
      stageEnd.set(key, Math.max(stageEnd.get(key) ?? 0, i))
      placed = true
    }
  }
  return { ...t, modalities }
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
  return conflicts
}
