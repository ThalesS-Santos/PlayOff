import cors from '@fastify/cors'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { verifyToken } from './auth/token'
import { HttpError } from './http'
import { DuplicateError, type Repo } from './repo/types'
import { authRoutes } from './routes/auth'
import { manageRoutes } from './routes/manage'
import { tournamentRoutes } from './routes/tournaments'

export interface AppOptions {
  repo: Repo
  jwtSecret: string
  corsOrigin?: string
  logger?: boolean
}

export function buildApp({ repo, jwtSecret, corsOrigin = 'http://localhost:5173', logger = false }: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 1_000_000 })
  app.register(cors, { origin: corsOrigin })

  // identifica o usuário pelo token (rotas públicas funcionam sem ele)
  app.decorateRequest('user', null)
  app.addHook('onRequest', async (req) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return
    const id = await verifyToken(auth.slice(7), jwtSecret)
    const found = id ? await repo.findUser(id) : undefined
    if (!found) throw new HttpError(401, 'token_invalido', 'Sessão expirada ou inválida. Faça login de novo.')
    req.user = { id: found.id, name: found.name, role: found.role, ...(found.orgId ? { orgId: found.orgId } : {}) }
  })

  app.setErrorHandler((error, req, reply) => {
    const err = error as Error & { statusCode?: number }
    if (err instanceof HttpError) return reply.status(err.status).send({ code: err.code, message: err.message })
    if (err instanceof DuplicateError) return reply.status(409).send({ code: 'duplicado', message: err.message })
    if (err instanceof ZodError)
      return reply.status(400).send({ code: 'validacao', message: err.issues[0]?.message ?? 'Dados inválidos.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
    // erros do próprio Fastify (JSON malformado, corpo grande demais...)
    const status = err.statusCode
    if (status && status < 500) return reply.status(status).send({ code: 'requisicao_invalida', message: err.message })
    // regras do domínio lançam Error simples com a explicação para o usuário
    if (err.constructor === Error) return reply.status(422).send({ code: 'regra', message: err.message })
    // qualquer outro erro é falha do programa: registra e não expõe detalhes
    req.log.error(err)
    return reply.status(500).send({ code: 'erro_interno', message: 'Erro interno. Tente novamente.' })
  })

  app.get('/api/v1/saude', async () => {
    await repo.ping()
    return { ok: true }
  })
  app.register(authRoutes, { prefix: '/api/v1', repo, jwtSecret })
  app.register(tournamentRoutes, { prefix: '/api/v1', repo })
  app.register(manageRoutes, { prefix: '/api/v1', repo })
  return app
}
