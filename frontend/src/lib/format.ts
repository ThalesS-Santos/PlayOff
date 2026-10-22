import { setsWon } from './engine'
import type { Format, Match } from './types'

/* Formatação para exibição (datas, tempos de prova, placares, formatos). */

export const FORMAT_LABEL: Record<Format, string> = {
  eliminacao: 'Eliminação simples',
  dupla_eliminacao: 'Dupla eliminação',
  grupos_mata: 'Fase de grupos + mata-mata',
  pontos_corridos: 'Pontos corridos',
  prova: 'Prova (colocação)',
}

export function fmtDate(d?: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', opts).replace('.', '')
}

/** 28430 → "28.43"; 62100 → "1:02.10" */
export function fmtTime(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const c = Math.floor((ms % 1000) / 10)
  return `${m ? `${m}:` : ''}${String(s).padStart(m ? 2 : 1, '0')}.${String(c).padStart(2, '0')}`
}

/** "28.43", "28,4", "1:02.10" → milissegundos; null se inválido (segundos ≥ 60 com minutos). */
export function parseTime(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,2}))?$/)
  if (!m) return null
  if (m[1] != null && Number(m[2]) >= 60) return null
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '0').padEnd(2, '0')) * 10
}

/** Placar exibido de um lado: pontos, ou sets vencidos. */
export function scoreOf(m: Match, side: 'a' | 'b'): number | undefined {
  const s = m.sumula
  if (!s) return undefined
  if (s.kind === 'pontos') return side === 'a' ? s.a : s.b
  if (s.kind === 'set') return setsWon(s)[side === 'a' ? 0 : 1]
  return undefined
}
