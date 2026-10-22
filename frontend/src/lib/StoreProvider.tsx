import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { canManage } from './permissions'
import { DEMO_USERS } from './seed'
import { parseState, reducer, STORAGE_KEY } from './state'
import { StoreCtx, type Ctx, type Toast } from './store'
import { draw, optimize, recordLive, recordSumula, transition } from './tournament'
import type { Tournament } from './types'

function load() {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY))
  } catch {
    // armazenamento bloqueado (modo privado, permissões): segue só em memória
    return parseState(null)
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // armazenamento cheio ou bloqueado: o protótipo continua funcionando sem persistir
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
    /** Aplica a alteração se o usuário administra o torneio; regra violada vira aviso. */
    const edit = (id: string, f: (t: Tournament) => Tournament) => {
      const t = get(id)
      if (!t || !canManage(state.user, t)) {
        toast({ title: 'Sem permissão', body: 'Só o organizador do torneio pode fazer isso.', tone: 'warn' })
        return false
      }
      try {
        dispatch({ type: 'upsert', t: f(t) })
        return true
      } catch (e) {
        toast({ title: 'Não foi possível concluir', body: (e as Error).message, tone: 'warn' })
        return false
      }
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
      canManage: (t) => canManage(state.user, t),
      registerSumula: (tId, modId, matchId, s) => edit(tId, (t) => recordSumula(t, modId, matchId, s)),
      saveLive: (tId, modId, matchId, s) => edit(tId, (t) => recordLive(t, modId, matchId, s)),
      generate: (tId, modId, opts) => edit(tId, (t) => draw(t, modId, opts)),
      optimize: (tId) => edit(tId, (t) => optimize(t)),
      transition: (tId, status) => edit(tId, (t) => transition(t, status)),
      edit,
    }
  }, [state, toasts, toast, dismiss])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
