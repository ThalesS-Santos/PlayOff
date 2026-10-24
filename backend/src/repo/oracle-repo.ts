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

/** Como achar as linhas de cada tabela filha de um torneio (:id = id do torneio). */
const MODS = 'SELECT ID FROM MODALIDADE WHERE ID_TORNEIO = :id'
const MATCHES = `SELECT p.ID FROM PARTIDA p JOIN MODALIDADE m ON p.ID_MODALIDADE = m.ID WHERE m.ID_TORNEIO = :id`
const SCOPE: Record<ChildTable, string> = {
  TORNEIO_LOCAL: 'ID_TORNEIO = :id',
  TORNEIO_ARBITRO: 'ID_TORNEIO = :id',
  TIMES: 'ID_TORNEIO = :id',
  JOGADORES: 'ID_TIME IN (SELECT ID FROM TIMES WHERE ID_TORNEIO = :id)',
  MODALIDADE: 'ID_TORNEIO = :id',
  MODALIDADE_LOCAL: `ID_MODALIDADE IN (${MODS})`,
  PARTICIPACAO: `ID_MODALIDADE IN (${MODS})`,
  GRUPO: `ID_MODALIDADE IN (${MODS})`,
  GRUPO_TIME: `ID_GRUPO IN (SELECT g.ID FROM GRUPO g JOIN MODALIDADE m ON g.ID_MODALIDADE = m.ID WHERE m.ID_TORNEIO = :id)`,
  PARTIDA: `ID_MODALIDADE IN (${MODS})`,
  PARTIDA_PARTICIPANTE: `ID_PARTIDA IN (${MATCHES})`,
  SUMULA: `ID_PARTIDA IN (${MATCHES})`,
  SUMULA_PONTOS: `ID_PARTIDA IN (${MATCHES})`,
  SUMULA_SET: `ID_PARTIDA IN (${MATCHES})`,
  SUMULA_COLOCACAO: `ID_PARTIDA IN (${MATCHES})`,
  CARTAO: `ID_PARTIDA IN (${MATCHES})`,
  PREMIO: 'ID_TORNEIO = :id',
}

/** SELECT que devolve as colunas DATE como texto 'AAAA-MM-DD' (evita fuso horário). */
const selectWithDates = (table: string, where: string, dateCols: string[]) =>
  `SELECT t.*${dateCols.map((c) => `, TO_CHAR(t.${c}, 'YYYY-MM-DD') AS ${c}_TXT`).join('')} FROM ${table} t WHERE ${where}`
const fixDates = (r: Row, dateCols: string[]): Row => {
  const out = { ...r }
  for (const c of dateCols) {
    out[c] = out[`${c}_TXT`] ?? null
    delete out[`${c}_TXT`]
  }
  return out
}

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
      return r.rows?.[0] && toUser(r.rows[0])
    })
  }
  async findUser(id: string) {
    return this.with(async (c) => {
      const r = await c.execute<Row>('SELECT * FROM USUARIO WHERE ID = :id', { id })
      return r.rows?.[0] && toUser(r.rows[0])
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
    return this.with(async (c) => ((await c.execute<Row>('SELECT * FROM ORGANIZACAO ORDER BY NOME')).rows ?? []).map(toOrg))
  }
  async getOrg(id: string) {
    return this.with(async (c) => {
      const r = await c.execute<Row>('SELECT * FROM ORGANIZACAO WHERE ID = :id', { id })
      return r.rows?.[0] && toOrg(r.rows[0])
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
    const ids = await this.with(async (c) => ((await c.execute<Row>('SELECT ID FROM TORNEIO ORDER BY CRIADO_EM_MS DESC')).rows ?? []).map((r) => String(r.ID)))
    const all = await Promise.all(ids.map((id) => this.getTournament(id)))
    return all.filter((t): t is Tournament => !!t)
  }

  async getTournament(id: string) {
    return this.with(async (c) => {
      const head = (await c.execute<Row>(selectWithDates('TORNEIO', 't.ID = :id', ['DATA_INICIO', 'DATA_FIM']), { id })).rows?.[0]
      if (!head) return undefined
      const rows = { TORNEIO: fixDates(head, ['DATA_INICIO', 'DATA_FIM']) } as TournamentRows
      for (const table of CHILD_TABLES) {
        const dates = table === 'PARTIDA' ? ['DATA_PARTIDA'] : []
        const r = await c.execute<Row>(selectWithDates(table, SCOPE[table], dates), { id })
        rows[table] = (r.rows ?? []).map((x) => fixDates(x, dates))
      }
      const favs = (await c.execute<Row>('SELECT ID_USUARIO FROM FAVORITO WHERE ID_TORNEIO = :id', { id })).rows ?? []
      return rowsToTournament(rows, favs.map((f) => String(f.ID_USUARIO)))
    })
  }

  /** Uma transação: atualiza TORNEIO, apaga as filhas (cascata) e reinsere tudo (RN12). */
  async saveTournament(t: Tournament) {
    const rows = tournamentToRows(t)
    await this.with(async (c) => {
      try {
        const exists = ((await c.execute<Row>('SELECT 1 AS X FROM TORNEIO WHERE ID = :id', { id: t.id })).rows ?? []).length > 0
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
            `MERGE INTO FAVORITO d USING (SELECT :u ID_USUARIO, :t ID_TORNEIO FROM DUAL) s ON (d.ID_USUARIO = s.ID_USUARIO AND d.ID_TORNEIO = s.ID_TORNEIO)
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
    return this.with(async (c) => ((await c.execute<Row>('SELECT ID_TORNEIO FROM ACESSO_TORNEIO WHERE ID_USUARIO = :u', { u: userId })).rows ?? []).map((r) => String(r.ID_TORNEIO)))
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
