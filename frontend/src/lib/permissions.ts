import type { Tournament, User } from './types'

/* Regras de acesso (RN03/RN04): quem vê e quem administra cada torneio. */

/** Só o organizador dono do torneio administra (habilitarOpcoesDeGestao). */
export const canManage = (user: User | null | undefined, t: Tournament) =>
  !!user && user.role === 'organizador' && user.id === t.organizerId

/** Público: todos veem. Privado: o dono ou quem já informou o código. */
export const canView = (user: User | null | undefined, t: Tournament, unlocked: string[]) =>
  t.visibility === 'publico' || canManage(user, t) || unlocked.includes(t.id)

/** Criar torneio, painel e identidade visual são telas de organizador. */
export const isOrganizer = (user: User | null | undefined) => user?.role === 'organizador'

/** Tentativas de código antes de bloquear por um tempo (antiabuso, seção 13.1). */
export const MAX_CODE_ATTEMPTS = 5
export const CODE_LOCK_MS = 30_000

export type AccessResult = { ok: true } | { ok: false; reason: 'incorreto' | 'bloqueado'; retryInMs?: number }

/** Valida o código de um torneio privado, com bloqueio temporário após várias tentativas erradas. */
export function checkAccessCode(
  t: Tournament,
  code: string,
  attempts: { count: number; lockedUntil?: number },
  now = Date.now(),
): { result: AccessResult; attempts: { count: number; lockedUntil?: number } } {
  if (attempts.lockedUntil && now < attempts.lockedUntil)
    return { result: { ok: false, reason: 'bloqueado', retryInMs: attempts.lockedUntil - now }, attempts }
  if (t.accessCode && code.trim().toUpperCase() === t.accessCode.toUpperCase()) return { result: { ok: true }, attempts: { count: 0 } }
  const count = attempts.lockedUntil ? 1 : attempts.count + 1
  if (count >= MAX_CODE_ATTEMPTS) {
    const lockedUntil = now + CODE_LOCK_MS
    return { result: { ok: false, reason: 'bloqueado', retryInMs: CODE_LOCK_MS }, attempts: { count, lockedUntil } }
  }
  return { result: { ok: false, reason: 'incorreto' }, attempts: { count } }
}
