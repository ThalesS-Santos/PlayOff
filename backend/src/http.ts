import type { FastifyReply, FastifyRequest } from 'fastify'
import { canManage, canView, type Tournament, type User } from './domain'
import type { Repo } from './repo/types'

/* Erros com status HTTP e auxiliares de autorização usados pelas rotas. */

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const unauthorized = () => new HttpError(401, 'nao_autenticado', 'Faça login para continuar.')
export const forbidden = (message = 'Só o organizador do torneio pode fazer isso.') => new HttpError(403, 'sem_permissao', message)
export const notFound = (what = 'Torneio') => new HttpError(404, 'nao_encontrado', `${what} não encontrado.`)

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
  }
}

export function requireUser(req: FastifyRequest): User {
  if (!req.user) throw unauthorized()
  return req.user
}

/**
 * O que cada pessoa vê de um torneio: o código de acesso só para o dono, e de
 * favoritos só se ela mesma favoritou (não expõe quem mais favoritou).
 */
export function present(t: Tournament, user: User | null): Tournament {
  const own = canManage(user, t)
  return {
    ...t,
    accessCode: own ? t.accessCode : undefined,
    favoritedBy: user && t.favoritedBy.includes(user.id) ? [user.id] : [],
  }
}

/** Resumo para o catálogo (privados aparecem, mas sem times, partidas nem prêmios). */
export function summary(t: Tournament, user: User | null, unlocked: string[]) {
  const visible = canView(user, t, unlocked)
  const p = present(t, user)
  return {
    ...p,
    locked: !visible,
    teams: visible ? p.teams : [],
    prizes: visible ? p.prizes : [],
    modalities: p.modalities.map((m) => (visible ? m : { ...m, teamIds: [], seeds: [], groups: [], matches: [] })),
    teamCount: t.teams.length,
  }
}

export async function loadVisible(repo: Repo, req: FastifyRequest, id: string): Promise<Tournament> {
  const t = await repo.getTournament(id)
  if (!t) throw notFound()
  const unlocked = req.user ? await repo.accessList(req.user.id) : []
  if (!canView(req.user, t, unlocked)) throw new HttpError(403, 'privado', 'Torneio privado: informe o código de acesso.')
  return t
}

/** Carrega, confere que o usuário é o dono, aplica a alteração (regras do domínio) e grava. */
export async function manage(repo: Repo, req: FastifyRequest, reply: FastifyReply, id: string, change: (t: Tournament) => Tournament) {
  const user = requireUser(req)
  const t = await repo.getTournament(id)
  if (!t) throw notFound()
  if (!canManage(user, t)) throw forbidden()
  const next = change(t)
  await repo.saveTournament(next)
  return reply.send(present(next, user))
}
