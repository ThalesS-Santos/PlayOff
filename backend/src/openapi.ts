import type { ZodTypeAny } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AccessBody, Draw, Login, OrgUpdate, PrizeBody, RefereeBody, Register, Slot, SumulaBody, TeamBody, TournamentDetails, TournamentDraft, Transition } from './schemas'

/*
 * Documentação da API (OpenAPI 3), servida em /docs. Os corpos das requisições vêm
 * dos mesmos esquemas zod que as rotas usam para validar: não há duas definições.
 * Um teste confere que toda rota registrada está aqui (e vice-versa).
 */

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
/** quem pode chamar: qualquer um (o login é opcional), quem está logado, ou só o organizador dono do torneio */
type Access = 'publico' | 'login' | 'dono'

interface RouteDoc {
  method: Method
  /** caminho depois de /api/v1, no formato do Fastify (:id) */
  path: string
  tag: string
  summary: string
  access: Access
  body?: ZodTypeAny
  /** status de sucesso, quando não é 200 */
  status?: number
}

const T = '/torneios/:id'

export const ROUTES: RouteDoc[] = [
  { method: 'get', path: '/saude', tag: 'Sistema', summary: 'Verifica se a API e o banco respondem', access: 'publico' },

  { method: 'post', path: '/auth/registro', tag: 'Login', summary: 'Cria uma conta (organizador cria também a sua organização) e já entra', access: 'publico', body: Register, status: 201 },
  { method: 'post', path: '/auth/login', tag: 'Login', summary: 'Entra com e-mail e senha e recebe o token', access: 'publico', body: Login },
  { method: 'get', path: '/me', tag: 'Login', summary: 'Usuário do token e torneios privados liberados para ele', access: 'login' },

  { method: 'get', path: '/organizacoes', tag: 'Organizações', summary: 'Lista as organizações (identidade visual)', access: 'publico' },
  { method: 'put', path: '/organizacoes/:id', tag: 'Organizações', summary: 'Altera nome, sigla e cor da própria organização', access: 'login', body: OrgUpdate },

  { method: 'get', path: '/torneios', tag: 'Torneios', summary: 'Catálogo (privados aparecem resumidos até o código ser informado)', access: 'publico' },
  { method: 'post', path: '/torneios', tag: 'Torneios', summary: 'Cria um torneio (só organizadores)', access: 'login', body: TournamentDraft, status: 201 },
  { method: 'get', path: T, tag: 'Torneios', summary: 'Torneio completo: chave, partidas, times e prêmios', access: 'publico' },
  { method: 'patch', path: T, tag: 'Torneios', summary: 'Edita os dados gerais do torneio', access: 'dono', body: TournamentDetails },
  { method: 'delete', path: T, tag: 'Torneios', summary: 'Exclui o torneio', access: 'dono', status: 204 },
  { method: 'post', path: `${T}/acesso`, tag: 'Torneios', summary: 'Informa o código de um torneio privado (bloqueio após 5 erros)', access: 'login', body: AccessBody },
  { method: 'put', path: `${T}/favorito`, tag: 'Torneios', summary: 'Favorita o torneio', access: 'login' },
  { method: 'delete', path: `${T}/favorito`, tag: 'Torneios', summary: 'Desfavorita o torneio', access: 'login' },

  { method: 'post', path: `${T}/transicoes`, tag: 'Gestão', summary: 'Muda o status (ciclo de vida) do torneio', access: 'dono', body: Transition },
  { method: 'post', path: `${T}/modalidades/:mid/sorteio`, tag: 'Gestão', summary: 'Sorteia a chave e gera a agenda da modalidade', access: 'dono', body: Draw },
  { method: 'post', path: `${T}/agenda/otimizar`, tag: 'Gestão', summary: 'Refaz a agenda sem conflitos (mantém as partidas fixadas)', access: 'dono' },
  { method: 'put', path: `${T}/partidas/:pid/agendamento`, tag: 'Gestão', summary: 'Reagenda uma partida (fica fixada)', access: 'dono', body: Slot },
  { method: 'delete', path: `${T}/partidas/:pid/agendamento`, tag: 'Gestão', summary: 'Solta a partida fixada para a otimização', access: 'dono' },
  { method: 'post', path: `${T}/modalidades/:mid/partidas/:pid/sumula`, tag: 'Gestão', summary: 'Registra a súmula (ao vivo ou encerrando a partida)', access: 'dono', body: SumulaBody },
  { method: 'put', path: `${T}/times/:tid`, tag: 'Cadastros', summary: 'Cria ou altera um time e suas inscrições', access: 'dono', body: TeamBody },
  { method: 'delete', path: `${T}/times/:tid`, tag: 'Cadastros', summary: 'Remove um time', access: 'dono' },
  { method: 'post', path: `${T}/modalidades/:mid/cabecas/:tid`, tag: 'Cadastros', summary: 'Marca ou desmarca o time como cabeça de chave', access: 'dono' },
  { method: 'post', path: `${T}/arbitros`, tag: 'Cadastros', summary: 'Adiciona um árbitro', access: 'dono', body: RefereeBody },
  { method: 'delete', path: `${T}/arbitros/:nome`, tag: 'Cadastros', summary: 'Remove um árbitro', access: 'dono' },
  { method: 'put', path: `${T}/premios/:pzid`, tag: 'Cadastros', summary: 'Cria ou altera um prêmio', access: 'dono', body: PrizeBody },
  { method: 'delete', path: `${T}/premios/:pzid`, tag: 'Cadastros', summary: 'Remove um prêmio', access: 'dono' },
]

const ACCESS_NOTE: Record<Access, string> = {
  publico: 'Aberta. Com token, a resposta considera o usuário (ex.: torneios privados liberados).',
  login: 'Exige login (token).',
  dono: 'Exige login como o organizador dono do torneio.',
}

const error = { $ref: '#/components/schemas/Erro' }

export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const r of ROUTES) {
    const path = `/api/v1${r.path.replace(/:(\w+)/g, '{$1}')}`
    const params = [...r.path.matchAll(/:(\w+)/g)].map(([, name]) => ({ name, in: 'path', required: true, schema: { type: 'string' } }))
    const responses: Record<string, unknown> = {
      [r.status ?? 200]: { description: r.status === 204 ? 'Feito (sem conteúdo)' : 'Sucesso' },
      ...(r.body ? { 400: { description: 'Dados em formato inválido', content: { 'application/json': { schema: error } } } } : {}),
      ...(r.access === 'publico' ? {} : { 401: { description: 'Sem login ou token expirado', content: { 'application/json': { schema: error } } } }),
      ...(r.access === 'dono' ? { 403: { description: 'Não é o organizador do torneio', content: { 'application/json': { schema: error } } } } : {}),
      ...(r.access === 'dono' ? { 422: { description: 'Recusado por uma regra de negócio (a mensagem explica)', content: { 'application/json': { schema: error } } } } : {}),
    }
    paths[path] ??= {}
    paths[path][r.method] = {
      tags: [r.tag],
      summary: r.summary,
      description: ACCESS_NOTE[r.access],
      ...(r.access === 'publico' ? {} : { security: [{ token: [] }] }),
      ...(params.length ? { parameters: params } : {}),
      ...(r.body ? { requestBody: { required: true, content: { 'application/json': { schema: zodToJsonSchema(r.body, { target: 'openApi3', $refStrategy: 'none' }) } } } } : {}),
      responses,
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: 'PlayOff API', version: '1.0.0', description: 'Torneios, cadastros, sorteio, agenda e súmulas. Entre em /auth/login e use o token em "Authorize".' },
    components: {
      securitySchemes: { token: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Erro: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
    paths,
  }
}
