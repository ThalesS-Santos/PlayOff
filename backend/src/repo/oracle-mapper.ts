import type { Card, Group, Match, Modality, Prize, Sumula, Team, Tournament } from '../domain'

/*
 * Conversão entre o torneio (agregado do domínio) e as linhas das tabelas Oracle
 * (db/001_schema.sql). Funções puras: testadas em ida e volta sem precisar de banco.
 * Convenções: opcional ausente ↔ NULL; booleano ↔ NUMBER(1); listas ↔ coluna ORDEM;
 * datas trafegam como texto 'AAAA-MM-DD' (o SQL converte com TO_DATE/TO_CHAR).
 */

export type Value = string | number | null
export type Row = Record<string, Value>

/** Tabelas filhas de TORNEIO, na ordem em que precisam ser inseridas. */
export const CHILD_TABLES = [
  'TORNEIO_LOCAL',
  'TORNEIO_ARBITRO',
  'TIMES',
  'JOGADORES',
  'MODALIDADE',
  'MODALIDADE_LOCAL',
  'PARTICIPACAO',
  'GRUPO',
  'GRUPO_TIME',
  'PARTIDA',
  'PARTIDA_PARTICIPANTE',
  'SUMULA',
  'SUMULA_PONTOS',
  'SUMULA_SET',
  'SUMULA_COLOCACAO',
  'CARTAO',
  'PREMIO',
] as const
export type ChildTable = (typeof CHILD_TABLES)[number]
export type TournamentRows = { TORNEIO: Row } & Record<ChildTable, Row[]>

const n = <T>(v: T | undefined | null): T | null => (v === undefined ? null : v)
const flag = (v: boolean | undefined) => (v ? 1 : null)
const tri = (v: boolean | undefined) => (v === undefined ? null : v ? 1 : 0)
const str = (v: Value) => (v === null ? undefined : String(v))
const num = (v: Value) => (v === null ? undefined : Number(v))
const bool = (v: Value) => (v === null ? undefined : Number(v) === 1)
const byOrder = (a: Row, b: Row) => Number(a.ORDEM) - Number(b.ORDEM)
const of = (rows: Row[], key: string, id: Value) => rows.filter((r) => r[key] === id).sort(byOrder)
/** remove chaves undefined (o domínio usa "ausente", não "undefined") */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export function tournamentToRows(t: Tournament): TournamentRows {
  const rows = Object.fromEntries(CHILD_TABLES.map((k) => [k, [] as Row[]])) as Record<ChildTable, Row[]>
  t.venues.forEach((nome, i) => rows.TORNEIO_LOCAL.push({ ID_TORNEIO: t.id, ORDEM: i, NOME: nome }))
  t.referees.forEach((nome, i) => rows.TORNEIO_ARBITRO.push({ ID_TORNEIO: t.id, ORDEM: i, NOME: nome }))
  t.teams.forEach((tm, i) => {
    rows.TIMES.push({ ID: tm.id, ID_TORNEIO: t.id, ORDEM: i, NOME: tm.name, SIGLA: tm.short, COR: tm.color, TECNICO: tm.coach })
    tm.players.forEach((p, j) => rows.JOGADORES.push({ ID: p.id, ID_TIME: tm.id, ORDEM: j, NOME: p.name, APELIDO: n(p.nickname), NUMERO_CAMISA: p.number }))
  })
  t.modalities.forEach((m, i) => {
    rows.MODALIDADE.push({
      ID: m.id, ID_TORNEIO: t.id, ORDEM: i, ESPORTE: m.sport, TIPO_SUMULA: m.kind, CATEGORIA: m.category, SUBMODALIDADE: n(m.sub),
      FORMATO: m.format, CLASSIFICADOS_GRUPO: n(m.advancePerGroup), QTD_GRUPOS: n(m.groupCount), RETURNO: tri(m.returno),
    })
    m.venues?.forEach((nome, j) => rows.MODALIDADE_LOCAL.push({ ID_MODALIDADE: m.id, ORDEM: j, NOME: nome }))
    m.teamIds.forEach((tid, j) => {
      const seed = m.seeds.indexOf(tid)
      rows.PARTICIPACAO.push({ ID_MODALIDADE: m.id, ID_TIME: tid, ORDEM: j, ORDEM_CABECA: seed >= 0 ? seed : null })
    })
    m.groups.forEach((g, j) => {
      rows.GRUPO.push({ ID: g.id, ID_MODALIDADE: m.id, ORDEM: j, NOME: g.name })
      g.teamIds.forEach((tid, k) => rows.GRUPO_TIME.push({ ID_GRUPO: g.id, ORDEM: k, ID_TIME: tid }))
    })
    m.matches.forEach((x, j) => matchToRows(x, m.id, j, rows))
  })
  t.prizes.forEach((p, i) =>
    rows.PREMIO.push({ ID: p.id, ID_TORNEIO: t.id, ORDEM: i, NOME: p.name, TIPO: p.kind, VALOR: n(p.value), COLOCACAO: p.place, ID_MODALIDADE: n(p.modalityId), CONTEMPLADO: n(p.awardee) }),
  )
  return {
    TORNEIO: {
      ID: t.id, NOME: t.name, DESCRICAO: t.description, ID_ORGANIZACAO: t.orgId, ID_ORGANIZADOR: t.organizerId, VISIBILIDADE: t.visibility,
      CODIGO_ACESSO: n(t.accessCode), STATUS: t.status, DATA_INICIO: t.startDate, DATA_FIM: t.endDate, CIDADE: t.city, NOME_LOCAL: t.venueName,
      CAPA_1: t.cover[0], CAPA_2: t.cover[1], CRIADO_EM_MS: t.createdAt,
    },
    ...rows,
  }
}

function matchToRows(x: Match, modId: string, ordem: number, rows: Record<ChildTable, Row[]>) {
  rows.PARTIDA.push({
    ID: x.id, ID_MODALIDADE: modId, ORDEM: ordem, FASE: x.phase, RODADA: x.round, POSICAO: x.slot, ID_GRUPO: n(x.groupId),
    ID_TIME_A: n(x.a), ID_TIME_B: n(x.b), ROTULO_A: n(x.placeholderA), ROTULO_B: n(x.placeholderB),
    PROX_PARTIDA: n(x.nextMatchId), PROX_LADO: n(x.nextSide), CHAVE: n(x.bracket), PROX_PERDEDOR: n(x.loserNextMatchId), PROX_PERDEDOR_LADO: n(x.loserNextSide),
    ESTAGIO: n(x.stage), ORIGEM_A_GRUPO: n(x.sourceA?.groupId), ORIGEM_A_LUGAR: n(x.sourceA?.place), ORIGEM_B_GRUPO: n(x.sourceB?.groupId), ORIGEM_B_LUGAR: n(x.sourceB?.place),
    BYE: flag(x.bye), STATUS: x.status, DATA_PARTIDA: n(x.date), HORA: n(x.time), LOCAL_PARTIDA: n(x.venue), ARBITRO: n(x.referee), FIXADA: flag(x.pinned),
  })
  x.participants?.forEach((tid, i) => rows.PARTIDA_PARTICIPANTE.push({ ID_PARTIDA: x.id, ORDEM: i, ID_TIME: tid }))
  const s = x.sumula
  if (!s) return
  rows.SUMULA.push({ ID_PARTIDA: x.id, TIPO: s.kind })
  if (s.kind === 'pontos') rows.SUMULA_PONTOS.push({ ID_PARTIDA: x.id, PONTUACAO_A: s.a, PONTUACAO_B: s.b, PENALTIS_A: n(s.penA), PENALTIS_B: n(s.penB) })
  if (s.kind === 'set') s.sets.forEach(([a, b], i) => rows.SUMULA_SET.push({ ID_PARTIDA: x.id, NUM_SET: i + 1, PONTUACAO_A: a, PONTUACAO_B: b }))
  if (s.kind === 'colocacao') s.entries.forEach((e, i) => rows.SUMULA_COLOCACAO.push({ ID_PARTIDA: x.id, ORDEM: i, ID_TIME: e.teamId, TEMPO_MS: e.timeMs }))
  if (s.kind !== 'colocacao')
    s.cards.forEach((c, i) => rows.CARTAO.push({ ID_PARTIDA: x.id, ORDEM: i, ID_TIME: c.teamId, ID_JOGADOR: c.playerId, COR: c.color, MINUTO: c.minute }))
}

/** Monta o torneio a partir das linhas (já filtradas por ID_TORNEIO) e da lista de quem favoritou. */
export function rowsToTournament(r: TournamentRows, favoritedBy: string[] = []): Tournament {
  const T = r.TORNEIO
  const teams: Team[] = [...r.TIMES].sort(byOrder).map((tm) => ({
    id: String(tm.ID),
    name: String(tm.NOME),
    short: String(tm.SIGLA),
    color: String(tm.COR),
    coach: String(tm.TECNICO),
    players: of(r.JOGADORES, 'ID_TIME', tm.ID).map((p) => clean({ id: String(p.ID), name: String(p.NOME), nickname: str(p.APELIDO), number: Number(p.NUMERO_CAMISA) })),
  }))
  const modalities: Modality[] = [...r.MODALIDADE].sort(byOrder).map((m) => {
    const part = of(r.PARTICIPACAO, 'ID_MODALIDADE', m.ID)
    const venues = of(r.MODALIDADE_LOCAL, 'ID_MODALIDADE', m.ID).map((v) => String(v.NOME))
    const groups: Group[] = of(r.GRUPO, 'ID_MODALIDADE', m.ID).map((g) => ({ id: String(g.ID), name: String(g.NOME), teamIds: of(r.GRUPO_TIME, 'ID_GRUPO', g.ID).map((x) => String(x.ID_TIME)) }))
    return clean({
      id: String(m.ID),
      sport: String(m.ESPORTE),
      kind: m.TIPO_SUMULA as Modality['kind'],
      category: m.CATEGORIA as Modality['category'],
      sub: str(m.SUBMODALIDADE),
      format: m.FORMATO as Modality['format'],
      teamIds: part.map((p) => String(p.ID_TIME)),
      seeds: part.filter((p) => p.ORDEM_CABECA !== null).sort((a, b) => Number(a.ORDEM_CABECA) - Number(b.ORDEM_CABECA)).map((p) => String(p.ID_TIME)),
      groups,
      matches: of(r.PARTIDA, 'ID_MODALIDADE', m.ID).map((x) => rowToMatch(x, r)),
      advancePerGroup: num(m.CLASSIFICADOS_GRUPO),
      groupCount: num(m.QTD_GRUPOS),
      returno: bool(m.RETURNO),
      venues: venues.length ? venues : undefined,
    })
  })
  const prizes: Prize[] = [...r.PREMIO].sort(byOrder).map((p) =>
    clean({ id: String(p.ID), name: String(p.NOME), kind: p.TIPO as Prize['kind'], value: num(p.VALOR), place: Number(p.COLOCACAO), modalityId: str(p.ID_MODALIDADE), awardee: str(p.CONTEMPLADO) }),
  )
  return clean({
    id: String(T.ID),
    name: String(T.NOME),
    description: String(T.DESCRICAO),
    orgId: String(T.ID_ORGANIZACAO),
    organizerId: String(T.ID_ORGANIZADOR),
    visibility: T.VISIBILIDADE as Tournament['visibility'],
    accessCode: str(T.CODIGO_ACESSO),
    status: T.STATUS as Tournament['status'],
    startDate: String(T.DATA_INICIO),
    endDate: String(T.DATA_FIM),
    city: String(T.CIDADE),
    venueName: String(T.NOME_LOCAL),
    venues: [...r.TORNEIO_LOCAL].sort(byOrder).map((v) => String(v.NOME)),
    referees: [...r.TORNEIO_ARBITRO].sort(byOrder).map((v) => String(v.NOME)),
    cover: [String(T.CAPA_1), String(T.CAPA_2)],
    teams,
    modalities,
    prizes,
    favoritedBy,
    createdAt: Number(T.CRIADO_EM_MS),
  })
}

function rowToMatch(x: Row, r: TournamentRows): Match {
  const id = x.ID
  const participants = of(r.PARTIDA_PARTICIPANTE, 'ID_PARTIDA', id).map((p) => String(p.ID_TIME))
  return clean({
    id: String(id),
    phase: String(x.FASE),
    round: Number(x.RODADA),
    slot: Number(x.POSICAO),
    groupId: str(x.ID_GRUPO),
    a: str(x.ID_TIME_A),
    b: str(x.ID_TIME_B),
    placeholderA: str(x.ROTULO_A),
    placeholderB: str(x.ROTULO_B),
    participants: participants.length ? participants : undefined,
    nextMatchId: str(x.PROX_PARTIDA),
    nextSide: str(x.PROX_LADO) as Match['nextSide'],
    bracket: str(x.CHAVE) as Match['bracket'],
    loserNextMatchId: str(x.PROX_PERDEDOR),
    loserNextSide: str(x.PROX_PERDEDOR_LADO) as Match['loserNextSide'],
    stage: num(x.ESTAGIO),
    sourceA: x.ORIGEM_A_GRUPO === null ? undefined : { groupId: String(x.ORIGEM_A_GRUPO), place: Number(x.ORIGEM_A_LUGAR) },
    sourceB: x.ORIGEM_B_GRUPO === null ? undefined : { groupId: String(x.ORIGEM_B_GRUPO), place: Number(x.ORIGEM_B_LUGAR) },
    bye: bool(x.BYE),
    status: x.STATUS as Match['status'],
    sumula: rowsToSumula(String(id), r),
    date: str(x.DATA_PARTIDA),
    time: str(x.HORA),
    venue: str(x.LOCAL_PARTIDA),
    referee: str(x.ARBITRO),
    pinned: bool(x.FIXADA),
  })
}

function rowsToSumula(id: string, r: TournamentRows): Sumula | undefined {
  const head = r.SUMULA.find((s) => s.ID_PARTIDA === id)
  if (!head) return undefined
  const cards: Card[] = of(r.CARTAO, 'ID_PARTIDA', id).map((c) => ({ teamId: String(c.ID_TIME), playerId: String(c.ID_JOGADOR), color: c.COR as Card['color'], minute: Number(c.MINUTO) }))
  if (head.TIPO === 'pontos') {
    const p = r.SUMULA_PONTOS.find((s) => s.ID_PARTIDA === id)!
    return clean({ kind: 'pontos' as const, a: Number(p.PONTUACAO_A), b: Number(p.PONTUACAO_B), penA: num(p.PENALTIS_A), penB: num(p.PENALTIS_B), cards })
  }
  if (head.TIPO === 'set')
    return {
      kind: 'set',
      sets: r.SUMULA_SET.filter((s) => s.ID_PARTIDA === id)
        .sort((a, b) => Number(a.NUM_SET) - Number(b.NUM_SET))
        .map((s) => [Number(s.PONTUACAO_A), Number(s.PONTUACAO_B)] as [number, number]),
      cards,
    }
  return { kind: 'colocacao', entries: of(r.SUMULA_COLOCACAO, 'ID_PARTIDA', id).map((e) => ({ teamId: String(e.ID_TIME), timeMs: Number(e.TEMPO_MS) })) }
}
