import { createContext, useContext } from 'react'
import type { Slot } from './engine'
import type { State } from './state'
import type { TournamentDetails, TournamentDraft } from './tournament'
import type { Organization, Prize, Sumula, Team, Tournament, TournamentStatus, User } from './types'

/* Contexto da aplicação: estado + ações. O provedor fica em StoreProvider.tsx. */

export { STATUS_LABEL } from './tournament'

export interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'ok' | 'warn' | 'info'
}

export type UnlockResult = { ok: true } | { ok: false; message: string }

export interface Ctx extends State {
  /** local: dados no navegador (demonstração); api: dados no servidor */
  mode: 'local' | 'api'
  /** modo API: carregando a sessão e o catálogo */
  booting: boolean
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  get: (id: string) => Tournament | undefined
  orgOf: (t: Tournament) => Organization
  canManage: (t: Tournament) => boolean
  demoUsers: User[]

  /* sessão */
  loginDemo: (user: User) => void
  login: (email: string, password: string) => Promise<boolean>
  register: (body: { name: string; email: string; password: string; role: User['role']; orgName?: string }) => Promise<boolean>
  logout: () => void
  /** local: restaura a demonstração; api: recarrega do servidor */
  reset: () => Promise<void>
  /** modo API: busca o torneio completo (no modo local já está carregado) */
  loadTournament: (id: string) => Promise<'ok' | 'privado' | 'nao_encontrado'>

  /*
   * Ações. Devolvem se deram certo; regra violada, falta de permissão ou erro
   * do servidor viram aviso na tela.
   */
  toggleFavorite: (t: Tournament) => Promise<boolean>
  unlock: (t: Tournament, code: string) => Promise<UnlockResult>
  createTournament: (draft: TournamentDraft) => Promise<Tournament | null>
  removeTournament: (id: string) => Promise<boolean>
  saveOrg: (org: Organization) => Promise<boolean>
  registerSumula: (tId: string, modId: string, matchId: string, s: Sumula) => Promise<boolean>
  saveLive: (tId: string, modId: string, matchId: string, s: Sumula) => Promise<boolean>
  generate: (tId: string, modId: string, opts?: { groupCount?: number; advance?: number; returno?: boolean }) => Promise<boolean>
  optimize: (tId: string) => Promise<boolean>
  transition: (tId: string, status: TournamentStatus) => Promise<boolean>
  editDetails: (tId: string, d: TournamentDetails) => Promise<boolean>
  saveTeam: (tId: string, team: Team, modalityIds: string[]) => Promise<boolean>
  removeTeam: (tId: string, teamId: string) => Promise<boolean>
  toggleSeed: (tId: string, modId: string, teamId: string) => Promise<boolean>
  addReferee: (tId: string, name: string) => Promise<boolean>
  removeReferee: (tId: string, name: string) => Promise<boolean>
  savePrize: (tId: string, prize: Prize) => Promise<boolean>
  removePrize: (tId: string, prizeId: string) => Promise<boolean>
  reschedule: (tId: string, matchId: string, slot: Slot) => Promise<boolean>
  unpin: (tId: string, matchId: string) => Promise<boolean>
}

export const StoreCtx = createContext<Ctx | null>(null)

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore fora do StoreProvider')
  return c
}
