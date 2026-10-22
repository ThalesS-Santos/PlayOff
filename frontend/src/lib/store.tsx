import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { applySumula, generateMatches, scheduleTournament } from './engine'
import { buildSeed, DEMO_USERS, ORGS } from './seed'
import type { Organization, Sumula, Tournament, TournamentStatus, User } from './types'

const KEY = 'playoff:v3'

interface State {
  user: User | null
  orgs: Organization[]
  tournaments: Tournament[]
  unlocked: string[]
}

type Action =
  | { type: 'login'; user: User }
  | { type: 'logout' }
  | { type: 'toggleFav'; id: string }
  | { type: 'unlock'; id: string }
  | { type: 'upsert'; t: Tournament }
  | { type: 'remove'; id: string }
  | { type: 'org'; org: Organization }
  | { type: 'reset' }

function initial(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    /* armazenamento indisponível: segue com dados de demonstração */
  }
  return { user: null, orgs: ORGS, tournaments: buildSeed(), unlocked: [] }
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'login':
      return { ...s, user: a.user }
    case 'logout':
      return { ...s, user: null }
    case 'toggleFav': {
      const uidv = s.user?.id
      if (!uidv) return s
      return {
        ...s,
        tournaments: s.tournaments.map((t) =>
          t.id !== a.id
            ? t
            : { ...t, favoritedBy: t.favoritedBy.includes(uidv) ? t.favoritedBy.filter((x) => x !== uidv) : [...t.favoritedBy, uidv] },
        ),
      }
    }
    case 'unlock':
      return { ...s, unlocked: [...new Set([...s.unlocked, a.id])] }
    case 'upsert':
      return {
        ...s,
        tournaments: s.tournaments.some((t) => t.id === a.t.id)
          ? s.tournaments.map((t) => (t.id === a.t.id ? a.t : t))
          : [a.t, ...s.tournaments],
      }
    case 'remove':
      return { ...s, tournaments: s.tournaments.filter((t) => t.id !== a.id) }
    case 'org':
      return { ...s, orgs: s.orgs.map((o) => (o.id === a.org.id ? a.org : o)) }
    case 'reset':
      return { user: s.user, orgs: ORGS, tournaments: buildSeed(), unlocked: [] }
  }
}

/* ───────────────────────── toasts ───────────────────────── */

export interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'ok' | 'warn' | 'info'
}

interface Ctx extends State {
  dispatch: React.Dispatch<Action>
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  get: (id: string) => Tournament | undefined
  orgOf: (t: Tournament) => Organization
  canManage: (t: Tournament) => boolean
  registerSumula: (tId: string, modId: string, matchId: string, s: Sumula) => void
  saveLive: (tId: string, modId: string, matchId: string, s: Sumula) => void
  generate: (tId: string, modId: string, groupCount?: number) => void
  optimize: (tId: string) => void
  transition: (tId: string, status: TournamentStatus) => void
  demoUsers: User[]
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignora: protótipo funciona sem persistência */
    }
  }, [state])

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random()
      setToasts((ts) => [...ts.slice(-3), { ...t, id }])
      setTimeout(() => dismiss(id), 3800)
    },
    [dismiss],
  )

  const value = useMemo<Ctx>(() => {
    const get = (id: string) => state.tournaments.find((t) => t.id === id)
    const update = (id: string, f: (t: Tournament) => Tournament) => {
      const t = get(id)
      if (t) dispatch({ type: 'upsert', t: f(t) })
    }
    return {
      ...state,
      dispatch,
      toasts,
      toast,
      dismiss,
      get,
      demoUsers: DEMO_USERS,
      orgOf: (t) => state.orgs.find((o) => o.id === t.orgId) ?? state.orgs[0],
      canManage: (t) => state.user?.role === 'organizador' && state.user.id === t.organizerId,
      registerSumula: (tId, modId, matchId, s) =>
        update(tId, (t) => {
          const modalities = t.modalities.map((m) => (m.id === modId ? applySumula(m, matchId, s) : m))
          const allDone = modalities.every((m) => m.matches.length && m.matches.every((x) => x.status === 'encerrada'))
          return { ...t, modalities, status: allDone ? 'finalizado' : t.status === 'chaveamento' ? 'andamento' : t.status }
        }),
      saveLive: (tId, modId, matchId, s) =>
        update(tId, (t) => ({
          ...t,
          status: t.status === 'chaveamento' ? 'andamento' : t.status,
          modalities: t.modalities.map((m) =>
            m.id !== modId ? m : { ...m, matches: m.matches.map((x) => (x.id === matchId ? { ...x, sumula: s, status: 'ao_vivo' } : x)) },
          ),
        })),
      generate: (tId, modId, groupCount) =>
        update(tId, (t) =>
          scheduleTournament({
            ...t,
            status: t.status === 'publicado' || t.status === 'criacao' ? 'chaveamento' : t.status,
            modalities: t.modalities.map((m) => (m.id === modId ? generateMatches(m, groupCount) : m)),
          }),
        ),
      optimize: (tId) => update(tId, (t) => scheduleTournament(t, new Date().toISOString().slice(0, 10))),
      transition: (tId, status) =>
        update(tId, (t) =>
          status === 'chaveamento' && t.modalities.some((m) => !m.matches.length)
            ? scheduleTournament({ ...t, status, modalities: t.modalities.map((m) => (m.matches.length ? m : generateMatches(m))) })
            : { ...t, status },
        ),
    }
  }, [state, toasts, toast, dismiss])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore fora do StoreProvider')
  return c
}

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  criacao: 'Em criação',
  publicado: 'Inscrições abertas',
  chaveamento: 'Chaveamento definido',
  andamento: 'Em andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}
