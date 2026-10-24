import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applySumula, buildSeed, draw, recordLive, reschedule, type Match, type Modality, type Tournament } from '../domain'
import { CHILD_TABLES, rowsToTournament, tournamentToRows, type Row, type TournamentRows } from '../repo/oracle-mapper'

/* Colunas de cada tabela, lidas do próprio db/001_schema.sql. */
interface Column {
  notNull: boolean
  maxLength?: number
}
function parseSchema(): Map<string, Map<string, Column>> {
  const sql = readFileSync(new URL('../../db/001_schema.sql', import.meta.url), 'utf8')
  const tables = new Map<string, Map<string, Column>>()
  for (const [, name, body] of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
    const cols = new Map<string, Column>()
    for (const line of body.split('\n')) {
      const m = line.match(/^\s{2}([A-Z_0-9]+)\s+(VARCHAR2|NUMBER|CHAR|DATE|TIMESTAMP)(?:\((\d+)[^)]*\))?(.*)$/)
      if (!m) continue
      const [, col, type, size, rest] = m
      cols.set(col, { notNull: /NOT NULL|PRIMARY KEY/.test(rest) || pkColumns(body).includes(col), maxLength: type === 'VARCHAR2' || type === 'CHAR' ? Number(size) : undefined })
    }
    tables.set(name, cols)
  }
  return tables
}
const pkColumns = (body: string) => body.match(/PRIMARY KEY \(([^)]+)\)/)?.[1].split(',').map((s) => s.trim()) ?? []
const SCHEMA = parseSchema()

function checkAgainstSchema(rows: TournamentRows) {
  for (const [table, list] of [['TORNEIO', [rows.TORNEIO]], ...CHILD_TABLES.map((t) => [t, rows[t]])] as [string, Row[]][]) {
    const cols = SCHEMA.get(table)
    expect(cols, `tabela ${table} existe no DDL`).toBeDefined()
    const keys = list[0] && Object.keys(list[0]).sort().join()
    for (const row of list) {
      // inserção em lote: todas as linhas de uma tabela com as mesmas colunas
      expect(Object.keys(row).sort().join(), `${table}: mesmas colunas em todas as linhas`).toBe(keys)
      for (const [col, value] of Object.entries(row)) {
        const def = cols!.get(col)
        expect(def, `${table}.${col} existe no DDL`).toBeDefined()
        if (typeof value === 'string' && def!.maxLength) expect(value.length, `${table}.${col} cabe em ${def!.maxLength}`).toBeLessThanOrEqual(def!.maxLength)
      }
      for (const [col, def] of cols!)
        if (def.notNull && col !== 'LIBERADO_EM') expect(row[col] ?? null, `${table}.${col} é NOT NULL`).not.toBeNull()
    }
  }
}

const roundTrip = (t: Tournament) => {
  const rows = tournamentToRows(t)
  checkAgainstSchema(rows)
  return rowsToTournament(JSON.parse(JSON.stringify(rows)), t.favoritedBy)
}

const sample = (format: Modality['format'], kind: Modality['kind'], n: number): Tournament => {
  const base = buildSeed().find((t) => t.id === 't2')!
  const teams = Array.from({ length: n }, (_, i) => ({ id: `x${i}`, name: `Time ${i}`, short: `T${i}`, color: '#000000', coach: 'C', players: [{ id: `x${i}p`, name: 'P', number: 1 }] }))
  return { ...base, teams, modalities: [{ ...base.modalities[0], format, kind, teamIds: teams.map((x) => x.id), seeds: [teams[0].id] }] }
}

/** Joga as partidas disponíveis com súmulas do tipo certo (com cartões e pênaltis). */
function playSome(t: Tournament, count: number): Tournament {
  for (let i = 0; i < count; i++) {
    const mod = t.modalities[0]
    const m = mod.matches.find((x: Match) => !x.bye && x.status !== 'encerrada' && (x.participants || (x.a && x.b)))
    if (!m) break
    const s =
      mod.kind === 'colocacao'
        ? { kind: 'colocacao' as const, entries: m.participants!.map((p, j) => ({ teamId: p, timeMs: 1000 + j })) }
        : mod.kind === 'set'
          ? { kind: 'set' as const, sets: [[25, 20], [20, 25], [15, 9]] as [number, number][], cards: [] }
          : { kind: 'pontos' as const, a: 1, b: 1, penA: 4, penB: 3, cards: [{ teamId: m.a!, playerId: `${m.a}p`, color: 'amarelo' as const, minute: 7 }] }
    t = { ...t, modalities: [applySumula(mod, m.id, s)] }
  }
  return t
}

describe('conversão torneio ↔ linhas Oracle', () => {
  it.each(buildSeed().map((t) => [t.name, t] as const))('ida e volta sem perdas: %s', (_name, t) => {
    expect(roundTrip(t)).toEqual(t)
  })

  it.each([
    ['dupla_eliminacao', 'set', 8],
    ['pontos_corridos', 'pontos', 5],
    ['grupos_mata', 'pontos', 9],
    ['eliminacao', 'pontos', 6],
    ['prova', 'colocacao', 4],
  ] as const)('ida e volta: %s com súmulas, cartões, byes e origens de grupo', (format, kind, n) => {
    let t = draw(sample(format, kind, n), 't2m1', format === 'grupos_mata' ? { groupCount: 3 } : format === 'pontos_corridos' ? { returno: true } : undefined)
    t = playSome(t, 4)
    expect(roundTrip(t)).toEqual(t)
  })

  it('partida ao vivo, horário fixado, privado com código e prêmio individual', () => {
    let t = draw(sample('eliminacao', 'pontos', 4), 't2m1')
    const [a, b] = t.modalities[0].matches
    t = recordLive(t, 't2m1', a.id, { kind: 'pontos', a: 2, b: 1, cards: [] })
    t = reschedule(t, b.id, { date: t.startDate, time: '20:00', venue: t.venues[0], referee: t.referees[0] })
    t = { ...t, visibility: 'privado', accessCode: 'ABCD', prizes: [{ id: 'i', name: 'MVP', kind: 'individual', place: 1, value: 50.5, awardee: 'Lia' }] }
    t = { ...t, modalities: [{ ...t.modalities[0], venues: [t.venues[0]], returno: false, sub: 'Dupla' }] }
    expect(roundTrip(t)).toEqual(t)
  })

  it('formato das linhas: booleanos como 1/NULL, returno com três estados, datas como texto', () => {
    const t = draw(sample('pontos_corridos', 'pontos', 4), 't2m1', { returno: false })
    const rows = tournamentToRows(t)
    expect(rows.MODALIDADE[0].RETURNO).toBe(0)
    expect(rows.TORNEIO.DATA_INICIO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(rows.PARTIDA.every((p) => p.BYE === null && p.FIXADA === null)).toBe(true)
    expect(rows.PARTICIPACAO.filter((p) => p.ORDEM_CABECA !== null)).toHaveLength(1)
    const none = tournamentToRows({ ...t, modalities: [{ ...t.modalities[0], returno: undefined }] })
    expect(none.MODALIDADE[0].RETURNO).toBeNull()
  })

  it('o leitor tolera linhas fora de ordem (ORDER BY não é garantido pelo SELECT)', () => {
    const t = buildSeed()[0]
    const rows = tournamentToRows(t)
    const shuffled = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Array.isArray(v) ? [...v].reverse() : v])) as TournamentRows
    expect(rowsToTournament(shuffled, t.favoritedBy)).toEqual(t)
  })

  it('o verificador do esquema reprova linhas erradas (não é um teste que sempre passa)', () => {
    const ok = tournamentToRows(buildSeed()[0])
    expect(() => checkAgainstSchema({ ...ok, TORNEIO: { ...ok.TORNEIO, COLUNA_INVENTADA: 1 } })).toThrow(/COLUNA_INVENTADA existe no DDL/)
    expect(() => checkAgainstSchema({ ...ok, TORNEIO: { ...ok.TORNEIO, NOME: null } })).toThrow(/TORNEIO.NOME é NOT NULL/)
    expect(() => checkAgainstSchema({ ...ok, TORNEIO: { ...ok.TORNEIO, CAPA_1: '#0000000' } })).toThrow(/CAPA_1 cabe em 7/)
    expect(() => checkAgainstSchema({ ...ok, TIMES: [ok.TIMES[0], { ...ok.TIMES[1], EXTRA: 1 }] })).toThrow(/mesmas colunas/)
    // e o leitor do DDL de fato encontrou as colunas
    expect(SCHEMA.get('PARTIDA')!.size).toBeGreaterThanOrEqual(28)
    expect(SCHEMA.get('PARTIDA')!.get('ID_MODALIDADE')).toEqual({ notNull: true, maxLength: 64 })
    expect(SCHEMA.get('SUMULA_SET')!.get('NUM_SET')!.notNull).toBe(true) // chave primária composta
  })

  it('o esquema tem todas as tabelas usadas e as de apoio', () => {
    for (const t of ['ORGANIZACAO', 'USUARIO', 'TORNEIO', ...CHILD_TABLES, 'FAVORITO', 'ACESSO_TORNEIO']) expect(SCHEMA.has(t), t).toBe(true)
  })
})
