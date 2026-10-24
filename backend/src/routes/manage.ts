import type { FastifyPluginAsync } from 'fastify'
import {
  addReferee,
  draw,
  optimize,
  recordLive,
  recordSumula,
  removePrize,
  removeReferee,
  removeTeam,
  reschedule,
  toggleSeed,
  transition,
  unpin,
  upsertPrize,
  upsertTeam,
  validatePrize,
  validateTeam,
  type Sumula,
  type Tournament,
} from '../domain'
import { manage } from '../http'
import type { Repo } from '../repo/types'
import { Draw, PrizeBody, RefereeBody, Slot, SumulaBody, TeamBody, Transition } from '../schemas'

/* Gestão do torneio (só o organizador dono): ciclo de vida, sorteio, agenda, súmulas e cadastros. */

type P<K extends string> = { Params: Record<K, string> }

/** Valida antes de aplicar: o servidor não confia na validação feita no navegador. */
const checked = <T>(errors: string[], value: T) => {
  if (errors.length) throw new Error(errors[0])
  return value
}

export const manageRoutes: FastifyPluginAsync<{ repo: Repo }> = async (app, { repo }) => {
  const T = '/torneios/:id'
  const run = (req: Parameters<typeof manage>[1], reply: Parameters<typeof manage>[2], id: string, f: (t: Tournament) => Tournament) => manage(repo, req, reply, id, f)

  app.post<P<'id'>>(`${T}/transicoes`, (req, reply) => {
    const { status } = Transition.parse(req.body)
    return run(req, reply, req.params.id, (t) => transition(t, status))
  })

  app.post<P<'id' | 'mid'>>(`${T}/modalidades/:mid/sorteio`, (req, reply) => {
    const opts = Draw.parse(req.body ?? {})
    return run(req, reply, req.params.id, (t) => draw(t, req.params.mid, opts))
  })

  app.post<P<'id'>>(`${T}/agenda/otimizar`, (req, reply) => run(req, reply, req.params.id, (t) => optimize(t)))

  app.put<P<'id' | 'pid'>>(`${T}/partidas/:pid/agendamento`, (req, reply) => {
    const slot = Slot.parse(req.body)
    return run(req, reply, req.params.id, (t) => reschedule(t, req.params.pid, slot))
  })
  app.delete<P<'id' | 'pid'>>(`${T}/partidas/:pid/agendamento`, (req, reply) => run(req, reply, req.params.id, (t) => unpin(t, req.params.pid)))

  app.post<P<'id' | 'mid' | 'pid'>>(`${T}/modalidades/:mid/partidas/:pid/sumula`, (req, reply) => {
    const body = SumulaBody.parse(req.body)
    const sumula = body.sumula as Sumula
    return run(req, reply, req.params.id, (t) => (body.aoVivo ? recordLive : recordSumula)(t, req.params.mid, req.params.pid, sumula))
  })

  app.put<P<'id' | 'tid'>>(`${T}/times/:tid`, (req, reply) => {
    const { team, modalityIds } = TeamBody.parse(req.body)
    const full = { ...team, id: req.params.tid }
    return run(req, reply, req.params.id, (t) => upsertTeam(t, checked(validateTeam(full, t), full), modalityIds))
  })
  app.delete<P<'id' | 'tid'>>(`${T}/times/:tid`, (req, reply) => run(req, reply, req.params.id, (t) => removeTeam(t, req.params.tid)))

  app.post<P<'id' | 'mid' | 'tid'>>(`${T}/modalidades/:mid/cabecas/:tid`, (req, reply) => run(req, reply, req.params.id, (t) => toggleSeed(t, req.params.mid, req.params.tid)))

  app.post<P<'id'>>(`${T}/arbitros`, (req, reply) => {
    const { name } = RefereeBody.parse(req.body)
    return run(req, reply, req.params.id, (t) => addReferee(t, name))
  })
  app.delete<P<'id' | 'nome'>>(`${T}/arbitros/:nome`, (req, reply) => run(req, reply, req.params.id, (t) => removeReferee(t, req.params.nome)))

  app.put<P<'id' | 'pzid'>>(`${T}/premios/:pzid`, (req, reply) => {
    const prize = { ...PrizeBody.parse(req.body), id: req.params.pzid }
    return run(req, reply, req.params.id, (t) => upsertPrize(t, checked(validatePrize(prize), prize)))
  })
  app.delete<P<'id' | 'pzid'>>(`${T}/premios/:pzid`, (req, reply) => run(req, reply, req.params.id, (t) => removePrize(t, req.params.pzid)))
}
