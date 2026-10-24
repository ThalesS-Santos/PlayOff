import { jwtVerify, SignJWT } from 'jose'

/* Sessão: JWT assinado (HS256) com o id do usuário; expira em 8 horas. */

const ISSUER = 'playoff'
export const TOKEN_TTL = '8h'

export async function signToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuer(ISSUER).setIssuedAt().setExpirationTime(TOKEN_TTL).sign(new TextEncoder().encode(secret))
}

/** Id do usuário do token, ou undefined se inválido, expirado ou de outro emissor. */
export async function verifyToken(token: string, secret: string): Promise<string | undefined> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: ISSUER, algorithms: ['HS256'] })
    return payload.sub
  } catch {
    return undefined
  }
}
