import type { Organization, Tournament, User } from '../domain'

/* Contrato de persistência: o mesmo para memória e Oracle. */

export interface StoredUser extends User {
  email: string
  passwordHash: string
}

export interface Repo {
  findUserByEmail(email: string): Promise<StoredUser | undefined>
  findUser(id: string): Promise<StoredUser | undefined>
  /** falha com DuplicateError se o e-mail já existir */
  createUser(u: StoredUser): Promise<void>

  listOrgs(): Promise<Organization[]>
  getOrg(id: string): Promise<Organization | undefined>
  saveOrg(o: Organization): Promise<void>

  listTournaments(): Promise<Tournament[]>
  getTournament(id: string): Promise<Tournament | undefined>
  /**
   * Cria ou substitui o torneio inteiro (agregado), de forma atômica. Os favoritos
   * não fazem parte da gravação de um torneio existente (só setFavorite os altera).
   */
  saveTournament(t: Tournament): Promise<void>
  deleteTournament(id: string): Promise<void>

  /** favoritar/desfavoritar sem regravar o torneio (evita sobrescrever alterações do organizador) */
  setFavorite(userId: string, tournamentId: string, on: boolean): Promise<void>

  /** torneios privados liberados para o usuário depois de informar o código */
  grantAccess(userId: string, tournamentId: string): Promise<void>
  accessList(userId: string): Promise<string[]>

  /** verifica se o armazenamento responde (rota /saude) */
  ping(): Promise<void>
  close(): Promise<void>
}

export class DuplicateError extends Error {}
