import { placeOf } from './engine'
import type { Modality, Prize, Team, Tournament } from './types'

/* Cadastros do torneio (RF02): times, jogadores, técnicos e árbitros. */

export const TEAM_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#84cc16', '#14b8a6', '#3b82f6']

const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR')

/** Inscrições só mudam enquanto a modalidade não tem jogos gerados. */
export const entriesOpen = (mod: Modality) => mod.matches.length === 0

/** Modalidades com jogos gerados em que o time está inscrito (impedem a exclusão). */
export function lockedModalities(t: Tournament, teamId: string) {
  return t.modalities.filter((m) => m.teamIds.includes(teamId) && !entriesOpen(m))
}

export function validateTeam(team: Team, t: Tournament): string[] {
  const errors: string[] = []
  if (!team.name.trim()) errors.push('Informe o nome do time.')
  else if (t.teams.some((x) => x.id !== team.id && norm(x.name) === norm(team.name))) errors.push('Já existe um time com esse nome.')
  if (!/^[\p{L}\p{N}]{2,4}$/u.test(team.short)) errors.push('A sigla deve ter de 2 a 4 letras ou números.')
  if (!team.coach.trim()) errors.push('Informe o técnico(a).')
  const numbers = new Set<number>()
  team.players.forEach((p, i) => {
    const who = p.name.trim() || `Atleta ${i + 1}`
    if (!p.name.trim()) errors.push(`Atleta ${i + 1}: informe o nome.`)
    if (!Number.isInteger(p.number) || p.number < 0 || p.number > 99) errors.push(`${who}: número da camisa deve ser de 0 a 99.`)
    else if (numbers.has(p.number)) errors.push(`${who}: camisa ${p.number} repetida.`)
    numbers.add(p.number)
  })
  return errors
}

/**
 * Cria ou atualiza um time e define em quais modalidades ele está inscrito.
 * Modalidades com jogos gerados mantêm a inscrição como está.
 */
export function upsertTeam(t: Tournament, team: Team, modalityIds: string[]): Tournament {
  const clean: Team = {
    ...team,
    name: team.name.trim(),
    short: team.short.trim().toUpperCase(),
    coach: team.coach.trim(),
    players: team.players.map((p) => ({ ...p, name: p.name.trim(), nickname: p.nickname?.trim() || undefined })),
  }
  const teams = t.teams.some((x) => x.id === team.id) ? t.teams.map((x) => (x.id === team.id ? clean : x)) : [...t.teams, clean]
  const modalities = t.modalities.map((m) => {
    if (!entriesOpen(m)) return m
    const want = modalityIds.includes(m.id)
    const has = m.teamIds.includes(team.id)
    if (want === has) return m
    return want ? { ...m, teamIds: [...m.teamIds, team.id] } : { ...m, teamIds: m.teamIds.filter((x) => x !== team.id), seeds: m.seeds.filter((x) => x !== team.id) }
  })
  return { ...t, teams, modalities }
}

export function removeTeam(t: Tournament, teamId: string): Tournament {
  if (lockedModalities(t, teamId).length) throw new Error('Time com jogos gerados não pode ser excluído.')
  return {
    ...t,
    teams: t.teams.filter((x) => x.id !== teamId),
    modalities: t.modalities.map((m) => ({ ...m, teamIds: m.teamIds.filter((x) => x !== teamId), seeds: m.seeds.filter((x) => x !== teamId) })),
  }
}

/** Liga/desliga cabeça de chave (a ordem de marcação define o ranking). */
export function toggleSeed(t: Tournament, modId: string, teamId: string): Tournament {
  return {
    ...t,
    modalities: t.modalities.map((m) =>
      m.id !== modId || !entriesOpen(m) || !m.teamIds.includes(teamId)
        ? m
        : { ...m, seeds: m.seeds.includes(teamId) ? m.seeds.filter((x) => x !== teamId) : [...m.seeds, teamId] },
    ),
  }
}

/** Partidas ainda não encerradas em que o árbitro está escalado. */
export function refereeAssignments(t: Tournament, name: string) {
  return t.modalities.flatMap((m) => m.matches.filter((x) => x.referee === name && x.status !== 'encerrada'))
}

export function validateReferee(name: string, t: Tournament): string | undefined {
  if (!name.trim()) return 'Informe o nome do árbitro.'
  if (t.referees.some((r) => norm(r) === norm(name))) return 'Árbitro já cadastrado.'
}

export function addReferee(t: Tournament, name: string): Tournament {
  const err = validateReferee(name, t)
  if (err) throw new Error(err)
  return { ...t, referees: [...t.referees, name.trim()] }
}

/* ───────────── Prêmios ───────────── */

/** Modalidade a que o prêmio se refere (com uma só modalidade, "Geral" é ela). */
export function prizeModality(t: Tournament, p: Prize) {
  return t.modalities.find((m) => m.id === p.modalityId) ?? (t.modalities.length === 1 ? t.modalities[0] : undefined)
}

/** Times contemplados por um prêmio coletivo, conforme a colocação final. */
export function prizeWinners(t: Tournament, p: Prize): Team[] {
  if (p.kind !== 'coletivo') return []
  const mod = prizeModality(t, p)
  if (!mod) return []
  return placeOf(mod, p.place)
    .map((id) => t.teams.find((x) => x.id === id))
    .filter(Boolean) as Team[]
}

/** Maior valor de prêmio (o banco guarda até 10 dígitos antes da vírgula). */
export const MAX_PRIZE_VALUE = 9_999_999_999

/** Com o torneio, confere também se a modalidade do prêmio existe. */
export function validatePrize(p: Prize, t?: Tournament): string[] {
  const errors: string[] = []
  if (!p.name.trim()) errors.push('Informe o nome do prêmio.')
  if (p.kind === 'coletivo' && (!Number.isInteger(p.place) || p.place < 1 || p.place > 3)) errors.push('Colocação deve ser 1º, 2º ou 3º lugar.')
  if (p.kind === 'individual' && (!Number.isInteger(p.place) || p.place < 1 || p.place > 99)) errors.push('Ordem do prêmio individual inválida.')
  if (p.value != null && (Number.isNaN(p.value) || p.value < 0)) errors.push('Valor não pode ser negativo.')
  else if (p.value != null && p.value > MAX_PRIZE_VALUE) errors.push('Valor alto demais.')
  if (t && p.modalityId && !t.modalities.some((m) => m.id === p.modalityId)) errors.push('Modalidade do prêmio não existe neste torneio.')
  return errors
}

export function upsertPrize(t: Tournament, p: Prize): Tournament {
  const clean: Prize = { ...p, name: p.name.trim(), awardee: p.kind === 'individual' ? p.awardee?.trim() || undefined : undefined }
  const prizes = t.prizes.some((x) => x.id === p.id) ? t.prizes.map((x) => (x.id === p.id ? clean : x)) : [...t.prizes, clean]
  return { ...t, prizes: [...prizes].sort((a, b) => a.place - b.place) }
}

export const removePrize = (t: Tournament, id: string): Tournament => ({ ...t, prizes: t.prizes.filter((p) => p.id !== id) })

export function removeReferee(t: Tournament, name: string): Tournament {
  if (refereeAssignments(t, name).length) throw new Error('Árbitro escalado em partidas pendentes.')
  return { ...t, referees: t.referees.filter((r) => r !== name) }
}
