import { describe, expect, it } from 'vitest'
import { DEMO_USERS } from './seed'
import { freshState, parseState, reducer, type State } from './state'
import type { User } from './types'

const org = DEMO_USERS[0]
const fan = DEMO_USERS[1]
const intruder: User = { id: 'u9', name: 'Outro organizador', role: 'organizador', orgId: 'o2' }
const as = (user: User | null): State => ({ ...freshState(), user })

describe('parseState', () => {
  it('sem nada salvo, JSON quebrado ou formato inválido: volta para a demonstração', () => {
    for (const raw of [null, '{quebrado', 'null', '[]', '{"tournaments":[]}', '{"tournaments":[],"orgs":[],"unlocked":[],"user":5}']) {
      const s = parseState(raw)
      expect(s.tournaments.length).toBeGreaterThan(0)
      expect(s.user).toBeNull()
    }
  })

  it('aceita um estado salvo válido', () => {
    const saved = { ...freshState(), user: org, unlocked: ['t3'] }
    expect(parseState(JSON.stringify(saved))).toEqual(saved)
  })
})

describe('reducer', () => {
  it('login, logout e desbloqueio', () => {
    let s = reducer(as(null), { type: 'login', user: fan })
    expect(s.user).toEqual(fan)
    s = reducer(s, { type: 'unlock', id: 't3' })
    expect(reducer(s, { type: 'unlock', id: 't3' }).unlocked).toEqual(['t3'])
    expect(reducer(s, { type: 'logout' }).user).toBeNull()
  })

  it('favoritar exige usuário e alterna', () => {
    const anon = as(null)
    expect(reducer(anon, { type: 'toggleFav', id: 't1' })).toBe(anon)
    const on = reducer(as(fan), { type: 'toggleFav', id: 't1' })
    expect(on.tournaments.find((t) => t.id === 't1')!.favoritedBy).toContain(fan.id)
    const off = reducer(on, { type: 'toggleFav', id: 't1' })
    expect(off.tournaments.find((t) => t.id === 't1')!.favoritedBy).not.toContain(fan.id)
  })

  describe('permissões (RN04)', () => {
    const t1 = () => freshState().tournaments.find((t) => t.id === 't1')!

    it('dono edita e exclui', () => {
      const s = reducer(as(org), { type: 'upsert', t: { ...t1(), name: 'Novo nome' } })
      expect(s.tournaments.find((t) => t.id === 't1')!.name).toBe('Novo nome')
      expect(reducer(s, { type: 'remove', id: 't1' }).tournaments.some((t) => t.id === 't1')).toBe(false)
    })

    it('espectador e outro organizador não editam nem excluem', () => {
      for (const user of [fan, intruder, null]) {
        const s = as(user)
        expect(reducer(s, { type: 'upsert', t: { ...t1(), name: 'Hack' } })).toBe(s)
        expect(reducer(s, { type: 'remove', id: 't1' })).toBe(s)
      }
    })

    it('ninguém "toma posse" de um torneio alheio trocando o dono', () => {
      const s = as(intruder)
      expect(reducer(s, { type: 'upsert', t: { ...t1(), organizerId: intruder.id } })).toBe(s)
    })

    it('organizador cria torneio próprio; não cria em nome de outro', () => {
      const novo = { ...t1(), id: 'novo', organizerId: org.id }
      expect(reducer(as(org), { type: 'upsert', t: novo }).tournaments[0].id).toBe('novo')
      const s = as(intruder)
      expect(reducer(s, { type: 'upsert', t: novo })).toBe(s)
      expect(reducer(as(fan), { type: 'upsert', t: { ...novo, organizerId: fan.id } }).tournaments.some((t) => t.id === 'novo')).toBe(false)
    })

    it('excluir torneio inexistente não muda nada', () => {
      const s = as(org)
      expect(reducer(s, { type: 'remove', id: 'nao-existe' })).toBe(s)
    })

    it('identidade visual: só da própria organização (RF06)', () => {
      const o1 = freshState().orgs.find((o) => o.id === 'o1')!
      const o2 = freshState().orgs.find((o) => o.id === 'o2')!
      expect(reducer(as(org), { type: 'org', org: { ...o1, hue: 10 } }).orgs.find((o) => o.id === 'o1')!.hue).toBe(10)
      for (const [user, target] of [[org, o2], [fan, o1], [null, o1]] as const) {
        const s = as(user)
        expect(reducer(s, { type: 'org', org: { ...target, hue: 10 } })).toBe(s)
      }
    })
  })

  it('reset restaura a demonstração mantendo o usuário', () => {
    const s = reducer(reducer(as(org), { type: 'remove', id: 't1' }), { type: 'reset' })
    expect(s.user).toEqual(org)
    expect(s.tournaments.some((t) => t.id === 't1')).toBe(true)
  })
})

describe('dados vindos do servidor', () => {
  it('organização: substitui a que já existe e acrescenta a nova', () => {
    const s = as(null)
    const [first] = s.orgs
    const renamed = reducer(s, { type: 'serverOrg', org: { ...first, name: 'Renomeada' } })
    expect(renamed.orgs).toHaveLength(s.orgs.length)
    expect(renamed.orgs.find((o) => o.id === first.id)!.name).toBe('Renomeada')
    const added = reducer(s, { type: 'serverOrg', org: { id: 'nova', name: 'Nova', short: 'NV', hue: 10 } })
    expect(added.orgs.map((o) => o.id)).toEqual([...s.orgs.map((o) => o.id), 'nova'])
  })
})
