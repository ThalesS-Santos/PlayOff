import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { canManage, checkAccessCode, createTournament, editDetails, isOrganizer } from '../domain'
import { forbidden, HttpError, loadVisible, manage, notFound, present, requireUser, summary } from '../http'
import type { Repo } from '../repo/types'
import { AccessBody, TournamentDetails, TournamentDraft } from '../schemas'

/* Catálogo, acesso a privados, favoritos e criar/editar/excluir torneio. */

export const tournamentRoutes: FastifyPluginAsync<{ repo: Repo }> = async (app, { repo }) => {
  // tentativas de código por usuário e torneio (bloqueio temporário, seção 13.1)
  const attempts = new Map<string, { count: number; lockedUntil?: number }>()

  app.get('/torneios', async (req) => {
    const unlocked = req.user ? await repo.accessList(req.user.id) : []
    return (await repo.listTournaments()).map((t) => summary(t, req.user, unlocked))
  })

  app.get<{ Params: { id: string } }>('/torneios/:id', async (req) => present(await loadVisible(repo, req, req.params.id), req.user))

  app.post('/torneios', async (req, reply) => {
    const user = requireUser(req)
    if (!isOrganizer(user)) throw forbidden('Só organizadores criam torneios.')
    const draft = TournamentDraft.parse(req.body)
    const t = createTournament(draft, user, await repo.listTournaments())
    await repo.saveTournament(t)
    return reply.status(201).send(present(t, user))
  })

  app.patch<{ Params: { id: string } }>('/torneios/:id', async (req, reply) => {
    const details = TournamentDetails.parse(req.body)
    const all = await repo.listTournaments()
    return manage(repo, req, reply, req.params.id, (t) => editDetails(t, details, all))
  })

  app.delete<{ Params: { id: string } }>('/torneios/:id', async (req, reply) => {
    const user = requireUser(req)
    const t = await repo.getTournament(req.params.id)
    if (!t) throw notFound()
    if (!canManage(user, t)) throw forbidden()
    await repo.deleteTournament(t.id)
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/torneios/:id/acesso', async (req) => {
    const user = requireUser(req)
    const t = await repo.getTournament(req.params.id)
    if (!t) throw notFound()
    if (t.visibility !== 'privado' || canManage(user, t)) return { ok: true }
    const { code } = AccessBody.parse(req.body)
    const key = `${user.id}:${t.id}`
    const { result, attempts: next } = checkAccessCode(t, code, attempts.get(key) ?? { count: 0 })
    attempts.set(key, next)
    if (!result.ok)
      throw result.reason === 'bloqueado'
        ? new HttpError(429, 'bloqueado', `Muitas tentativas. Aguarde ${Math.ceil((result.retryInMs ?? 0) / 1000)} s.`)
        : new HttpError(403, 'codigo_incorreto', 'Código incorreto.')
    await repo.grantAccess(user.id, t.id)
    return { ok: true }
  })

  // favoritar exige só estar logado e poder ver o torneio; não regrava o torneio inteiro
  const favorite = async (req: FastifyRequest<{ Params: { id: string } }>, on: boolean) => {
    const user = requireUser(req)
    const t = await loadVisible(repo, req, req.params.id)
    await repo.setFavorite(user.id, t.id, on)
    return { favorited: on }
  }
  app.put<{ Params: { id: string } }>('/torneios/:id/favorito', (req) => favorite(req, true))
  app.delete<{ Params: { id: string } }>('/torneios/:id/favorito', (req) => favorite(req, false))
}
