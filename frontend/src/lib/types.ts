export type Role = 'organizador' | 'espectador'

export interface User {
  id: string
  name: string
  role: Role
  orgId?: string
}

export interface Organization {
  id: string
  name: string
  short: string
  /** Matiz OKLCH (0–360) da cor primária — RF06 */
  hue: number
}

export interface Player {
  id: string
  name: string
  nickname?: string
  number: number
}

export interface Team {
  id: string
  name: string
  short: string
  color: string
  coach: string
  players: Player[]
}

/** Súmula de pontos (futebol e afins), de set (vôlei e afins) ou de colocação (natação e afins) */
export type SumulaKind = 'pontos' | 'set' | 'colocacao'

export type Format = 'eliminacao' | 'dupla_eliminacao' | 'grupos_mata' | 'pontos_corridos' | 'prova'

export type TournamentStatus =
  | 'criacao'
  | 'publicado'
  | 'chaveamento'
  | 'andamento'
  | 'finalizado'
  | 'cancelado'

export type MatchStatus = 'agendada' | 'ao_vivo' | 'encerrada'

export interface Card {
  teamId: string
  playerId: string
  color: 'amarelo' | 'vermelho'
  minute: number
}

export type Sumula =
  | { kind: 'pontos'; a: number; b: number; penA?: number; penB?: number; cards: Card[] }
  | { kind: 'set'; sets: [number, number][]; cards: Card[] }
  | { kind: 'colocacao'; entries: { teamId: string; timeMs: number }[] }

export interface Match {
  id: string
  /** fase textual: "Grupo A", "Quartas", "Semifinal", "Final", "Prova" */
  phase: string
  round: number
  slot: number
  groupId?: string
  a?: string
  b?: string
  /** rótulo quando o adversário ainda não está definido ("Venc. QF1", "1º Grupo A") */
  placeholderA?: string
  placeholderB?: string
  /** participantes de prova (colocação) */
  participants?: string[]
  nextMatchId?: string
  nextSide?: 'a' | 'b'
  /** dupla eliminação: chave dos vencedores (W), dos perdedores (L) ou grande final (F) */
  bracket?: 'W' | 'L' | 'F'
  /** dupla eliminação: para onde vai quem perde esta partida */
  loserNextMatchId?: string
  loserNextSide?: 'a' | 'b'
  /** ordem de dependência para a agenda, quando a rodada não basta (dupla eliminação) */
  stage?: number
  /** classificado de grupo que ocupará o lado A/B no mata-mata */
  sourceA?: { groupId: string; place: number }
  sourceB?: { groupId: string; place: number }
  bye?: boolean
  status: MatchStatus
  sumula?: Sumula
  date?: string
  time?: string
  venue?: string
  referee?: string
  /** horário definido manualmente pelo organizador: a otimização não o move */
  pinned?: boolean
}

export interface Group {
  id: string
  name: string
  teamIds: string[]
}

export interface Modality {
  id: string
  sport: string
  kind: SumulaKind
  category: 'M' | 'F' | 'Misto'
  sub?: string
  format: Format
  teamIds: string[]
  seeds: string[]
  groups: Group[]
  matches: Match[]
  /** classificados por grupo para o mata-mata */
  advancePerGroup?: number
  /** nº de grupos escolhido no sorteio (padrão: calculado pelo nº de times) */
  groupCount?: number
  /** pontos corridos: turno e returno (cada dupla de times se enfrenta duas vezes) */
  returno?: boolean
  /** espaços adequados à modalidade (ex.: natação só na piscina); padrão: todos do torneio */
  venues?: string[]
}

export interface Prize {
  id: string
  name: string
  kind: 'coletivo' | 'individual'
  value?: number
  place: number
  modalityId?: string
  /** contemplado de prêmio individual (artilheiro, MVP...), definido pelo organizador */
  awardee?: string
}

export interface Tournament {
  id: string
  name: string
  description: string
  orgId: string
  organizerId: string
  visibility: 'publico' | 'privado'
  accessCode?: string
  status: TournamentStatus
  startDate: string
  endDate: string
  city: string
  venueName: string
  venues: string[]
  referees: string[]
  cover: [string, string]
  teams: Team[]
  modalities: Modality[]
  prizes: Prize[]
  favoritedBy: string[]
  createdAt: number
}
