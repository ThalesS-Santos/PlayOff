import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { ApiError, createApi, type Api, type Session } from './api'
import { reschedule, unpin } from './engine'
import { canManage, checkAccessCode, isOrganizer } from './permissions'
import { addReferee, removePrize, removeReferee, removeTeam, toggleSeed, upsertPrize, upsertTeam } from './registry'
import { DEMO_USERS } from './seed'
import { parseState, reducer, SESSION_KEY, STORAGE_KEY, type State } from './state'
import { StoreCtx, type Ctx, type Toast } from './store'
import { createTournament, draw, editDetails, optimize, recordLive, recordSumula, transition } from './tournament'
import type { Tournament } from './types'

const EMPTY: State = { user: null, orgs: [], tournaments: [], unlocked: [] }

const safe = <T,>(f: () => T, fallback: T): T => {
  try {
    return f()
  } catch {
    // armazenamento bloqueado (modo privado, permissões): segue só em memória
    return fallback
  }
}
const readSession = (): Session | null => safe(() => JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null, null)
const writeSession = (s: Session | null) => safe(() => (s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY)), undefined)

export interface StoreProviderProps {
  children: ReactNode
  /** endereço da API; sem ele, o app roda no modo demonstração (dados no navegador) */
  apiUrl?: string
  /** para testes: substitui o fetch do navegador */
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
}

export function StoreProvider({ children, apiUrl, fetchImpl }: StoreProviderProps) {
  const mode: Ctx['mode'] = apiUrl ? 'api' : 'local'
  const tokenRef = useRef<string | null>(mode === 'api' ? (readSession()?.token ?? null) : null)
  const api = useMemo<Api | null>(() => (apiUrl ? createApi(apiUrl, () => tokenRef.current, fetchImpl) : null), [apiUrl, fetchImpl])
  const [state, dispatch] = useReducer(reducer, undefined, () => (mode === 'local' ? safe(() => parseState(localStorage.getItem(STORAGE_KEY)), parseState(null)) : EMPTY))
  const [booting, setBooting] = useState(mode === 'api' && !!tokenRef.current)
  const [toasts, setToasts] = useState<Toast[]>([])
  // tentativas de código no modo local (no modo API o servidor controla)
  const attempts = useRef(new Map<string, { count: number; lockedUntil?: number }>())

  useEffect(() => {
    if (mode === 'local') safe(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), undefined)
  }, [mode, state])

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  // fechamento automático dos avisos; cancelado se o app sair da tela antes
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random()
      setToasts((ts) => [...ts.slice(-3), { ...t, id }])
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        dismiss(id)
      }, 3800)
      timers.current.add(timer)
    },
    [dismiss],
  )

  const endSession = useCallback(() => {
    tokenRef.current = null
    writeSession(null)
    dispatch({ type: 'serverLoaded', ...EMPTY })
  }, [])

  /** Erro do servidor vira aviso; sessão expirada leva de volta ao login. */
  const fail = useCallback(
    (e: unknown): false => {
      if (e instanceof ApiError && e.status === 401 && tokenRef.current) {
        endSession()
        toast({ title: 'Sessão expirada', body: 'Entre de novo para continuar.', tone: 'warn' })
      } else toast({ title: 'Não foi possível concluir', body: (e as Error).message, tone: 'warn' })
      return false
    },
    [endSession, toast],
  )

  /** Carrega sessão, organizações e catálogo do servidor. */
  const bootstrap = useCallback(async () => {
    if (!api) return
    try {
      const [me, orgs, list] = await Promise.all([api.me(), api.orgs(), api.list()])
      dispatch({ type: 'serverLoaded', user: me.user, orgs, tournaments: list, unlocked: me.unlocked })
    } catch (e) {
      fail(e)
    } finally {
      setBooting(false)
    }
  }, [api, fail])

  useEffect(() => {
    if (tokenRef.current) void bootstrap()
  }, [bootstrap])

  const value = useMemo<Ctx>(() => {
    const get = (id: string) => state.tournaments.find((t) => t.id === id)

    /** Modo local: aplica a regra pura se o usuário administra o torneio. */
    const local = async (id: string, f: (t: Tournament) => Tournament) => {
      const t = get(id)
      if (!t || !canManage(state.user, t)) {
        toast({ title: 'Sem permissão', body: 'Só o organizador do torneio pode fazer isso.', tone: 'warn' })
        return false
      }
      try {
        dispatch({ type: 'upsert', t: f(t) })
        return true
      } catch (e) {
        return fail(e)
      }
    }
    /** Escolhe a implementação: regra local ou rota da API (que devolve o torneio atualizado). */
    const act = (id: string, f: (t: Tournament) => Tournament, remote: (api: Api) => Promise<Tournament>) =>
      api
        ? remote(api).then(
            (t) => (dispatch({ type: 'serverTournament', t }), true),
            (e) => fail(e),
          )
        : local(id, f)

    const startSession = async (s: Session) => {
      tokenRef.current = s.token
      writeSession(s)
      setBooting(true)
      await bootstrap()
      return true
    }

    return {
      ...state,
      mode,
      booting,
      toasts,
      toast,
      dismiss,
      get,
      demoUsers: DEMO_USERS,
      orgOf: (t) => state.orgs.find((o) => o.id === t.orgId) ?? state.orgs[0] ?? { id: t.orgId, name: '', short: '', hue: 285 },
      canManage: (t) => canManage(state.user, t),

      loginDemo: (user) => dispatch({ type: 'login', user }),
      login: async (email, password) => (api ? api.login(email, password).then(startSession, fail) : false),
      register: async (body) => (api ? api.register(body).then(startSession, fail) : false),
      logout: () => (api ? endSession() : dispatch({ type: 'logout' })),
      reset: async () => {
        if (!api) return dispatch({ type: 'reset' })
        setBooting(true)
        await bootstrap()
      },
      loadTournament: async (id) => {
        if (!api) return get(id) ? 'ok' : 'nao_encontrado'
        try {
          dispatch({ type: 'serverTournament', t: await api.get(id) })
          return 'ok'
        } catch (e) {
          if (e instanceof ApiError && e.code === 'privado') return 'privado'
          if (e instanceof ApiError && e.status === 404) {
            dispatch({ type: 'serverRemoved', id })
            return 'nao_encontrado'
          }
          fail(e)
          return get(id) ? 'ok' : 'nao_encontrado'
        }
      },

      toggleFavorite: async (t) => {
        if (!state.user) return false
        const on = !t.favoritedBy.includes(state.user.id)
        if (api)
          try {
            await api.favorite(t.id, on)
          } catch (e) {
            return fail(e)
          }
        dispatch({ type: 'toggleFav', id: t.id })
        return true
      },
      unlock: async (t, code) => {
        if (!api) {
          const { result, attempts: next } = checkAccessCode(t, code, attempts.current.get(t.id) ?? { count: 0 })
          attempts.current.set(t.id, next)
          if (result.ok) {
            dispatch({ type: 'unlock', id: t.id })
            return { ok: true }
          }
          return { ok: false, message: result.reason === 'bloqueado' ? `Muitas tentativas. Aguarde ${Math.ceil((result.retryInMs ?? 0) / 1000)} s e tente de novo.` : 'Código incorreto. Tente novamente.' }
        }
        try {
          await api.unlock(t.id, code)
          dispatch({ type: 'serverTournament', t: await api.get(t.id) })
          dispatch({ type: 'unlock', id: t.id })
          return { ok: true }
        } catch (e) {
          if (e instanceof ApiError && (e.status === 403 || e.status === 429)) return { ok: false, message: e.code === 'codigo_incorreto' ? 'Código incorreto. Tente novamente.' : e.message }
          fail(e)
          return { ok: false, message: (e as Error).message }
        }
      },
      createTournament: async (draft) => {
        try {
          const t = api ? await api.create(draft) : createTournament(draft, state.user!, state.tournaments)
          dispatch(api ? { type: 'serverTournament', t } : { type: 'upsert', t })
          return t
        } catch (e) {
          fail(e)
          return null
        }
      },
      removeTournament: async (id) => {
        if (!api) {
          const t = get(id)
          if (!t || !canManage(state.user, t)) return fail(new Error('Só o organizador do torneio pode fazer isso.'))
          dispatch({ type: 'remove', id })
          return true
        }
        return api.remove(id).then(
          () => (dispatch({ type: 'serverRemoved', id }), true),
          (e) => fail(e),
        )
      },
      saveOrg: async (org) => {
        if (!api) {
          if (!isOrganizer(state.user) || state.user!.orgId !== org.id) return fail(new Error('Só organizadores da própria organização alteram a identidade visual.'))
          dispatch({ type: 'org', org })
          return true
        }
        return api.saveOrg(org).then(
          (o) => (dispatch({ type: 'serverOrg', org: o }), true),
          (e) => fail(e),
        )
      },

      registerSumula: (tId, modId, matchId, s) => act(tId, (t) => recordSumula(t, modId, matchId, s), (a) => a.sumula(tId, modId, matchId, s, false)),
      saveLive: (tId, modId, matchId, s) => act(tId, (t) => recordLive(t, modId, matchId, s), (a) => a.sumula(tId, modId, matchId, s, true)),
      generate: (tId, modId, opts) => act(tId, (t) => draw(t, modId, opts), (a) => a.draw(tId, modId, opts)),
      optimize: (tId) => act(tId, (t) => optimize(t), (a) => a.optimize(tId)),
      transition: (tId, status) => act(tId, (t) => transition(t, status), (a) => a.transition(tId, status)),
      editDetails: (tId, d) => act(tId, (t) => editDetails(t, d, state.tournaments), (a) => a.editDetails(tId, d)),
      saveTeam: (tId, team, modalityIds) => act(tId, (t) => upsertTeam(t, team, modalityIds), (a) => a.saveTeam(tId, team, modalityIds)),
      removeTeam: (tId, teamId) => act(tId, (t) => removeTeam(t, teamId), (a) => a.removeTeam(tId, teamId)),
      toggleSeed: (tId, modId, teamId) => act(tId, (t) => toggleSeed(t, modId, teamId), (a) => a.toggleSeed(tId, modId, teamId)),
      addReferee: (tId, name) => act(tId, (t) => addReferee(t, name), (a) => a.addReferee(tId, name)),
      removeReferee: (tId, name) => act(tId, (t) => removeReferee(t, name), (a) => a.removeReferee(tId, name)),
      savePrize: (tId, prize) => act(tId, (t) => upsertPrize(t, prize), (a) => a.savePrize(tId, prize)),
      removePrize: (tId, prizeId) => act(tId, (t) => removePrize(t, prizeId), (a) => a.removePrize(tId, prizeId)),
      reschedule: (tId, matchId, slot) => act(tId, (t) => reschedule(t, matchId, slot), (a) => a.reschedule(tId, matchId, slot)),
      unpin: (tId, matchId) => act(tId, (t) => unpin(t, matchId), (a) => a.unpin(tId, matchId)),
    }
  }, [state, mode, booting, toasts, toast, dismiss, api, fail, bootstrap, endSession])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
