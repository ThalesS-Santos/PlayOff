import { describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { ROUTES } from '../openapi'
import { MemoryRepo } from '../repo/memory-repo'
import { SECRET } from './helpers'

describe('documentação da API (/docs)', () => {
  it('toda rota da API está documentada, e só elas', async () => {
    const app = buildApp({ repo: new MemoryRepo(), jwtSecret: SECRET })
    const registered: string[] = []
    app.addHook('onRoute', (r) => {
      for (const m of [r.method].flat()) if (r.url.startsWith('/api/v1') && m !== 'HEAD') registered.push(`${m.toLowerCase()} ${r.url.slice('/api/v1'.length)}`)
    })
    await app.ready()
    expect(registered.sort()).toEqual(ROUTES.map((r) => `${r.method} ${r.path}`).sort())
  })

  it('serve o OpenAPI com os esquemas de validação e a página do Swagger', async () => {
    const app = buildApp({ repo: new MemoryRepo(), jwtSecret: SECRET })
    const spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json()
    expect(spec.openapi).toBe('3.0.3')
    const login = spec.paths['/api/v1/auth/login'].post
    expect(login.requestBody.content['application/json'].schema).toMatchObject({ type: 'object', required: ['email', 'password'] })
    const sumula = spec.paths['/api/v1/torneios/{id}/modalidades/{mid}/partidas/{pid}/sumula'].post
    expect(sumula.parameters.map((p: { name: string }) => p.name)).toEqual(['id', 'mid', 'pid'])
    expect(sumula.security).toEqual([{ token: [] }])
    expect(Object.keys(sumula.responses)).toEqual(expect.arrayContaining(['200', '400', '401', '403', '422']))
    expect(spec.paths['/api/v1/torneios'].get.security).toBeUndefined()

    const page = await app.inject({ method: 'GET', url: '/docs' })
    expect(page.statusCode).toBe(200)
    expect(page.body).toContain('swagger')
    // a página traz os próprios arquivos (nada de CDN), com a política de segurança do Swagger
    expect(page.headers['content-security-policy']).toContain("script-src 'self' ;")
    expect(page.headers['content-security-policy']).toContain("style-src 'self' https: 'unsafe-inline'")
  })
})
