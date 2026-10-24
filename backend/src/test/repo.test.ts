import { describe, expect, it } from 'vitest'
import { applySumula, buildSeed, draw, ORGS, type Sumula, type Tournament } from '../domain'
import { DuplicateError, type StoredUser } from '../repo/types'
import { emptyRepo, ORACLE } from './helpers'

/*
 * Contrato do repositório: o mesmo comportamento na memória (npm test) e no
 * Oracle de verdade (npm run test:oracle, que roda no CI com um Oracle Free).
 */

const user = (id: string, email: string): StoredUser => ({ id, name: 'Fulano', email, role: 'organizador', orgId: 'o1', passwordHash: 'hash' })

async function seeded() {
  const repo = await emptyRepo()
  for (const o of ORGS) await repo.saveOrg(o)
  await repo.createUser(user('u1', 'org@x.com'))
  await repo.createUser({ ...user('u2', 'fan@x.com'), role: 'espectador', orgId: undefined })
  await repo.createUser(user('u3', 'outro@x.com'))
  return repo
}

describe(`repositório (${ORACLE ? 'Oracle' : 'memória'})`, () => {
  it('usuários: e-mail normalizado e único; organizações em ordem de nome', async () => {
    const repo = await seeded()
    await expect(repo.createUser(user('u9', ' ORG@x.com '))).rejects.toBeInstanceOf(DuplicateError)
    expect(await repo.findUserByEmail(' Org@X.com')).toMatchObject({ id: 'u1', role: 'organizador', orgId: 'o1' })
    const fan = await repo.findUser('u2')
    expect(fan).toEqual({ id: 'u2', name: 'Fulano', email: 'fan@x.com', role: 'espectador', passwordHash: 'hash' })
    expect(await repo.findUser('nada')).toBeUndefined()
    expect(await repo.findUserByEmail('nada@x.com')).toBeUndefined()

    await repo.saveOrg({ ...ORGS[0], name: 'Renomeada', hue: 10 })
    expect(await repo.getOrg(ORGS[0].id)).toEqual({ ...ORGS[0], name: 'Renomeada', hue: 10 })
    expect(await repo.getOrg('nada')).toBeUndefined()
    const names = (await repo.listOrgs()).map((o) => o.name)
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : 1)))
  })

  it('cada torneio da demonstração volta exatamente como foi gravado', async () => {
    const repo = await seeded()
    const seed = buildSeed()
    for (const t of seed) await repo.saveTournament(t)
    for (const t of seed) expect(await repo.getTournament(t.id), t.name).toEqual(t)
    const listed = await repo.listTournaments()
    expect(listed.map((t) => t.id)).toEqual([...seed].sort((a, b) => b.createdAt - a.createdAt).map((t) => t.id))
    expect(listed).toEqual(expect.arrayContaining(seed))
    expect(await repo.getTournament('nada')).toBeUndefined()
  })

  it('regravar substitui o torneio inteiro (sorteio, súmula, cadastros removidos)', async () => {
    const repo = await seeded()
    const original = buildSeed().find((t) => t.status === 'publicado')!
    await repo.saveTournament(original)
    // sorteia a primeira modalidade, registra a primeira partida jogável e tira os prêmios
    const drawn = draw(original, original.modalities[0].id)
    const mod = drawn.modalities[0]
    const first = mod.matches.find((m) => m.a && m.b && !m.bye)!
    const sumula: Sumula = mod.kind === 'set' ? { kind: 'set', sets: [[21, 15], [21, 18]], cards: [] } : { kind: 'pontos', a: 3, b: 1, cards: [] }
    const changed: Tournament = { ...drawn, name: 'Novo nome', modalities: [applySumula(mod, first.id, sumula), ...drawn.modalities.slice(1)], prizes: [] }
    await repo.saveTournament(changed)
    expect(await repo.getTournament(original.id)).toEqual(changed)
  })

  it('favoritos e acessos: idempotentes, separados da gravação e removidos com o torneio', async () => {
    const repo = await seeded()
    const t = { ...buildSeed()[0], favoritedBy: ['u1'] }
    await repo.saveTournament(t)
    await repo.setFavorite('u2', t.id, true)
    await repo.setFavorite('u2', t.id, true)
    // gravar com uma cópia antiga não apaga o favorito novo
    await repo.saveTournament({ ...t, name: 'Outro' })
    expect((await repo.getTournament(t.id))!.favoritedBy.sort()).toEqual(['u1', 'u2'])
    await repo.setFavorite('u1', t.id, false)
    expect((await repo.getTournament(t.id))!.favoritedBy).toEqual(['u2'])
    await repo.setFavorite('u2', 'nada', true) // torneio inexistente: ignorado

    await repo.grantAccess('u2', t.id)
    await repo.grantAccess('u2', t.id)
    expect(await repo.accessList('u2')).toEqual([t.id])
    expect(await repo.accessList('u3')).toEqual([])
    await repo.deleteTournament(t.id)
    expect(await repo.getTournament(t.id)).toBeUndefined()
    expect(await repo.accessList('u2')).toEqual([])
    await repo.ping()
  })

  it.runIf(ORACLE)('Oracle: outro erro do banco no cadastro não vira "e-mail duplicado"', async () => {
    const repo = await emptyRepo()
    // papel fora do CHECK da coluna PAPEL
    const err = await repo.createUser({ ...user('u1', 'a@x.com'), role: 'admin' as StoredUser['role'], orgId: undefined }).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(DuplicateError)
    expect(err).toMatchObject({ errorNum: 2290 }) // ORA-02290: CHECK violado
  })

  it.runIf(ORACLE)('Oracle: gravação que falha não deixa nada pela metade', async () => {
    const repo = await seeded()
    const t = buildSeed()[0]
    await repo.saveTournament(t)
    // nome maior que o VARCHAR2(120) da coluna: o banco recusa e a transação volta
    await expect(repo.saveTournament({ ...t, name: 'x'.repeat(200), teams: [] })).rejects.toThrow()
    expect(await repo.getTournament(t.id)).toEqual(t)
  })
})
