import type { Organization, Tournament } from '../domain'
import { DuplicateError, type Repo, type StoredUser } from './types'

/**
 * Repositório em memória (desenvolvimento e testes). Copia os dados a cada
 * leitura e escrita, como um banco: alterar um objeto devolvido não muda nada
 * até ele ser salvo de novo.
 */
export class MemoryRepo implements Repo {
  private users = new Map<string, StoredUser>()
  private orgs = new Map<string, Organization>()
  private tournaments = new Map<string, Tournament>()
  private access = new Map<string, Set<string>>()

  async findUserByEmail(email: string) {
    const u = [...this.users.values()].find((x) => x.email === email.trim().toLowerCase())
    return u && structuredClone(u)
  }
  async findUser(id: string) {
    const u = this.users.get(id)
    return u && structuredClone(u)
  }
  async createUser(u: StoredUser) {
    const email = u.email.trim().toLowerCase()
    // como o UNIQUE do banco: vale mesmo se a rota não tiver checado antes
    if ([...this.users.values()].some((x) => x.email === email)) throw new DuplicateError('E-mail já cadastrado.')
    this.users.set(u.id, structuredClone({ ...u, email }))
  }

  async listOrgs() {
    return structuredClone([...this.orgs.values()])
  }
  async getOrg(id: string) {
    const o = this.orgs.get(id)
    return o && structuredClone(o)
  }
  async saveOrg(o: Organization) {
    this.orgs.set(o.id, structuredClone(o))
  }

  async listTournaments() {
    return structuredClone([...this.tournaments.values()].sort((a, b) => b.createdAt - a.createdAt))
  }
  async getTournament(id: string) {
    const t = this.tournaments.get(id)
    return t && structuredClone(t)
  }
  async saveTournament(t: Tournament) {
    const current = this.tournaments.get(t.id)
    this.tournaments.set(t.id, structuredClone({ ...t, favoritedBy: current ? current.favoritedBy : t.favoritedBy }))
  }
  async deleteTournament(id: string) {
    this.tournaments.delete(id)
    for (const set of this.access.values()) set.delete(id)
  }

  async setFavorite(userId: string, tournamentId: string, on: boolean) {
    const t = this.tournaments.get(tournamentId)
    if (!t) return
    t.favoritedBy = on ? [...new Set([...t.favoritedBy, userId])] : t.favoritedBy.filter((x) => x !== userId)
  }

  async grantAccess(userId: string, tournamentId: string) {
    if (!this.access.has(userId)) this.access.set(userId, new Set())
    this.access.get(userId)!.add(tournamentId)
  }
  async accessList(userId: string) {
    return [...(this.access.get(userId) ?? [])]
  }

  async ping() {}
  async close() {}
}
