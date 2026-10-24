import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, vi } from 'vitest'

// animações instantâneas: os testes verificam comportamento, não transições
MotionGlobalConfig.skipAnimations = true

// APIs de navegador que o jsdom não implementa
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}
if (!window.matchMedia)
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
// o jsdom devolve, no TextEncoder, um Uint8Array de outro "realm" (falha em `instanceof Uint8Array`);
// a biblioteca de token do backend (usada nos testes do modo API) recusa esse objeto
const NodeTextEncoder = globalThis.TextEncoder
globalThis.TextEncoder = class extends NodeTextEncoder {
  encode(input?: string) {
    return new Uint8Array(super.encode(input))
  }
} as typeof TextEncoder

// eventos de ponteiro (efeitos de inclinação dos cartões); o jsdom só tem MouseEvent
window.PointerEvent ??= class PointerEvent extends MouseEvent {} as unknown as typeof PointerEvent
window.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
window.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver

/*
 * Contra falsos positivos: qualquer console.error/console.warn durante um teste
 * (avisos do React, chaves duplicadas, act(), props inválidas...) faz o teste falhar.
 */
/**
 * Relógio simulado só para os timers que o app usa (avisos, bloqueio do código, redirecionamento).
 * O requestAnimationFrame fica real: as animações de saída dependem dele para terminar.
 */
export const FAKE_TIMERS: Parameters<typeof vi.useFakeTimers>[0] = {
  shouldAdvanceTime: true,
  toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
}

let consoleCalls: string[] = []

/** Devolve e limpa os avisos capturados (para testes que provocam um aviso de propósito). */
export function takeConsoleCalls() {
  const calls = consoleCalls
  consoleCalls = []
  return calls
}

beforeEach(() => {
  consoleCalls = []
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation((...args) => void consoleCalls.push(`console.error: ${args.map(String).join(' ')}`))
  vi.spyOn(console, 'warn').mockImplementation((...args) => void consoleCalls.push(`console.warn: ${args.map(String).join(' ')}`))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  if (consoleCalls.length) throw new Error(`O teste emitiu avisos no console:\n${consoleCalls.join('\n')}`)
})
