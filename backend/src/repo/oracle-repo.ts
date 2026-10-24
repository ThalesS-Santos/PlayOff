import oracledb from 'oracledb'
import type { Organization, Tournament } from '../domain'
import { CHILD_TABLES, rowsToTournament, tournamentToRows, type ChildTable, type Row, type TournamentRows } from './oracle-mapper'
import { DuplicateError, type Repo, type StoredUser } from './types'

/*
 * Repositório Oracle (node-oracledb em modo thin: não precisa do Oracle Client).
 * ATENÇÃO: ainda não foi executado contra um banco real (não havia Oracle instalado
 * quando foi escrito). A conversão de/para linhas está testada em oracle-mapper.test.ts;
 * este arquivo só monta e executa o SQL. Valide com `npm run db:seed` ao instalar o banco.
 */

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const DATE_COLUMNS = new Set(['DATA_INICIO', 'DATA_FIM', 'DATA_PARTIDA'])

/** Expressão SQL que dá o torneio dono de cada linha das tabelas filhas (alias t). */
const BY_MOD = (col: string) => `(SELECT m.ID_TORNEIO FROM MODALIDADE m WHERE m.ID = ${col})`
const BY_MATCH = BY_MOD('(SELECT p.ID_MODALIDADE FROM PARTIDA p WHERE p.ID = t.ID_PARTIDA)')
const OWNER: Record<ChildTable, string> = {
  TORNEIO_LOCAL: 't.ID_TORNEIO',
  TORNEIO_ARBITRO: 't.ID_TORNEIO',
  TIMES: 't.ID_TORNEIO',
  JOGADORES: '(SELECT x.ID_TORNEIO FROM TIMES x WHERE x.ID = t.ID_TIME)',
  MODALIDADE: 't.ID_TORNEIO',
  MODALIDADE_LOCAL: BY_MOD('t.ID_MODALIDADE'),
  PARTICIPACAO: BY_MOD('t.ID_MODALIDADE'),
  GRUPO: BY_MOD('t.ID_MODALIDADE'),
  GRUPO_TIME: BY_MOD('(SELECT g.ID_MODALIDADE FROM GRUPO g WHERE g.ID = t.ID_GRUPO)'),
  PARTIDA: BY_MOD('t.ID_MODALIDADE'),
  PARTIDA_PARTICIPANTE: BY_MATCH,
  SUMULA: BY_MATCH,
  SUMULA_PONTOS: BY_MATCH,
  SUMULA_SET: BY_MATCH,
  SUMULA_COLOCACAO: BY_MATCH,
  CARTAO: BY_MATCH,
  PREMIO: 't.ID_TORNEIO',
}
const OWNER_COL = 'DONO_TORNEIO__'

/** SELECT que devolve as colunas DATE como texto 'AAAA-MM-DD' (evita fuso horário). */
const selectWithDates = (table: string, where: string, dateCols: string[], extra = '') =>
  `SELECT t.*${extra}${dateCols.map((c) => `, TO_CHAR(t.${c}, 'YYYY-MM-DD') AS ${c}_TXT`).join('')} FROM ${table} t WHERE ${where}`
const fixDates = (r: Row, dateCols: string[]): Row => {
  const out = { ...r }
  for (const c of dateCols) {
    out[c] = out[`${c}_TXT`] ?? null
    delete out[`${c}_TXT`]
  }
  return out
}

/** Linhas de um SELECT (o driver só deixa `rows` vazio em comandos que não são consulta). */
const rowsOf = (r: oracledb.Result<Row>): Row[] => r.rows ?? []
const first = (r: oracledb.Result<Row>): Row | undefined => rowsOf(r)[0]

/** INSERT em lote com tipos explícitos (NULL na primeira linha não deixa o driver adivinhar). */
async function insertAll(conn: oracledb.Connection, table: string, rows: Row[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const values = cols.map((c) => (DATE_COLUMNS.has(c) ? `TO_DATE(:${c}, 'YYYY-MM-DD')` : `:${c}`))
  const bindDefs = Object.fromEntries(
    cols.map((c) => {
      const sample = rows.find((r) => r[c] !== null)?.[c]
      return [c, typeof sample === 'number' ? { type: oracledb.NUMBER } : { type: oracledb.STRING, maxSize: 1000 }]
    }),
  )
  await conn.executeMany(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')})`, rows, { bindDefs })
}

export class OracleRepo implements Repo {
  private constructor(private pool: oracledb.Pool) {}

  static async connect(cfg: { user: string; password: string; connectString: string }) {
    return new OracleRepo(await oracledb.createPool({ ...cfg, poolMin: 1, poolMax: 8 }))
  }

  private async with<T>(f: (c: oracledb.Connection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection()
    try {
      return await f(conn)
    } finally {
      await conn.close()
    }
  }

  async findUserByEmail(email: string) {
    return this.with(async (c) => {
      const r = await c.execute<Row>('SELECT * FROM USUARIO WHERE EMAIL = :email', { email: email.trim().toLowerCase() })
      const u = first(r)
      return u && toUser(u)
    })
  }
  async findUser(id: string) {
    return this.with(async (c) => {
      const r = await c.execute<Row>('SELECT * FROM USUARIO WHERE ID = :id', { id })
      const u = first(r)
      return u && toUser(u)
    })
  }
  async createUser(u: StoredUser) {
    await this.with(async (c) => {
      try {
        await c.execute(
          'INSERT INTO USUARIO (ID, NOME, EMAIL, SENHA_HASH, PAPEL, ID_ORGANIZACAO) VALUES (:id, :nome, :email, :hash, :papel, :org)',
          { id: u.id, nome: u.name, email: u.email.trim().toLowerCase(), hash: u.passwordHash, papel: u.role, org: u.orgId ?? null },
          { autoCommit: true },
        )
      } catch (e) {
        // ORA-00001: violação de UNIQUE (e-mail já cadastrado)
        if ((e as { errorNum?: number }).errorNum === 1) throw new DuplicateError('E-mail já cadastrado.')
        throw e
      }
    })
  }

  async listOrgs() {
    return this.with(async (c) => rowsOf(await c.execute<Row>('SELECT * FROM ORGANIZACAO ORDER BY NOME')).map(toOrg))
  }
  async getOrg(id: string) {
    return this.with(async (c) => {
      const r = await c.execute<Row>('SELECT * FROM ORGANIZACAO WHERE ID = :id', { id })
      const o = first(r)
      return o && toOrg(o)
    })
  }
  async saveOrg(o: Organization) {
    await this.with((c) =>
      c.execute(
        `MERGE INTO ORGANIZACAO d USING (SELECT :id ID, :nome NOME, :sigla SIGLA, :matiz MATIZ FROM DUAL) s ON (d.ID = s.ID)
         WHEN MATCHED THEN UPDATE SET d.NOME = s.NOME, d.SIGLA = s.SIGLA, d.MATIZ = s.MATIZ
         WHEN NOT MATCHED THEN INSERT (ID, NOME, SIGLA, MATIZ) VALUES (s.ID, s.NOME, s.SIGLA, s.MATIZ)`,
        { id: o.id, nome: o.name, sigla: o.short, matiz: o.hue },
        { autoCommit: true },
      ),
    )
  }

  async listTournaments() {
    return this.with((c) => this.loadTournaments(c, '1 = 1', {}))
  }

  async getTournament(id: string) {
    return this.with(async (c) => (await this.loadTournaments(c, 't.ID = :id', { id }))[0])
  }

  /**
   * Monta os torneios escolhidos com uma consulta por tabela, qualquer que seja a
   * quantidade de torneios (sem uma rodada de consultas para cada torneio).
   */
  private async loadTournaments(c: oracledb.Connection, where: string, binds: Record<string, string>) {
    const heads = rowsOf(await c.execute<Row>(`${selectWithDates('TORNEIO', where, ['DATA_INICIO', 'DATA_FIM'])} ORDER BY t.CRIADO_EM_MS DESC`, binds))
    if (!heads.length) return []
    const byId = new Map(heads.map((h) => [String(h.ID), { TORNEIO: fixDates(h, ['DATA_INICIO', 'DATA_FIM']) } as TournamentRows]))
    // as linhas filhas dos torneios escolhidos (o filtro do TORNEIO aplicado ao dono)
    const owners = `SELECT t.ID FROM TORNEIO t WHERE ${where}`
    for (const table of CHILD_TABLES) {
      const dates = table === 'PARTIDA' ? ['DATA_PARTIDA'] : []
      for (const rows of byId.values()) rows[table] = []
      const r = await c.execute<Row>(selectWithDates(table, `${OWNER[table]} IN (${owners})`, dates, `, ${OWNER[table]} AS ${OWNER_COL}`), binds)
      for (const x of rowsOf(r)) {
        const { [OWNER_COL]: owner, ...row } = fixDates(x, dates)
        byId.get(String(owner))![table].push(row)
      }
    }
    const favs = new Map<string, string[]>()
    for (const f of rowsOf(await c.execute<Row>(`SELECT ID_USUARIO, ID_TORNEIO FROM FAVORITO WHERE ID_TORNEIO IN (${owners})`, binds)))
      favs.set(String(f.ID_TORNEIO), [...(favs.get(String(f.ID_TORNEIO)) ?? []), String(f.ID_USUARIO)])
    return [...byId].map(([id, rows]) => rowsToTournament(rows, favs.get(id) ?? []))
  }

  /** Uma transação: atualiza TORNEIO, apaga as filhas (cascata) e reinsere tudo (RN12). */
  async saveTournament(t: Tournament) {
    const rows = tournamentToRows(t)
    await this.with(async (c) => {
      try {
        const exists = rowsOf(await c.execute<Row>('SELECT 1 AS X FROM TORNEIO WHERE ID = :id', { id: t.id })).length > 0
        if (exists) {
          const set = Object.keys(rows.TORNEIO).filter((k) => k !== 'ID').map((k) => `${k} = ${DATE_COLUMNS.has(k) ? `TO_DATE(:${k}, 'YYYY-MM-DD')` : `:${k}`}`)
          await c.execute(`UPDATE TORNEIO SET ${set.join(', ')} WHERE ID = :ID`, rows.TORNEIO)
          // MODALIDADE antes de TIMES: partidas e inscrições referenciam os times
          for (const table of ['MODALIDADE', 'TIMES', 'PREMIO', 'TORNEIO_LOCAL', 'TORNEIO_ARBITRO']) await c.execute(`DELETE FROM ${table} WHERE ID_TORNEIO = :id`, { id: t.id })
        } else {
          await insertAll(c, 'TORNEIO', [rows.TORNEIO])
        }
        for (const table of CHILD_TABLES) await insertAll(c, table, rows[table])
        // favoritos só entram na criação; depois, só via setFavorite
        if (!exists) await insertAll(c, 'FAVORITO', t.favoritedBy.map((u) => ({ ID_USUARIO: u, ID_TORNEIO: t.id })))
        await c.commit()
      } catch (e) {
        await c.rollback()
        throw e
      }
    })
  }

  async deleteTournament(id: string) {
    await this.with((c) => c.execute('DELETE FROM TORNEIO WHERE ID = :id', { id }, { autoCommit: true }))
  }

  async setFavorite(userId: string, tournamentId: string, on: boolean) {
    await this.with((c) =>
      on
        ? c.execute(
            // a origem vem do próprio TORNEIO: torneio inexistente não gera linha (é ignorado, sem erro de FK)
            `MERGE INTO FAVORITO d USING (SELECT :u ID_USUARIO, ID ID_TORNEIO FROM TORNEIO WHERE ID = :t) s ON (d.ID_USUARIO = s.ID_USUARIO AND d.ID_TORNEIO = s.ID_TORNEIO)
             WHEN NOT MATCHED THEN INSERT (ID_USUARIO, ID_TORNEIO) VALUES (s.ID_USUARIO, s.ID_TORNEIO)`,
            { u: userId, t: tournamentId },
            { autoCommit: true },
          )
        : c.execute('DELETE FROM FAVORITO WHERE ID_USUARIO = :u AND ID_TORNEIO = :t', { u: userId, t: tournamentId }, { autoCommit: true }),
    )
  }

  async grantAccess(userId: string, tournamentId: string) {
    await this.with((c) =>
      c.execute(
        `MERGE INTO ACESSO_TORNEIO d USING (SELECT :u ID_USUARIO, :t ID_TORNEIO FROM DUAL) s ON (d.ID_USUARIO = s.ID_USUARIO AND d.ID_TORNEIO = s.ID_TORNEIO)
         WHEN NOT MATCHED THEN INSERT (ID_USUARIO, ID_TORNEIO) VALUES (s.ID_USUARIO, s.ID_TORNEIO)`,
        { u: userId, t: tournamentId },
        { autoCommit: true },
      ),
    )
  }
  async accessList(userId: string) {
    return this.with(async (c) => rowsOf(await c.execute<Row>('SELECT ID_TORNEIO FROM ACESSO_TORNEIO WHERE ID_USUARIO = :u', { u: userId })).map((r) => String(r.ID_TORNEIO)))
  }

  async ping() {
    await this.with((c) => c.execute('SELECT 1 FROM DUAL'))
  }
  async close() {
    await this.pool.close(5)
  }
}

const toUser = (r: Row): StoredUser => ({
  id: String(r.ID),
  name: String(r.NOME),
  email: String(r.EMAIL),
  passwordHash: String(r.SENHA_HASH),
  role: r.PAPEL as StoredUser['role'],
  ...(r.ID_ORGANIZACAO === null ? {} : { orgId: String(r.ID_ORGANIZACAO) }),
})
const toOrg = (r: Row): Organization => ({ id: String(r.ID), name: String(r.NOME), short: String(r.SIGLA), hue: Number(r.MATIZ) })
