import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

/* Senhas: scrypt com sal aleatório; nunca guardamos a senha em texto (seção 13.1). */

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number }) => Promise<Buffer>
const N = 16384
const KEYLEN = 64

/** Formato guardado: scrypt$N$sal(base64)$hash(base64) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEYLEN, { N })
  return `scrypt$${N}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !n || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n) })
  // comparação em tempo constante (não revela quantos caracteres batem)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
