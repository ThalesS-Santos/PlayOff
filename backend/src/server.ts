import { buildApp } from './app'
import { loadConfig } from './config'
import { MemoryRepo } from './repo/memory-repo'
import type { Repo } from './repo/types'
import { seedRepo } from './seed'

/* Sobe a API. Em memória, já vem com os dados de demonstração. */

const config = loadConfig()
let repo: Repo
if (config.repo === 'oracle') {
  const { OracleRepo } = await import('./repo/oracle-repo')
  repo = await OracleRepo.connect(config.oracle)
} else {
  repo = new MemoryRepo()
  await seedRepo(repo)
}

const app = buildApp({ repo, jwtSecret: config.jwtSecret, corsOrigin: config.corsOrigin, trustProxy: config.trustProxy, logger: true })
const close = async () => {
  await app.close()
  await repo.close()
  process.exit(0)
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
await app.listen({ port: config.port, host: config.host })
