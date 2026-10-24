import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { hashPassword, verifyPassword } from '../auth/password'
import { signToken } from '../auth/token'
import { isOrganizer } from '../domain'
import { forbidden, HttpError, notFound, requireUser } from '../http'
import type { Repo } from '../repo/types'
import { Login, OrgUpdate, Register } from '../schemas'

/* RF07 (login) e RF06 (identidade visual da organização). */

let dummyHash: string | undefined

export const authRoutes: FastifyPluginAsync<{ repo: Repo; jwtSecret: string }> = async (app, { repo, jwtSecret }) => {
  const session = async (user: { id: string; name: string; role: 'organizador' | 'espectador'; orgId?: string }) => ({
    token: await signToken(user.id, jwtSecret),
    user: { id: user.id, name: user.name, role: user.role, orgId: user.orgId },
  })

  app.post('/auth/registro', async (req, reply) => {
    const body = Register.parse(req.body)
    if (body.role === 'organizador' && !body.orgName?.trim()) throw new HttpError(400, 'validacao', 'Organizador precisa informar o nome da organização.')
    if (await repo.findUserByEmail(body.email)) throw new HttpError(409, 'duplicado', 'E-mail já cadastrado.')
    let orgId: string | undefined
    if (body.role === 'organizador') {
      orgId = `o_${randomUUID()}`
      const name = body.orgName!.trim()
      await repo.saveOrg({ id: orgId, name, short: name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'PO', hue: 285 })
    }
    const user = { id: `u_${randomUUID()}`, name: body.name.trim(), role: body.role, orgId }
    await repo.createUser({ ...user, email: body.email.trim().toLowerCase(), passwordHash: await hashPassword(body.password) })
    return reply.status(201).send(await session(user))
  })

  app.post('/auth/login', async (req) => {
    const body = Login.parse(req.body)
    const user = await repo.findUserByEmail(body.email)
    // mesma resposta (e mesmo custo de hash) para e-mail inexistente e senha errada: não revela quem tem conta
    dummyHash ??= await hashPassword('senha-que-ninguem-usa')
    const ok = await verifyPassword(body.password, user?.passwordHash ?? dummyHash)
    if (!user || !ok) throw new HttpError(401, 'credenciais', 'E-mail ou senha incorretos.')
    return session(user)
  })

  app.get('/me', async (req) => {
    const user = requireUser(req)
    return { user, unlocked: await repo.accessList(user.id) }
  })

  app.get('/organizacoes', async () => repo.listOrgs())

  app.put<{ Params: { id: string } }>('/organizacoes/:id', async (req) => {
    const user = requireUser(req)
    const org = await repo.getOrg(req.params.id)
    if (!org) throw notFound('Organização')
    if (!isOrganizer(user) || user.orgId !== org.id) throw forbidden('Só organizadores da própria organização alteram a identidade visual.')
    const body = OrgUpdate.parse(req.body)
    const next = { ...org, name: body.name.trim(), short: body.short.trim().toUpperCase(), hue: body.hue }
    await repo.saveOrg(next)
    return next
  })
}
