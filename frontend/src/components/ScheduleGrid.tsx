import clsx from 'clsx'
import { useState } from 'react'
import { SLOTS, tournamentDays } from '../lib/engine'
import { fmtDate, scoreOf } from '../lib/format'
import type { Match, Modality, Team, Tournament } from '../lib/types'
import { LiveDot } from './ui'

type Item = { m: Match; mod: Modality }

/** Calendário em grade (RF05): horários × locais de um dia, ou horários × dias de um local. */
export function ScheduleGrid({ t, items, conflicts, onSelect }: { t: Tournament; items: Item[]; conflicts: Map<string, string>; onSelect: (m: Match, mod: Modality) => void }) {
  const scheduled = items.filter(({ m }) => m.date && m.time)
  const days = tournamentDays(t)
  const daysWithGames = days.filter((d) => scheduled.some(({ m }) => m.date === d))
  const venues = [...new Set([...t.venues, ...scheduled.map(({ m }) => m.venue!).filter(Boolean)])]
  const today = new Date().toISOString().slice(0, 10)
  const [mode, setMode] = useState<'dia' | 'local'>('dia')
  const [day, setDay] = useState(daysWithGames.find((d) => d >= today) ?? daysWithGames[0] ?? days[0])
  const [venue, setVenue] = useState(venues[0])
  const byId = new Map(t.teams.map((x) => [x.id, x]))

  const columns = mode === 'dia' ? venues.map((v) => ({ key: v, label: v })) : daysWithGames.map((d) => ({ key: d, label: fmtDate(d, { weekday: 'short', day: '2-digit', month: '2-digit' }) }))
  const cell = (time: string, col: string) =>
    scheduled.filter(({ m }) => m.time === time && (mode === 'dia' ? m.date === day && m.venue === col : m.venue === venue && m.date === col))
  const unscheduled = items.length - scheduled.length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['dia', 'local'] as const).map((k) => (
          <button key={k} onClick={() => setMode(k)} className={clsx('h-9 rounded-full px-4 text-sm font-medium', mode === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-ink')}>
            {k === 'dia' ? 'Por dia' : 'Por local'}
          </button>
        ))}
        {mode === 'dia' ? (
          <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Dia" className="h-9 rounded-xl border border-line bg-bg/60 px-3 text-sm">
            {days.map((d) => (
              <option key={d} value={d}>
                {fmtDate(d, { weekday: 'short', day: '2-digit', month: 'short' })} · {scheduled.filter(({ m }) => m.date === d).length} jogos
              </option>
            ))}
          </select>
        ) : (
          <select value={venue} onChange={(e) => setVenue(e.target.value)} aria-label="Local" className="h-9 rounded-xl border border-line bg-bg/60 px-3 text-sm">
            {venues.map((v) => (
              <option key={v} value={v}>
                {v} · {scheduled.filter(({ m }) => m.venue === v).length} jogos
              </option>
            ))}
          </select>
        )}
        {unscheduled > 0 && <span className="text-xs text-warn">{unscheduled} partida(s) sem horário</span>}
      </div>

      {!columns.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">Nenhuma partida agendada.</p>
      ) : (
        <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-max border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-16 text-left text-xs font-medium text-faint">Hora</th>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className="min-w-40 rounded-lg bg-surface-2/60 px-2 py-1.5 text-left text-xs font-semibold first-letter:uppercase">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((time) => (
                <tr key={time}>
                  <th scope="row" className="align-top pt-2 text-left text-xs font-medium text-muted tabular-nums">
                    {time}
                  </th>
                  {columns.map((c) => {
                    const here = cell(time, c.key)
                    const clash = here.length > 1 || here.some(({ m }) => conflicts.has(m.id))
                    return (
                      <td key={c.key} className={clsx('h-14 rounded-lg align-top', here.length ? '' : 'border border-dashed border-line/50', clash && 'bg-warn/10 ring-1 ring-warn/50')}>
                        {here.map(({ m, mod }) => (
                          <button
                            key={m.id}
                            onClick={() => onSelect(m, mod)}
                            title={conflicts.get(m.id)}
                            className={clsx(
                              'mb-1 block w-full rounded-lg border bg-surface px-2 py-1.5 text-left text-xs hover:border-faint',
                              m.status === 'ao_vivo' ? 'border-live/50' : m.status === 'encerrada' ? 'border-line opacity-60' : 'border-line',
                            )}
                          >
                            <span className="flex items-center gap-1 font-semibold text-faint uppercase">
                              {m.status === 'ao_vivo' && <LiveDot />}
                              {mod.sport} · {m.phase}
                            </span>
                            <span className="mt-0.5 block truncate font-medium">{label(m, byId)}</span>
                            {mode === 'local' || !m.referee ? null : <span className="block truncate text-faint">{m.referee}</span>}
                          </button>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function label(m: Match, byId: Map<string, Team>) {
  if (m.participants) return `${m.participants.length} participantes`
  const side = (s: 'a' | 'b') => byId.get(m[s] ?? '')?.short ?? (s === 'a' ? m.placeholderA : m.placeholderB) ?? '?'
  const score = m.sumula ? ` ${scoreOf(m, 'a') ?? ''}–${scoreOf(m, 'b') ?? ''} ` : ' x '
  return `${side('a')}${score}${side('b')}`
}
