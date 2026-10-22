import { describe, expect, it } from 'vitest'
import { takeConsoleCalls } from './setup'

/*
 * Prova de que a proteção do setup funciona: avisos no console são capturados
 * (e, se ninguém os consumir, o afterEach do setup reprova o teste).
 */
describe('proteção contra falso positivo', () => {
  it('captura console.error e console.warn', () => {
    console.error('erro simulado')
    console.warn('aviso simulado')
    expect(takeConsoleCalls()).toEqual(['console.error: erro simulado', 'console.warn: aviso simulado'])
  })
})
