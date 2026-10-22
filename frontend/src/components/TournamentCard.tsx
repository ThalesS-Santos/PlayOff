import clsx from 'clsx'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { CalendarDays, Heart, Lock, MapPin, Users } from 'lucide-react'
import { progress } from '../lib/engine'
import { useStore } from '../lib/store'
import type { Tournament } from '../lib/types'
import { fmtDate } from '../lib/format'
import { rise } from './motion'
import { StatusBadge } from './ui'

export function FavButton({ t, className }: { t: Tournament; className?: string }) {
  const { user, dispatch, toast } = useStore()
  const on = !!user && t.favoritedBy.includes(user.id)
  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation()
        dispatch({ type: 'toggleFav', id: t.id })
        toast({ title: on ? 'Removido dos favoritos' : 'Adicionado aos favoritos', body: t.name, tone: on ? 'info' : 'ok' })
      }}
      aria-pressed={on}
      aria-label={on ? 'Remover dos favoritos' : 'Favoritar torneio'}
      className={clsx('relative grid size-9 place-items-center rounded-xl bg-black/30 text-white backdrop-blur transition hover:bg-black/45', className)}
    >
      <motion.span key={String(on)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
        <Heart size={17} className={on ? 'fill-rose-500 text-rose-500' : ''} />
      </motion.span>
      <AnimatePresence>
        {on &&
          Array.from({ length: 8 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute size-1.5 rounded-full bg-rose-400"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos((i / 8) * Math.PI * 2) * 22, y: Math.sin((i / 8) * Math.PI * 2) * 22, opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ))}
      </AnimatePresence>
    </motion.button>
  )
}

export function TournamentCard({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  const { orgOf, canManage, unlocked } = useStore()
  const org = orgOf(t)
  const locked = t.visibility === 'privado' && !canManage(t) && !unlocked.includes(t.id)
  const pct = progress(t)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 })
  const shine = useTransform([mx, my] as const, ([x, y]: number[]) => `radial-gradient(400px circle at ${x * 100}% ${y * 100}%, rgb(255 255 255 / .10), transparent 45%)`)

  return (
    <motion.article
      layout
      variants={rise}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width)
        my.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => (mx.set(0.5), my.set(0.5))}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="link"
      className="group relative cursor-pointer overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_20px_50px_-30px_black] outline-none"
    >
      <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.cover[0]}, ${t.cover[1]})` }}>
        <div className="grid-dots absolute inset-0 opacity-60" />
        <motion.div
          className="absolute -inset-y-6 -left-1/2 w-1/3 rotate-12 bg-white/20 blur-xl"
          initial={{ x: '-100%' }}
          whileHover={{ x: '500%' }}
          animate={{ x: '-100%' }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
        />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between">
          <span className="rounded-lg bg-black/30 px-2 py-1 text-xs font-semibold text-white backdrop-blur">{org.name}</span>
          <FavButton t={t} />
        </div>
        {locked && (
          <span className="absolute bottom-3 left-4 flex items-center gap-1.5 rounded-lg bg-black/40 px-2 py-1 text-xs font-medium text-white backdrop-blur">
            <Lock size={12} /> Privado
          </span>
        )}
      </div>
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: shine }} />

      <div className="relative p-5">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={t.status} />
          <span className="flex items-center gap-1 text-xs text-muted">
            <Users size={13} /> {t.teams.length} equipes
          </span>
        </div>
        <h3 className="font-display mt-3 text-lg leading-snug font-semibold">{t.name}</h3>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} />
            {t.city}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {t.modalities.map((m) => (
            <span key={m.id} className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted">
              {m.sport} {m.category !== 'Misto' ? m.category : ''}
            </span>
          ))}
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-faint">
            <span>Progresso</span>
            <span className="tabular-nums">{Math.round(pct * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
          </div>
        </div>
      </div>
    </motion.article>
  )
}
