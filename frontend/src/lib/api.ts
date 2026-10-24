import type { Slot } from './engine'
import type { TournamentDetails, TournamentDraft } from './tournament'
import type { Organization, Prize, Sumula, Team, Tournament, TournamentStatus, User } from './types'

/* Cliente da API do PlayOff (backend/). Cada método corresponde a uma rota. */

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Torneio como vem no catálogo: privados sem acesso chegam sem times/partidas. */
export type TournamentSummary = Tournament & { locked?: boolean; teamCount?: number }

export interface Session {
  token: string
  user: User
}

export interface Api {
  login(email: string, password: string): Promise<Session>
  register(body: { name: string; email: string; password: string; role: User['role']; orgName?: string }): Promise<Session>
  me(): Promise<{ user: User; unlocked: string[] }>
  orgs(): Promise<Organization[]>
  saveOrg(org: Organization): Promise<Organization>
  list(): Promise<TournamentSummary[]>
  get(id: string): Promise<Tournament>
  create(draft: TournamentDraft): Promise<Tournament>
  editDetails(id: string, d: TournamentDetails): Promise<Tournament>
  remove(id: string): Promise<void>
  unlock(id: string, code: string): Promise<void>
  favorite(id: string, on: boolean): Promise<void>
  transition(id: string, status: TournamentStatus): Promise<Tournament>
  draw(id: string, modId: string, opts?: { groupCount?: number; advance?: number; returno?: boolean }): Promise<Tournament>
  optimize(id: string): Promise<Tournament>
  reschedule(id: string, matchId: string, slot: Slot): Promise<Tournament>
  unpin(id: string, matchId: string): Promise<Tournament>
  sumula(id: string, modId: string, matchId: string, sumula: Sumula, aoVivo: boolean): Promise<Tournament>
  saveTeam(id: string, team: Team, modalityIds: string[]): Promise<Tournament>
  removeTeam(id: string, teamId: string): Promise<Tournament>
  toggleSeed(id: string, modId: string, teamId: string): Promise<Tournament>
  addReferee(id: string, name: string): Promise<Tournament>
  removeReferee(id: string, name: string): Promise<Tournament>
  savePrize(id: string, prize: Prize): Promise<Tournament>
  removePrize(id: string, prizeId: string): Promise<Tournament>
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export function createApi(baseUrl: string, getToken: () => string | null, fetchImpl: Fetch = (i, init) => fetch(i, init)): Api {
  const base = baseUrl.replace(/\/$/, '')
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = getToken()
    let res: Response
    try {
      res = await fetchImpl(`${base}/api/v1${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, 'sem_conexao', 'Não foi possível falar com o servidor. Verifique a conexão.')
    }
    if (res.status === 204) return undefined as T
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(res.status, data.code ?? 'erro', data.message ?? `Erro ${res.status}.`)
    return data as T
  }
  const T = (id: string) => `/torneios/${encodeURIComponent(id)}`
  const e = encodeURIComponent
  return {
    login: (email, password) => call('POST', '/auth/login', { email, password }),
    register: (body) => call('POST', '/auth/registro', body),
    me: () => call('GET', '/me'),
    orgs: () => call('GET', '/organizacoes'),
    saveOrg: (o) => call('PUT', `/organizacoes/${e(o.id)}`, { name: o.name, short: o.short, hue: o.hue }),
    list: () => call('GET', '/torneios'),
    get: (id) => call('GET', T(id)),
    create: (draft) => call('POST', '/torneios', draft),
    editDetails: (id, d) => call('PATCH', T(id), d),
    remove: (id) => call('DELETE', T(id)),
    unlock: (id, code) => call('POST', `${T(id)}/acesso`, { code }),
    favorite: (id, on) => call(on ? 'PUT' : 'DELETE', `${T(id)}/favorito`),
    transition: (id, status) => call('POST', `${T(id)}/transicoes`, { status }),
    draw: (id, modId, opts) => call('POST', `${T(id)}/modalidades/${e(modId)}/sorteio`, opts ?? {}),
    optimize: (id) => call('POST', `${T(id)}/agenda/otimizar`),
    reschedule: (id, matchId, slot) => call('PUT', `${T(id)}/partidas/${e(matchId)}/agendamento`, slot),
    unpin: (id, matchId) => call('DELETE', `${T(id)}/partidas/${e(matchId)}/agendamento`),
    sumula: (id, modId, matchId, sumula, aoVivo) => call('POST', `${T(id)}/modalidades/${e(modId)}/partidas/${e(matchId)}/sumula`, { sumula, aoVivo }),
    saveTeam: (id, team, modalityIds) => call('PUT', `${T(id)}/times/${e(team.id)}`, { team: { name: team.name, short: team.short, color: team.color, coach: team.coach, players: team.players }, modalityIds }),
    removeTeam: (id, teamId) => call('DELETE', `${T(id)}/times/${e(teamId)}`),
    toggleSeed: (id, modId, teamId) => call('POST', `${T(id)}/modalidades/${e(modId)}/cabecas/${e(teamId)}`),
    addReferee: (id, name) => call('POST', `${T(id)}/arbitros`, { name }),
    removeReferee: (id, name) => call('DELETE', `${T(id)}/arbitros/${e(name)}`),
    savePrize: (id, p) => call('PUT', `${T(id)}/premios/${e(p.id)}`, { name: p.name, kind: p.kind, place: p.place, value: p.value, modalityId: p.modalityId, awardee: p.awardee }),
    removePrize: (id, prizeId) => call('DELETE', `${T(id)}/premios/${e(prizeId)}`),
  }
}
