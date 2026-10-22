import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ChevronRight, Clock, MapPin, Medal } from 'lucide-react'
import { ranking, standings, winnerOf } from '../lib/engine'
import type { Match, Modality, Team } from '../lib/types'
import { fmtDate, fmtTime, scoreOf } from '../lib/format'
import { rise, spring, stagger } from './motion'
import { Crest, LiveDot } from './ui'

/* ───────────── Classificação dos grupos ───────────── */

export function GroupTables({ mod, teams }: { mod: Modality; teams: Team[] }) {
  const byId = new Map(teams.map((t) => [t.id, t]))
  const league = mod.format === 'pontos_corridos'
  // liga: só o 1º é campeão; grupo único leva os dois primeiros à final
  const adv = league ? 1 : mod.groups.length === 1 ? 2 : (mod.advancePerGroup ?? 2)
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className={clsx('grid gap-4', !league && 'lg:grid-cols-2')}>
      {mod.groups.map((g) => {
        const rows = standings(g, mod.matches)
        return (
          <motion.div key={g.id} variants={rise} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display font-semibold">{g.name}</p>
              <p className="text-xs text-faint">
                {mod.matches.filter((m) => m.groupId === g.id && m.status === 'encerrada').length}/{mod.matches.filter((m) => m.groupId === g.id).length} jogos
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-faint">
                  <th className="py-2 pl-4 text-left font-medium">Equipe</th>
                  {['J', 'V', 'E', 'D', 'SG', 'Pts'].map((h) => (
                    <th key={h} className="w-9 py-2 text-center font-medium last:pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <motion.tr key={r.teamId} layout transition={spring} className="border-t border-line/50">
                    <td className="py-2.5 pl-4">
                      <span className="flex items-center gap-2.5">
                        <span className={clsx('w-4 text-xs font-bold', i < adv ? 'text-ok' : 'text-faint')}>{i + 1}</span>
                        <Crest team={byId.get(r.teamId)} size={24} />
                        <span className="truncate font-medium">{byId.get(r.teamId)?.name}</span>
                      </span>
                    </td>
                    {[r.j, r.v, r.e, r.d, r.pp - r.pc].map((v, k) => (
                      <td key={k} className="text-center text-muted tabular-nums">
                        {v}
                      </td>
                    ))}
                    <td className="pr-3 text-center font-display font-bold tabular-nums">{r.pts}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <p className="flex items-center gap-1.5 border-t border-line/50 px-4 py-2 text-[11px] text-faint">
              <span className="size-1.5 rounded-full bg-ok" /> {league ? 'O 1º colocado é o campeão' : `Top ${adv} avançam ao mata-mata`}
            </p>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/* ───────────── Linha de partida ───────────── */

export function MatchRow({ m, teams, mod, conflict, onClick }: { m: Match; teams: Team[]; mod?: Modality; conflict?: string; onClick?: () => void }) {
  const byId = new Map(teams.map((t) => [t.id, t]))
  const w = winnerOf(m)

  if (m.participants) {
    const rk = ranking(m)
    return (
      <motion.button layout variants={rise} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={onClick} className="w-full rounded-2xl border border-line bg-surface p-4 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-faint uppercase">
            {mod?.sport} · {m.phase}
          </span>
          <Meta m={m} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(rk.length ? rk.map((r) => r.teamId) : m.participants).map((id, i) => (
            <span key={id} className={clsx('flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs', rk.length && i === 0 ? 'bg-warn/15 text-warn' : 'bg-surface-2 text-muted')}>
              {rk.length > 0 && <b>{i + 1}º</b>}
              <Crest team={byId.get(id)} size={18} />
              {byId.get(id)?.name}
              {rk[i] && <span className="tabular-nums opacity-70">{fmtTime(rk[i].timeMs)}</span>}
            </span>
          ))}
        </div>
      </motion.button>
    )
  }

  return (
    <motion.button
      layout
      variants={rise}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={clsx('group w-full rounded-2xl border bg-surface p-3.5 text-left transition-colors sm:p-4', conflict ? 'border-warn/60 bg-warn/5' : m.status === 'ao_vivo' ? 'border-live/50' : 'border-line hover:border-faint')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold tracking-wider text-faint uppercase">
          {mod?.sport} · {m.phase}
        </span>
        <Meta m={m} />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
        {(['a', 'b'] as const).map((side, i) => {
          const tm = byId.get(m[side] ?? '')
          return (
            <span key={side} className={clsx('flex min-w-0 items-center gap-2.5', i === 1 && 'col-start-3 flex-row-reverse text-right', w && w !== m[side] && 'opacity-50')}>
              <Crest team={tm} size={34} />
              <span className="truncate text-sm font-semibold">{tm?.name ?? (side === 'a' ? m.placeholderA : m.placeholderB) ?? 'A definir'}</span>
            </span>
          )
        })}
        <span className="font-display col-start-2 row-start-1 min-w-16 text-center text-xl font-bold tabular-nums">
          {m.sumula ? (
            <>
              {scoreOf(m, 'a')} <span className="text-faint">–</span> {scoreOf(m, 'b')}
            </>
          ) : (
            <span className="text-base text-faint">vs</span>
          )}
        </span>
        <ChevronRight size={18} className="col-start-4 row-start-1 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
      <AnimatePresence>
        {conflict && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-1.5 overflow-hidden text-xs text-warn">
            <AlertTriangle size={13} className="mt-3 shrink-0" />
            <span className="mt-3">{conflict}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function Meta({ m }: { m: Match }) {
  if (m.status === 'ao_vivo')
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-live">
        <LiveDot /> AO VIVO
      </span>
    )
  if (m.status === 'encerrada')
    return (
      <span className="flex items-center gap-1 text-xs text-faint">
        <Medal size={12} /> Encerrada
      </span>
    )
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1">
        <Clock size={12} /> {m.time ?? '—'}
      </span>
      <span className="hidden items-center gap-1 sm:flex">
        <MapPin size={12} /> {m.venue ?? '—'}
      </span>
    </span>
  )
}

/* ───────────── Calendário agrupado por dia ───────────── */

export function Calendar({ items, teams, conflicts, onSelect }: { items: { m: Match; mod: Modality }[]; teams: Team[]; conflicts: Map<string, string>; onSelect: (m: Match, mod: Modality) => void }) {
  const days = new Map<string, { m: Match; mod: Modality }[]>()
  for (const it of [...items].sort((x, y) => `${x.m.date}${x.m.time}`.localeCompare(`${y.m.date}${y.m.time}`))) {
    const k = it.m.date ?? 'sem-data'
    days.set(k, [...(days.get(k) ?? []), it])
  }
  return (
    <div className="space-y-8">
      {[...days.entries()].map(([day, list]) => (
        <section key={day}>
          <div className="sticky top-16 z-10 -mx-1 mb-3 flex items-baseline gap-3 bg-bg/80 px-1 py-2 backdrop-blur">
            <h3 className="font-display text-lg font-semibold first-letter:uppercase">{day === 'sem-data' ? 'A agendar' : fmtDate(day, { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
            <span className="text-xs text-faint">{list.length} jogos</span>
          </div>
          <motion.div layout variants={stagger} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
            {list.map(({ m, mod }) => (
              <MatchRow key={m.id} m={m} mod={mod} teams={teams} conflict={conflicts.get(m.id)} onClick={() => onSelect(m, mod)} />
            ))}
          </motion.div>
        </section>
      ))}
    </div>
  )
}
