import { describe, expect, it } from 'vitest'
import { fmtDate, fmtTime, parseTime, scoreOf } from './format'
import type { Match } from './types'

describe('fmtDate', () => {
  it('formata em pt-BR e trata ausência', () => {
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('2026-10-22', { day: '2-digit', month: '2-digit' })).toBe('22/10')
  })
})

describe('tempos de prova', () => {
  it.each([
    ['28.43', 28430],
    ['28,4', 28400],
    ['9', 9000],
    ['1:02.10', 62100],
    ['  1:02,1 ', 62100],
  ])('%s → %i ms', (txt, ms) => expect(parseTime(txt)).toBe(ms))

  it.each(['', 'abc', '1:75.00', '28.432', '-3'])('rejeita "%s"', (txt) => expect(parseTime(txt)).toBeNull())

  it('formata de volta', () => {
    expect(fmtTime(28430)).toBe('28.43')
    expect(fmtTime(62100)).toBe('1:02.10')
    expect(fmtTime(parseTime('1:02.10')!)).toBe('1:02.10')
  })
})

describe('scoreOf', () => {
  const m = (sumula?: Match['sumula']): Match => ({ id: 'x', phase: 'F', round: 1, slot: 0, status: 'encerrada', sumula })
  it('pontos, sets vencidos, colocação e sem súmula', () => {
    expect(scoreOf(m({ kind: 'pontos', a: 3, b: 1, cards: [] }), 'a')).toBe(3)
    expect(scoreOf(m({ kind: 'pontos', a: 3, b: 1, cards: [] }), 'b')).toBe(1)
    expect(scoreOf(m({ kind: 'set', sets: [[25, 20], [20, 25], [15, 9]], cards: [] }), 'a')).toBe(2)
    expect(scoreOf(m({ kind: 'set', sets: [[25, 20], [20, 25], [15, 9]], cards: [] }), 'b')).toBe(1)
    expect(scoreOf(m({ kind: 'colocacao', entries: [] }), 'a')).toBeUndefined()
    expect(scoreOf(m(), 'a')).toBeUndefined()
  })
})
