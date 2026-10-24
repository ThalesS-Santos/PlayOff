/*
 * Regras de negócio do PlayOff. São exatamente as mesmas que o frontend usa
 * (frontend/src/lib): o servidor não reimplementa chaveamento, agenda, súmulas
 * nem permissões; ele só as aplica antes de gravar.
 */
export * from '../../frontend/src/lib/engine'
export * from '../../frontend/src/lib/permissions'
export * from '../../frontend/src/lib/registry'
export * from '../../frontend/src/lib/tournament'
export type * from '../../frontend/src/lib/types'
export { buildSeed, DEMO_USERS, ORGS } from '../../frontend/src/lib/seed'
