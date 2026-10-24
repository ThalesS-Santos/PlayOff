import { loadConfig } from '../config'
import { OracleRepo } from '../repo/oracle-repo'
import { DEMO_PASSWORD, seedRepo } from '../seed'

/* Carrega os dados de demonstração no Oracle (rode depois do db/001_schema.sql). */

const config = loadConfig({ ...process.env, PLAYOFF_REPO: 'oracle' })
const repo = await OracleRepo.connect(config.oracle)
try {
  await repo.ping()
  await seedRepo(repo)
  const total = (await repo.listTournaments()).length
  console.log(`Pronto: ${total} torneios de demonstração. Usuários com senha "${DEMO_PASSWORD}".`)
} finally {
  await repo.close()
}
