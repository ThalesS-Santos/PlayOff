import { applySumula, formatErrors, generateMatches, scheduleTournament, sumulaErrors, uid } from './engine'
import { isOrganizer } from './permissions'
import { TEAM_COLORS, validatePrize } from './registry'
import type { Format, Modality, Prize, Sumula, SumulaKind, Team, Tournament, TournamentStatus, User } from './types'

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

/** Lista com nome em branco ou repetido (sem diferenciar maiúsculas nem espaços nas pontas). */
const hasBlankOrRepeated = (names: string[]) => {
  const keys = names.map((n) => n.trim().toLocaleLowerCase('pt-BR'))
  return keys.some((k, i) => !k || keys.indexOf(k) !== i)
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
  else if (hasBlankOrRepeated(d.venues)) e.push('Quadras e espaços não podem ter nome vazio ou repetido.')
  if (d.visibility === 'privado' && (d.accessCode ?? '').trim().length < 4) e.push('Torneio privado precisa de um código com 4+ caracteres.')
  return e
}

/**
 * Edita os dados do torneio (caso de uso "Editar torneio"). Se o período ou os espaços
 * mudarem, as partidas pendentes não fixadas são reagendadas.
 */
export function editDetails(t: Tournament, details: TournamentDetails, others: Tournament[]): Tournament {
  const errors = validateDetails(details, others, t.organizerId, t.id)
  if (errors.length) throw new Error(errors[0])
  const d = { ...details, venues: details.venues.map((v) => v.trim()) }
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
    // (sem nenhum espaço próprio restante, a modalidade volta a usar todos os do torneio)
    modalities: t.modalities.map((m) => {
      if (!m.venues) return m
      const kept = m.venues.filter((v) => d.venues.includes(v))
      return { ...m, venues: kept.length ? kept : undefined }
    }),
  }
  const reschedule = t.startDate !== d.startDate || t.endDate !== d.endDate || t.venues.join() !== d.venues.join()
  return reschedule && !isClosed(t) && t.modalities.some((m) => m.matches.length) ? scheduleTournament(next) : next
}

/* ───────────── Criação (assistente no frontend, POST /torneios no servidor) ───────────── */

export interface DraftModality {
  id?: string
  sport: string
  kind: SumulaKind
  category: 'M' | 'F' | 'Misto'
  sub?: string
  format: Format
  returno?: boolean
  /** nomes das equipes inscritas */
  teams: string[]
  /** nomes das cabeças de chave, na ordem */
  seeds: string[]
}

export interface TournamentDraft extends TournamentDetails {
  referees: string[]
  cover: [string, string]
  modalities: DraftModality[]
  prizes: Omit<Prize, 'id'>[]
  /** sortear e agendar já na criação */
  generateNow: boolean
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

/** Erros de cada passo do assistente: 0 dados, 1 modalidades, 2 equipes, 3 prêmios, 4 revisão. */
export function draftStepErrors(step: number, d: TournamentDraft, others: Tournament[], organizerId: string): string[] {
  const e: string[] = []
  if (step === 0) {
    e.push(...validateDetails(d, others, organizerId))
    if (!d.referees.length) e.push('Informe ao menos um árbitro.')
    else if (hasBlankOrRepeated(d.referees)) e.push('Árbitros não podem ter nome vazio ou repetido.')
  }
  if (step === 1) {
    if (!d.modalities.length) e.push('Adicione pelo menos uma modalidade.')
    for (const m of d.modalities)
      if ((m.kind === 'colocacao') !== (m.format === 'prova')) e.push(`${m.sport}: súmula de colocação combina só com o formato prova.`)
  }
  if (step === 2)
    for (const m of d.modalities) {
      if (m.teams.length < 2) e.push(`${m.sport}: inscreva ao menos 2 equipes.`)
      if (m.teams.some((x, i) => !x.trim() || m.teams.findIndex((y) => sameName(x, y)) !== i)) e.push(`${m.sport}: nomes de equipe vazios ou repetidos.`)
      if (m.seeds.some((s) => !m.teams.includes(s))) e.push(`${m.sport}: cabeça de chave fora da lista de equipes.`)
    }
  if (step === 3) d.prizes.forEach((p, i) => validatePrize({ ...p, id: String(i) }).forEach((msg) => e.push(`Prêmio ${i + 1}: ${msg}`)))
  // sortear na criação exige a quantidade certa de times para o formato (ex.: dupla eliminação)
  if (step === 4 && d.generateNow) d.modalities.forEach((m) => formatErrors(m.format, m.teams.length).forEach((msg) => e.push(`${m.sport}: ${msg}.`)))
  return e
}

/** Monta o torneio a partir do rascunho (RF01); recusa rascunho inválido. */
export function createTournament(d: TournamentDraft, organizer: User, others: Tournament[], now = Date.now()): Tournament {
  if (!isOrganizer(organizer)) throw new Error('Só organizadores criam torneios.')
  const errors = [0, 1, 2, 3, 4].flatMap((s) => draftStepErrors(s, d, others, organizer.id))
  if (errors.length) throw new Error(errors[0])
  const teams: Team[] = []
  const modalities: Modality[] = d.modalities.map((m) => {
    const ids = m.teams.map((name) => {
      const id = uid('tm')
      teams.push({
        id,
        name: name.trim(),
        short: name.trim().slice(0, 3).toUpperCase(),
        color: TEAM_COLORS[teams.length % TEAM_COLORS.length],
        coach: 'A definir',
        players: Array.from({ length: 5 }, (_, j) => ({ id: `${id}p${j}`, name: `Atleta ${j + 1}`, number: j + 1 })),
      })
      return { id, name }
    })
    return {
      id: m.id ?? uid('md'),
      sport: m.sport.trim(),
      kind: m.kind,
      category: m.category,
      sub: m.sub?.trim() || undefined,
      format: m.format,
      teamIds: ids.map((x) => x.id),
      seeds: m.seeds.map((s) => ids.find((x) => x.name === s)!.id),
      groups: [],
      matches: [],
      advancePerGroup: 2,
      returno: m.format === 'pontos_corridos' ? !!m.returno : undefined,
    }
  })
  const t: Tournament = {
    id: uid('t'),
    name: d.name.trim(),
    description: d.description.trim() || 'Torneio criado no PlayOff.',
    orgId: organizer.orgId ?? 'o1',
    organizerId: organizer.id,
    visibility: d.visibility,
    accessCode: d.visibility === 'privado' ? d.accessCode!.trim().toUpperCase() : undefined,
    status: 'publicado',
    startDate: d.startDate,
    endDate: d.endDate,
    city: d.city.trim(),
    venueName: d.venueName.trim(),
    venues: d.venues.map((v) => v.trim()),
    referees: d.referees.map((r) => r.trim()),
    cover: d.cover,
    teams,
    modalities,
    // prêmio de modalidade inexistente passa a ser "Geral"
    prizes: d.prizes.map((p) => ({ ...p, name: p.name.trim(), modalityId: modalities.some((m) => m.id === p.modalityId) ? p.modalityId : undefined, id: uid('pz') })),
    favoritedBy: [],
    createdAt: now,
  }
  return d.generateNow ? scheduleTournament({ ...t, status: 'chaveamento', modalities: t.modalities.map((m) => generateMatches(m)) }) : t
}

/** "Quadra 1, Quadra 2 ,, " → ["Quadra 1", "Quadra 2"] sem repetições. */
export const splitList = (s: string) => [...new Set(s.split(',').map((v) => v.trim()).filter(Boolean))]
