import { describe, expect, it } from 'vitest'
import { canManage, canView, checkAccessCode, CODE_LOCK_MS, isOrganizer, MAX_CODE_ATTEMPTS } from './permissions'
import type { Tournament, User } from './types'

const org: User = { id: 'u1', name: 'Org', role: 'organizador', orgId: 'o1' }
const otherOrg: User = { id: 'u9', name: 'Outro', role: 'organizador', orgId: 'o2' }
const fan: User = { id: 'u2', name: 'Fã', role: 'espectador' }
const t = (p: Partial<Tournament> = {}) => ({ id: 't', organizerId: 'u1', visibility: 'publico', accessCode: undefined, ...p }) as Tournament

describe('canManage (RN04)', () => {
  it('só o organizador dono administra', () => {
    expect(canManage(org, t())).toBe(true)
    expect(canManage(otherOrg, t())).toBe(false)
    expect(canManage(fan, t())).toBe(false)
    expect(canManage(null, t())).toBe(false)
    // espectador com o mesmo id do dono não ganha gestão
    expect(canManage({ ...fan, id: 'u1' }, t())).toBe(false)
  })
})

describe('canView (RN03)', () => {
  it('público: todos veem', () => {
    expect(canView(fan, t(), [])).toBe(true)
    expect(canView(null, t(), [])).toBe(true)
  })
  it('privado: dono ou quem desbloqueou com código', () => {
    const p = t({ visibility: 'privado', accessCode: 'ABCD' })
    expect(canView(fan, p, [])).toBe(false)
    expect(canView(otherOrg, p, [])).toBe(false)
    expect(canView(org, p, [])).toBe(true)
    expect(canView(fan, p, ['t'])).toBe(true)
  })
})

describe('isOrganizer', () => {
  it('reconhece o papel', () => {
    expect(isOrganizer(org)).toBe(true)
    expect(isOrganizer(fan)).toBe(false)
    expect(isOrganizer(null)).toBe(false)
  })
})

describe('checkAccessCode', () => {
  const p = t({ visibility: 'privado', accessCode: 'PLAY2026' })

  it('aceita o código sem diferenciar maiúsculas e espaços nas pontas', () => {
    expect(checkAccessCode(p, '  play2026 ', { count: 3 })).toEqual({ result: { ok: true }, attempts: { count: 0 } })
  })

  it('conta tentativas erradas e bloqueia na 5ª', () => {
    let attempts: { count: number; lockedUntil?: number } = { count: 0 }
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i++) {
      const r = checkAccessCode(p, 'errado', attempts, 1000)
      expect(r.result).toEqual({ ok: false, reason: 'incorreto' })
      attempts = r.attempts
    }
    const r = checkAccessCode(p, 'errado', attempts, 1000)
    expect(r.result).toEqual({ ok: false, reason: 'bloqueado', retryInMs: CODE_LOCK_MS })
    expect(r.attempts.lockedUntil).toBe(1000 + CODE_LOCK_MS)
  })

  it('durante o bloqueio nem o código certo entra; depois volta a valer', () => {
    const locked = { count: 5, lockedUntil: 5000 }
    expect(checkAccessCode(p, 'PLAY2026', locked, 4000).result).toEqual({ ok: false, reason: 'bloqueado', retryInMs: 1000 })
    expect(checkAccessCode(p, 'PLAY2026', locked, 5000).result).toEqual({ ok: true })
    // primeira tentativa errada depois do bloqueio recomeça a contagem
    expect(checkAccessCode(p, 'x', locked, 6000).attempts).toEqual({ count: 1 })
  })

  it('torneio sem código nunca libera', () => {
    expect(checkAccessCode(t({ visibility: 'privado' }), '', { count: 0 }).result.ok).toBe(false)
  })
})
