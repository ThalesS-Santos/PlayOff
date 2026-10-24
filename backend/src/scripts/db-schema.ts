import { readFileSync } from 'node:fs'
import oracledb from 'oracledb'
import { loadConfig } from '../config'
import { splitSqlScript } from '../repo/sql-script'

/* Recria as tabelas do PlayOff: roda db/000_drop.sql e db/001_schema.sql (apaga os dados!). */

const config = loadConfig({ ...process.env, PLAYOFF_REPO: 'oracle' })
const conn = await oracledb.getConnection(config.oracle)
try {
  for (const file of ['000_drop.sql', '001_schema.sql']) {
    const commands = splitSqlScript(readFileSync(new URL(`../../db/${file}`, import.meta.url), 'utf8'))
    for (const sql of commands) await conn.execute(sql)
    console.log(`${file}: ${commands.length} comandos executados.`)
  }
} finally {
  await conn.close()
}
