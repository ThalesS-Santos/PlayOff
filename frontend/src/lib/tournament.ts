import { applySumula, formatErrors, generateMatches, scheduleTournament, sumulaErrors } from './engine'
import type { Sumula, Tournament, TournamentStatus } from './types'

/* Ciclo de vida do torneio (diagrama de estados, RN11) e ações que dependem dele. */

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  criacao: 'Em criação',
  publicado: 'Inscrições abertas',
  chaveamento: 'Chaveamento definido',
  andamento: 'Em andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

/** Torneio encerrado (finalizado ou cancelado) não aceita mais alterações de disputa. */
export const isClosed = (t: Tournament) => t.status === 'finalizado' || t.status === 'cancelado'

/** Súmulas só podem ser registradas com o chaveamento definido ou o torneio em andamento. */
export const canRecord = (t: Tournament) => t.status === 'chaveamento' || t.status === 'andamento'

const allPlayed = (t: Tournament) => t.modalities.every((m) => m.matches.length > 0 && m.matches.every((x) => x.status === 'encerrada'))

/** Motivos que impedem a transição pedida; vazio quando é permitida. */
export function transitionErrors(t: Tournament, to: TournamentStatus): string[] {
  if (to === 'cancelado') return isClosed(t) ? ['O torneio já está encerrado.'] : []
  const next: Partial<Record<TournamentStatus, TournamentStatus>> = {
    criacao: 'publicado',
    publicado: 'chaveamento',
    chaveamento: 'andamento',
    andamento: 'finalizado',
  }
  if (next[t.status] !== to) return [`Não é possível ir de "${STATUS_LABEL[t.status]}" para "${STATUS_LABEL[to]}".`]
  if (to === 'chaveamento') {
    const errors = t.modalities.flatMap((m) => (m.matches.length ? [] : formatErrors(m.format, m.teamIds.length).map((e) => `${m.sport}: ${e}.`)))
    if (!t.modalities.length) errors.push('Cadastre ao menos uma modalidade.')
    return errors
  }
  if (to === 'finalizado' && !allPlayed(t)) return ['Ainda há partidas sem resultado. Registre todas as súmulas (ou cancele o torneio).']
  return []
}

export function transition(t: Tournament, to: TournamentStatus): Tournament {
  const errors = transitionErrors(t, to)
  if (errors.length) throw new Error(errors[0])
  // fechar inscrições gera os jogos das modalidades que ainda não foram sorteadas
  if (to === 'chaveamento' && t.modalities.some((m) => !m.matches.length))
    return scheduleTournament({ ...t, status: to, modalities: t.modalities.map((m) => (m.matches.length ? m : generateMatches(m))) })
  return { ...t, status: to }
}

/** Sorteio (ou novo sorteio) de uma modalidade, já agendando os jogos. */
export function draw(t: Tournament, modId: string, opts?: { groupCount?: number; advance?: number; returno?: boolean }): Tournament {
  if (isClosed(t)) throw new Error('Torneio encerrado não pode ser sorteado novamente.')
  const mod = t.modalities.find((m) => m.id === modId)
  if (!mod) throw new Error('Modalidade não encontrada.')
  const errors = formatErrors(mod.format, mod.teamIds.length)
  if (errors.length) throw new Error(`${mod.sport}: ${errors[0]}.`)
  return scheduleTournament({
    ...t,
    status: t.status === 'publicado' || t.status === 'criacao' ? 'chaveamento' : t.status,
    modalities: t.modalities.map((m) =>
      m.id === modId ? generateMatches({ ...m, advancePerGroup: opts?.advance ?? m.advancePerGroup, returno: opts?.returno ?? m.returno }, opts?.groupCount) : m,
    ),
  })
}

/** Encerra a partida com a súmula; o torneio passa a "em andamento" e termina sozinho na última partida. */
export function recordSumula(t: Tournament, modId: string, matchId: string, s: Sumula): Tournament {
  if (!canRecord(t)) throw new Error('Súmulas só podem ser registradas com o torneio em andamento.')
  const modalities = t.modalities.map((m) => (m.id === modId ? applySumula(m, matchId, s) : m))
  const next = { ...t, modalities }
  return { ...next, status: allPlayed(next) ? 'finalizado' : 'andamento' }
}

/** Placar parcial: a partida fica "ao vivo". */
export function recordLive(t: Tournament, modId: string, matchId: string, s: Sumula): Tournament {
  if (!canRecord(t)) throw new Error('Súmulas só podem ser registradas com o torneio em andamento.')
  const match = t.modalities.find((m) => m.id === modId)?.matches.find((x) => x.id === matchId)
  if (!match || match.bye || !(match.a && match.b)) throw new Error('Os adversários desta partida ainda não foram definidos.')
  if (match.status === 'encerrada') throw new Error('Partida já encerrada.')
  const errors = sumulaErrors(s, match)
  if (errors.length) throw new Error(errors[0])
  return {
    ...t,
    status: 'andamento',
    modalities: t.modalities.map((m) =>
      m.id !== modId ? m : { ...m, matches: m.matches.map((x) => (x.id === matchId ? { ...x, sumula: s, status: 'ao_vivo' } : x)) },
    ),
  }
}

/** Reorganiza a agenda das partidas pendentes a partir de hoje (RF04). */
export function optimize(t: Tournament, today = new Date().toISOString().slice(0, 10)): Tournament {
  if (isClosed(t)) throw new Error('Torneio encerrado.')
  return scheduleTournament(t, today)
}

export interface TournamentDetails {
  name: string
  description: string
  startDate: string
  endDate: string
  city: string
  venueName: string
  venues: string[]
  visibility: 'publico' | 'privado'
  accessCode?: string
}

/** Validação dos dados básicos (criar e editar torneio), incluindo nome único por organizador (RN02). */
export function validateDetails(d: TournamentDetails, others: Tournament[], organizerId: string, selfId?: string): string[] {
  const e: string[] = []
  const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR')
  if (d.name.trim().length < 3) e.push('Dê um nome ao torneio (mín. 3 letras).')
  else if (others.some((t) => t.id !== selfId && t.organizerId === organizerId && norm(t.name) === norm(d.name))) e.push('Você já tem um torneio com esse nome.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(d.endDate)) e.push('Informe as datas de início e fim.')
  else if (d.endDate < d.startDate) e.push('A data final deve ser depois da inicial.')
  if (!d.venues.length) e.push('Informe ao menos uma quadra ou espaço.')
  if (d.visibility === 'privado' && (d.accessCode ?? '').trim().length < 4) e.push('Torneio privado precisa de um código com 4+ caracteres.')
  return e
}

/**
 * Edita os dados do torneio (caso de uso "Editar torneio"). Se o período ou os espaços
 * mudarem, as partidas pendentes não fixadas são reagendadas.
 */
export function editDetails(t: Tournament, d: TournamentDetails, others: Tournament[]): Tournament {
  const errors = validateDetails(d, others, t.organizerId, t.id)
  if (errors.length) throw new Error(errors[0])
  const next: Tournament = {
    ...t,
    name: d.name.trim(),
    description: d.description.trim() || t.description,
    startDate: d.startDate,
    endDate: d.endDate,
    city: d.city.trim(),
    venueName: d.venueName.trim(),
    venues: d.venues,
    visibility: d.visibility,
    accessCode: d.visibility === 'privado' ? d.accessCode!.trim().toUpperCase() : undefined,
    // espaços removidos deixam de valer para as modalidades
    modalities: t.modalities.map((m) => (m.venues ? { ...m, venues: m.venues.filter((v) => d.venues.includes(v)) } : m)),
  }
  const reschedule = t.startDate !== d.startDate || t.endDate !== d.endDate || t.venues.join() !== d.venues.join()
  return reschedule && !isClosed(t) && t.modalities.some((m) => m.matches.length) ? scheduleTournament(next) : next
}

/** "Quadra 1, Quadra 2 ,, " → ["Quadra 1", "Quadra 2"] sem repetições. */
export const splitList = (s: string) => [...new Set(s.split(',').map((v) => v.trim()).filter(Boolean))]
