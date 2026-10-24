import { canManage, isOrganizer } from './permissions'
import { buildSeed, ORGS } from './seed'
import type { Organization, Tournament, User } from './types'

/* Estado da aplicação (persistido no navegador) e o reducer que o altera. */

export const STORAGE_KEY = 'playoff:v3'
/** Sessão do modo API (token + usuário), guardada no navegador. */
export const SESSION_KEY = 'playoff:session'

export interface State {
  user: User | null
  orgs: Organization[]
  tournaments: Tournament[]
  unlocked: string[]
}

export type Action =
  | { type: 'login'; user: User }
  | { type: 'logout' }
  | { type: 'toggleFav'; id: string }
  | { type: 'unlock'; id: string }
  | { type: 'upsert'; t: Tournament }
  | { type: 'remove'; id: string }
  | { type: 'org'; org: Organization }
  | { type: 'reset' }
  /* modo API: dados que vieram do servidor (que já conferiu as permissões) */
  | { type: 'serverLoaded'; user: User | null; orgs: Organization[]; tournaments: Tournament[]; unlocked: string[] }
  | { type: 'serverTournament'; t: Tournament }
  | { type: 'serverRemoved'; id: string }
  | { type: 'serverOrg'; org: Organization }

export const freshState = (user: User | null = null): State => ({ user, orgs: ORGS, tournaments: buildSeed(), unlocked: [] })

/** Aceita o que está salvo só se tiver o formato esperado; senão recomeça com a demonstração. */
export function parseState(raw: string | null): State {
  if (!raw) return freshState()
  try {
    const s = JSON.parse(raw) as Partial<State> | null
    if (s && Array.isArray(s.tournaments) && Array.isArray(s.orgs) && Array.isArray(s.unlocked) && (s.user === null || typeof s.user?.id === 'string'))
      return s as State
  } catch {
    /* JSON corrompido: cai para os dados de demonstração abaixo */
  }
  return freshState()
}

/**
 * Toda alteração de torneio passa por aqui: só o organizador dono cria, edita ou
 * exclui (RN04). Ações sem permissão são ignoradas, sem alterar o estado.
 */
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'login':
      return { ...s, user: a.user }
    case 'logout':
      return { ...s, user: null }
    case 'toggleFav': {
      const id = s.user?.id
      if (!id) return s
      return {
        ...s,
        tournaments: s.tournaments.map((t) =>
          t.id !== a.id ? t : { ...t, favoritedBy: t.favoritedBy.includes(id) ? t.favoritedBy.filter((x) => x !== id) : [...t.favoritedBy, id] },
        ),
      }
    }
    case 'unlock':
      return s.unlocked.includes(a.id) ? s : { ...s, unlocked: [...s.unlocked, a.id] }
    case 'upsert': {
      const current = s.tournaments.find((t) => t.id === a.t.id)
      // dono do torneio atual e do novo (não dá para "transferir" um torneio para si)
      if ((current && !canManage(s.user, current)) || !canManage(s.user, a.t)) return s
      return {
        ...s,
        tournaments: current ? s.tournaments.map((t) => (t.id === a.t.id ? a.t : t)) : [a.t, ...s.tournaments],
      }
    }
    case 'remove': {
      const current = s.tournaments.find((t) => t.id === a.id)
      if (!current || !canManage(s.user, current)) return s
      return { ...s, tournaments: s.tournaments.filter((t) => t.id !== a.id) }
    }
    case 'org':
      // cada organizador só altera a identidade da própria organização (RF06)
      if (!isOrganizer(s.user) || s.user!.orgId !== a.org.id) return s
      return { ...s, orgs: s.orgs.map((o) => (o.id === a.org.id ? a.org : o)) }
    case 'reset':
      return freshState(s.user)
    case 'serverLoaded':
      return { user: a.user, orgs: a.orgs, tournaments: a.tournaments, unlocked: a.unlocked }
    case 'serverTournament':
      return {
        ...s,
        tournaments: s.tournaments.some((t) => t.id === a.t.id) ? s.tournaments.map((t) => (t.id === a.t.id ? a.t : t)) : [a.t, ...s.tournaments],
      }
    case 'serverRemoved':
      return { ...s, tournaments: s.tournaments.filter((t) => t.id !== a.id) }
    case 'serverOrg':
      return { ...s, orgs: s.orgs.some((o) => o.id === a.org.id) ? s.orgs.map((o) => (o.id === a.org.id ? a.org : o)) : [...s.orgs, a.org] }
  }
}
