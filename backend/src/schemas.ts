import { z } from 'zod'

/*
 * Formato dos dados que chegam na API. Aqui só se confere a forma (tipos e tamanhos);
 * as regras de negócio são as do domínio (validateDetails, validateTeam, sumulaErrors...).
 */

const text = (max = 120) => z.string().max(max)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD.')
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor no formato #RRGGBB.')
const id = z.string().min(1).max(64)

/** id escolhido pelo cliente na URL (time, prêmio): cabe na chave primária do banco */
export const ClientId = z.string().regex(/^[\w-]{1,64}$/, 'Identificador inválido (até 64 letras, números, _ ou -).')

export const Register = z.object({
  name: text(80).min(2, 'Informe o nome.'),
  email: z.string().email('E-mail inválido.').max(120),
  password: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.').max(128),
  role: z.enum(['organizador', 'espectador']),
  /** organizador cria a própria organização */
  orgName: text(80).optional(),
})

export const Login = z.object({ email: z.string().email().max(120), password: z.string().min(1).max(128) })

export const OrgUpdate = z.object({ name: text(80).min(2), short: text(3).min(1), hue: z.number().int().min(0).max(360) })

const Details = {
  name: text(),
  description: text(1000),
  startDate: date,
  endDate: date,
  city: text(),
  venueName: text(),
  venues: z.array(text(60)).max(30),
  visibility: z.enum(['publico', 'privado']),
  accessCode: text(40).optional(),
}

export const TournamentDetails = z.object(Details)

const Prize = z.object({
  name: text(),
  kind: z.enum(['coletivo', 'individual']),
  value: z.number().nonnegative().optional(),
  place: z.number().int(),
  modalityId: id.optional(),
  awardee: text().optional(),
})

export const TournamentDraft = z.object({
  ...Details,
  referees: z.array(text(80)).max(50),
  cover: z.tuple([color, color]),
  modalities: z
    .array(
      z.object({
        id: id.optional(),
        sport: text(60).min(1),
        kind: z.enum(['pontos', 'set', 'colocacao']),
        category: z.enum(['M', 'F', 'Misto']),
        sub: text(60).optional(),
        format: z.enum(['eliminacao', 'dupla_eliminacao', 'grupos_mata', 'pontos_corridos', 'prova']),
        returno: z.boolean().optional(),
        teams: z.array(text(80)).max(64),
        seeds: z.array(text(80)).max(64),
      }),
    )
    .max(20),
  prizes: z.array(Prize.omit({ awardee: true })).max(50),
  generateNow: z.boolean(),
})

export const Transition = z.object({ status: z.enum(['criacao', 'publicado', 'chaveamento', 'andamento', 'finalizado', 'cancelado']) })

export const Draw = z.object({
  groupCount: z.number().int().min(1).max(8).optional(),
  advance: z.number().int().min(1).max(2).optional(),
  returno: z.boolean().optional(),
})

export const Slot = z.object({ date, time: z.string().regex(/^\d{2}:\d{2}$/), venue: text(60), referee: text(80) })

const Card = z.object({ teamId: id, playerId: z.string().max(64), color: z.enum(['amarelo', 'vermelho']), minute: z.number() })
export const SumulaBody = z.object({
  aoVivo: z.boolean().optional(),
  sumula: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('pontos'), a: z.number(), b: z.number(), penA: z.number().optional(), penB: z.number().optional(), cards: z.array(Card).max(100) }),
    z.object({ kind: z.literal('set'), sets: z.array(z.tuple([z.number(), z.number()])).max(9), cards: z.array(Card).max(100) }),
    z.object({ kind: z.literal('colocacao'), entries: z.array(z.object({ teamId: id, timeMs: z.number() })).max(64) }),
  ]),
})

export const TeamBody = z.object({
  team: z.object({
    name: text(80),
    short: text(4),
    color,
    coach: text(80),
    players: z.array(z.object({ id, name: text(80), nickname: text(40).optional(), number: z.number() })).max(60),
  }),
  modalityIds: z.array(id).max(20),
})

export const RefereeBody = z.object({ name: text(80) })
export const PrizeBody = Prize
export const AccessBody = z.object({ code: z.string().max(40) })
