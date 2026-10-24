import { hashPassword } from './auth/password'
import { buildSeed, DEMO_USERS, ORGS } from './domain'
import type { Repo } from './repo/types'

/*
 * Dados de demonstração: os mesmos torneios do frontend e usuários de teste.
 * Senha de todos os usuários de demonstração: DEMO_PASSWORD (só para desenvolvimento).
 */
export const DEMO_PASSWORD = 'playoff123'

export const DEMO_ACCOUNTS = [
  { ...DEMO_USERS[0], email: 'organizador@playoff.dev' },
  { ...DEMO_USERS[1], email: 'visitante@playoff.dev' },
  // dono do torneio de basquete da demonstração (outro organizador)
  { id: 'u3', name: 'Bia Torres', role: 'organizador' as const, orgId: 'o2', email: 'arena@playoff.dev' },
]

export async function seedRepo(repo: Repo) {
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  for (const o of ORGS) await repo.saveOrg(o)
  for (const a of DEMO_ACCOUNTS) await repo.createUser({ ...a, passwordHash })
  for (const t of buildSeed()) await repo.saveTournament(t)
}
