import clsx from 'clsx'
import { AnimatePresence, motion, useSpring, useTransform, type HTMLMotionProps } from 'motion/react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { STATUS_LABEL, useStore } from '../lib/store'
import { softSpring, spring } from './motion'
import type { Team, TournamentStatus } from '../lib/types'


/* ───────────── Botão ───────────── */

type BtnProps = HTMLMotionProps<'button'> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', icon, className, children, ...rest }: BtnProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variant === 'primary' && 'bg-brand text-white shadow-[0_8px_30px_-8px] shadow-brand/60 hover:brightness-110',
        variant === 'soft' && 'bg-brand-soft text-brand-ink hover:bg-brand/25',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-live/15 text-live hover:bg-live/25',
        className,
      )}
      {...rest}
    >
      {icon}
      {children as ReactNode}
    </motion.button>
  )
}

/* ───────────── Badges ───────────── */

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

export function LiveDot() {
  return (
    <span className="relative flex size-2">
      <motion.span
        className="absolute inline-flex size-full rounded-full bg-live"
        animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  )
}

const statusTone: Record<TournamentStatus, string> = {
  criacao: 'bg-surface-2 text-muted',
  publicado: 'bg-ok/15 text-ok',
  chaveamento: 'bg-brand-soft text-brand-ink',
  andamento: 'bg-live/15 text-live',
  finalizado: 'bg-surface-2 text-muted',
  cancelado: 'bg-warn/15 text-warn',
}

export function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <Badge className={statusTone[status]}>
      {status === 'andamento' && <LiveDot />}
      {STATUS_LABEL[status]}
    </Badge>
  )
}

/* ───────────── Escudo do time ───────────── */

export function Crest({ team, size = 32, className }: { team?: Team; size?: number; className?: string }) {
  if (!team)
    return (
      <span
        className={clsx('inline-grid shrink-0 place-items-center rounded-lg border border-dashed border-line text-faint', className)}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        ?
      </span>
    )
  return (
    <span
      className={clsx('inline-grid shrink-0 place-items-center rounded-lg font-display font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, ${team.color}, color-mix(in oklab, ${team.color} 55%, black))`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / .25), 0 6px 16px -8px ${team.color}`,
      }}
    >
      {team.short}
    </span>
  )
}

/* ───────────── Número animado ───────────── */

export function AnimatedNumber({ value, className, format = (n: number) => Math.round(n).toString() }: { value: number; className?: string; format?: (n: number) => string }) {
  const s = useSpring(0, { stiffness: 90, damping: 20 })
  const text = useTransform(s, format)
  useEffect(() => {
    s.set(value)
  }, [s, value])
  return <motion.span className={clsx('tabular-nums', className)}>{text}</motion.span>
}

/* ───────────── Modal ───────────── */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // portal: ancestrais animados com transform quebrariam o position: fixed
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={softSpring}
            className={clsx(
              'relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-2xl scrollbar-thin sm:rounded-3xl sm:p-6',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ───────────── Abas com indicador compartilhado ───────────── */

export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { id: T; label: string; icon?: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx('relative flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors', value === t.id ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {value === t.id && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-xl bg-surface-2 ring-1 ring-line" transition={spring} />}
          <span className="relative flex items-center gap-2">
            {t.icon}
            {t.label}
            {t.count != null && <span className="rounded-md bg-bg/60 px-1.5 text-[11px] text-muted">{t.count}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

/* ───────────── Campo ───────────── */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'h-11 w-full rounded-xl border border-line bg-bg/60 px-3.5 text-sm text-ink placeholder:text-faint outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15'

/* ───────────── Toasts ───────────── */

export function Toaster() {
  const { toasts, dismiss } = useStore()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={spring}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface-2/95 p-3.5 shadow-2xl backdrop-blur"
          >
            <span className={clsx('mt-0.5', t.tone === 'warn' ? 'text-warn' : t.tone === 'info' ? 'text-brand-ink' : 'text-ok')}>
              {t.tone === 'warn' ? <TriangleAlert size={18} /> : t.tone === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-ink" aria-label="Fechar aviso">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ───────────── Transição de página ───────────── */

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6', className)}
    >
      {children}
    </motion.main>
  )
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="grid place-items-center rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
        {icon}
      </motion.div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
