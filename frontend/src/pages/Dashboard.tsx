import { motion } from 'motion/react'
import { AlertTriangle, CalendarClock, ChevronRight, Plus, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MatchRow } from '../components/Competition'
import { fmtDate } from '../lib/format'
import { rise, stagger } from '../components/motion'
import { AnimatedNumber, Button, Empty, Page, StatusBadge } from '../components/ui'
import { detectConflicts, progress } from '../lib/engine'
import { useStore } from '../lib/store'

function Ring({ value }: { value: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
      <circle cx="22" cy="22" r={r} className="fill-none stroke-surface-2" strokeWidth="4" />
      <motion.circle cx="22" cy="22" r={r} className="fill-none stroke-brand" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
  )
}

export default function Dashboard() {
  const { tournaments, user } = useStore()
  const nav = useNavigate()
  const mine = tournaments.filter((t) => t.organizerId === user?.id)
  const upcoming = mine
    .flatMap((t) => t.modalities.flatMap((mod) => mod.matches.filter((m) => !m.bye && m.status !== 'encerrada' && m.date && (m.a || m.participants)).map((m) => ({ t, mod, m }))))
    .sort((x, y) => `${x.m.date}${x.m.time}`.localeCompare(`${y.m.date}${y.m.time}`))
    .slice(0, 4)
  const conflicts = mine.reduce((n, t) => n + detectConflicts(t).length, 0)

  return (
    <Page className="pt-8">
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-ink">Painel do organizador</p>
            <h1 className="font-display text-3xl font-bold">Seus torneios</h1>
          </div>
          <Button icon={<Plus size={17} />} onClick={() => nav('/criar')}>
            Novo torneio
          </Button>
        </motion.div>

        <motion.div variants={stagger} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: 'Torneios', v: mine.length },
            { k: 'Em andamento', v: mine.filter((t) => t.status === 'andamento').length },
            { k: 'Equipes', v: mine.reduce((n, t) => n + t.teams.length, 0) },
            { k: 'Conflitos de agenda', v: conflicts, warn: conflicts > 0 },
          ].map((s) => (
            <motion.div key={s.k} variants={rise} className="rounded-2xl border border-line bg-surface p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                {s.warn && <AlertTriangle size={12} className="text-warn" />}
                {s.k}
              </p>
              <p className={`font-display mt-1 text-3xl font-bold ${s.warn ? 'text-warn' : ''}`}>
                <AnimatedNumber value={s.v} />
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
            <Trophy size={18} className="text-brand-ink" /> Gerenciar
          </h2>
          {mine.length ? (
            <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {mine.map((t) => {
                const c = detectConflicts(t).length
                return (
                  <motion.li key={t.id} variants={rise} layout>
                    <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.99 }} onClick={() => nav(`/torneios/${t.id}`)} className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-3 text-left hover:border-faint">
                      <span className="h-14 w-2 shrink-0 rounded-full" style={{ background: `linear-gradient(${t.cover[0]}, ${t.cover[1]})` }} />
                      <div className="relative grid place-items-center">
                        <Ring value={progress(t)} />
                        <span className="absolute text-[10px] font-bold tabular-nums">{Math.round(progress(t) * 100)}%</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{t.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <StatusBadge status={t.status} />
                          <span>
                            {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                          </span>
                          {c > 0 && <span className="rounded-full bg-warn/15 px-2 py-0.5 font-medium text-warn">{c} conflito(s)</span>}
                        </div>
                      </div>
                      <ChevronRight className="text-faint transition group-hover:translate-x-1 group-hover:text-ink" />
                    </motion.button>
                  </motion.li>
                )
              })}
            </motion.ul>
          ) : (
            <Empty icon={<Trophy />} title="Você ainda não criou torneios" action={<Button onClick={() => nav('/criar')}>Criar o primeiro</Button>} />
          )}
        </section>

        <section>
          <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
            <CalendarClock size={18} className="text-brand-ink" /> Próximos jogos
          </h2>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {upcoming.map(({ t, mod, m }) => (
              <div key={m.id}>
                <p className="mb-1 px-1 text-xs text-faint">
                  {fmtDate(m.date, { weekday: 'short', day: '2-digit', month: 'short' })} · {t.name}
                </p>
                <MatchRow m={m} mod={mod} teams={t.teams} onClick={() => nav(`/torneios/${t.id}`)} />
              </div>
            ))}
            {!upcoming.length && <p className="text-sm text-muted">Nenhum jogo agendado.</p>}
          </motion.div>
        </section>
      </div>
    </Page>
  )
}
