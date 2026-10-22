import { createContext, useContext } from 'react'
import type { Action, State } from './state'
import type { Organization, Sumula, Tournament, TournamentStatus, User } from './types'

/* Contexto da aplicação: estado + ações. O provedor fica em StoreProvider.tsx. */

export { STATUS_LABEL } from './tournament'

export interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'ok' | 'warn' | 'info'
}

export interface Ctx extends State {
  dispatch: React.Dispatch<Action>
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  get: (id: string) => Tournament | undefined
  orgOf: (t: Tournament) => Organization
  canManage: (t: Tournament) => boolean
  /* As ações devolvem true quando aplicadas; regra violada ou falta de permissão vira aviso. */
  registerSumula: (tId: string, modId: string, matchId: string, s: Sumula) => boolean
  saveLive: (tId: string, modId: string, matchId: string, s: Sumula) => boolean
  generate: (tId: string, modId: string, opts?: { groupCount?: number; advance?: number; returno?: boolean }) => boolean
  optimize: (tId: string) => boolean
  transition: (tId: string, status: TournamentStatus) => boolean
  /** Aplica uma alteração pura ao torneio. */
  edit: (tId: string, f: (t: Tournament) => Tournament) => boolean
  demoUsers: User[]
}

export const StoreCtx = createContext<Ctx | null>(null)

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore fora do StoreProvider')
  return c
}
