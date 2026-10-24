import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../auth/password'
import { signToken, verifyToken } from '../auth/token'
import { loadConfig } from '../config'
import { makeApp, SECRET } from './helpers'

describe('senha', () => {
  it('gera hash com sal (dois hashes diferentes) e confere', async () => {
    const a = await hashPassword('minha-senha')
    const b = await hashPassword('minha-senha')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^scrypt\$16384\$/)
    expect(await verifyPassword('minha-senha', a)).toBe(true)
    expect(await verifyPassword('outra', a)).toBe(false)
  })
  it('recusa formato desconhecido', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })
})

describe('token', () => {
  it('assina e valida; recusa outro segredo, outro emissor e expirado', async () => {
    const t = await signToken('u1', SECRET)
    expect(await verifyToken(t, SECRET)).toBe('u1')
    expect(await verifyToken(t, 'outro')).toBeUndefined()
    expect(await verifyToken('lixo', SECRET)).toBeUndefined()
    const key = new TextEncoder().encode(SECRET)
    const foreign = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setIssuer('outro').setExpirationTime('1h').sign(key)
    expect(await verifyToken(foreign, SECRET)).toBeUndefined()
    const expired = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setIssuer('playoff').setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(key)
    expect(await verifyToken(expired, SECRET)).toBeUndefined()
  })
})

describe('configuração', () => {
  it('padrões de desenvolvimento', () => {
    const c = loadConfig({})
    expect(c).toMatchObject({ port: 3333, host: '127.0.0.1', repo: 'memory', corsOrigin: 'http://localhost:5173' })
    expect(c.jwtSecret).toHaveLength(64)
  })
  it('produção exige segredo; Oracle exige credenciais', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/)
    expect(() => loadConfig({ PLAYOFF_REPO: 'oracle' })).toThrow(/ORACLE_USER/)
    const c = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 's', PLAYOFF_REPO: 'oracle', ORACLE_USER: 'u', ORACLE_PASSWORD: 'p', ORACLE_CONNECT_STRING: 'h/x', PORT: '8080', HOST: '0.0.0.0', CORS_ORIGIN: 'https://app' })
    expect(c).toMatchObject({ port: 8080, host: '0.0.0.0', jwtSecret: 's', repo: 'oracle', corsOrigin: 'https://app', oracle: { user: 'u', password: 'p', connectString: 'h/x' } })
  })
})

describe('cadastro e login (RF07)', () => {
  it('organizador se cadastra com a própria organização e já recebe sessão', async () => {
    const { call, repo } = await makeApp()
    const r = await call('POST', '/auth/registro', undefined, { name: 'Ana Lima', email: 'Ana@Exemplo.com', password: '12345678', role: 'organizador', orgName: 'Liga Ana!' })
    expect(r.statusCode).toBe(201)
    const { token, user } = r.json()
    expect(user).toMatchObject({ name: 'Ana Lima', role: 'organizador' })
    expect(await repo.getOrg(user.orgId)).toMatchObject({ name: 'Liga Ana!', short: 'LI' })
    // o e-mail é guardado em minúsculas; a senha nunca volta na resposta
    expect(JSON.stringify(r.json())).not.toMatch(/12345678|scrypt/)
    const me = await call('GET', '/me', token)
    expect(me.json()).toEqual({ user, unlocked: [] })
  })

  it('espectador se cadastra sem organização; e-mail repetido é recusado', async () => {
    const { call } = await makeApp()
    const ok = await call('POST', '/auth/registro', undefined, { name: 'Rui', email: 'rui@x.com', password: '12345678', role: 'espectador' })
    expect(ok.json().user.orgId).toBeUndefined()
    const dup = await call('POST', '/auth/registro', undefined, { name: 'Rui 2', email: 'RUI@x.com', password: '12345678', role: 'espectador' })
    expect(dup.statusCode).toBe(409)
  })

  it('valida os dados do cadastro', async () => {
    const { call } = await makeApp()
    const curta = await call('POST', '/auth/registro', undefined, { name: 'Rui', email: 'r@x.com', password: '123', role: 'espectador' })
    expect(curta.statusCode).toBe(400)
    expect(curta.json()).toMatchObject({ code: 'validacao', message: 'A senha precisa de ao menos 8 caracteres.' })
    const semOrg = await call('POST', '/auth/registro', undefined, { name: 'Rui', email: 'r@x.com', password: '12345678', role: 'organizador', orgName: '  ' })
    expect(semOrg.statusCode).toBe(400)
    const emailRuim = await call('POST', '/auth/registro', undefined, { name: 'Rui', email: 'nao-e-email', password: '12345678', role: 'espectador' })
    expect(emailRuim.json().message).toBe('E-mail inválido.')
  })

  it('login: mesma resposta para e-mail inexistente e senha errada', async () => {
    const { call } = await makeApp()
    const errada = await call('POST', '/auth/login', undefined, { email: 'organizador@playoff.dev', password: 'errada' })
    const inexistente = await call('POST', '/auth/login', undefined, { email: 'ninguem@playoff.dev', password: 'errada' })
    expect(errada.statusCode).toBe(401)
    expect(inexistente.statusCode).toBe(401)
    expect(errada.json()).toEqual(inexistente.json())
  })

  it('/me exige login; token inválido ou de usuário inexistente é 401', async () => {
    const { call } = await makeApp()
    expect((await call('GET', '/me')).statusCode).toBe(401)
    const r = await call('GET', '/me', 'token-falso')
    expect(r.statusCode).toBe(401)
    expect(r.json().code).toBe('token_invalido')
    expect((await call('GET', '/me', await signToken('apagado', SECRET))).statusCode).toBe(401)
    // até rotas públicas recusam um token inválido (em vez de ignorá-lo em silêncio)
    expect((await call('GET', '/torneios', 'token-falso')).statusCode).toBe(401)
  })
})

describe('identidade visual (RF06)', () => {
  it('só organizador da própria organização altera', async () => {
    const { call, tokens } = await makeApp()
    expect((await call('GET', '/organizacoes')).json()).toHaveLength(2)
    const body = { name: 'Liga Nova', short: 'ln', hue: 30 }
    expect((await call('PUT', '/organizacoes/o1', tokens.org, body)).json()).toMatchObject({ name: 'Liga Nova', short: 'LN', hue: 30 })
    expect((await call('PUT', '/organizacoes/o2', tokens.org, body)).statusCode).toBe(403)
    expect((await call('PUT', '/organizacoes/o1', tokens.fan, body)).statusCode).toBe(403)
    expect((await call('PUT', '/organizacoes/o1', undefined, body)).statusCode).toBe(401)
    expect((await call('PUT', '/organizacoes/nada', tokens.org, body)).statusCode).toBe(404)
    expect((await call('PUT', '/organizacoes/o1', tokens.org, { ...body, hue: 999 })).statusCode).toBe(400)
  })
})
