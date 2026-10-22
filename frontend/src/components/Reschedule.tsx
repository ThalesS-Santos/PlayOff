import clsx from 'clsx'
import { motion } from 'motion/react'
import { CalendarClock, Pin, PinOff } from 'lucide-react'
import { useState } from 'react'
import { reschedule, SLOTS, slotConflicts, tournamentDays, unpin, type Slot } from '../lib/engine'
import { useStore } from '../lib/store'
import type { Match, Modality, Tournament } from '../lib/types'
import { Button, fmtDate, inputCls } from './ui'

/** Reagendamento manual de uma partida, com checagem de conflitos (RF04). */
export function Reschedule({ t, mod, match }: { t: Tournament; mod: Modality; match: Match }) {
  const { edit, toast } = useStore()
  const days = tournamentDays(t)
  const venues = mod.venues?.length ? mod.venues : t.venues
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<Slot>({
    date: match.date ?? days[0],
    time: match.time ?? SLOTS[0],
    venue: match.venue ?? venues[0],
    referee: match.referee ?? t.referees[0],
  })
  const reasons = slotConflicts(t, match.id, slot)
  const unchanged = slot.date === match.date && slot.time === match.time && slot.venue === match.venue && slot.referee === match.referee

  if (!open)
    return (
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="soft" icon={<CalendarClock size={14} />} onClick={() => setOpen(true)}>
          Reagendar
        </Button>
        {match.pinned && (
          <>
            <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand-ink">
              <Pin size={11} /> Horário fixado
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={<PinOff size={14} />}
              onClick={() => {
                edit(t.id, (x) => unpin(x, match.id))
                toast({ title: 'Horário liberado', body: 'A otimização da agenda pode mover esta partida.', tone: 'info' })
              }}
            >
              Liberar para otimização
            </Button>
          </>
        )}
      </div>
    )

  const set = (p: Partial<Slot>) => setSlot({ ...slot, ...p })
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-5 overflow-hidden rounded-2xl border border-line p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
        <CalendarClock size={15} /> Reagendar partida
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className={clsx(inputCls, 'h-9')} value={slot.date} onChange={(e) => set({ date: e.target.value })} aria-label="Data">
          {days.map((d) => (
            <option key={d} value={d}>
              {fmtDate(d, { weekday: 'short', day: '2-digit', month: 'short' })}
            </option>
          ))}
        </select>
        <select className={clsx(inputCls, 'h-9')} value={slot.time} onChange={(e) => set({ time: e.target.value })} aria-label="Horário">
          {SLOTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className={clsx(inputCls, 'h-9')} value={slot.venue} onChange={(e) => set({ venue: e.target.value })} aria-label="Local">
          {venues.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select className={clsx(inputCls, 'h-9')} value={slot.referee} onChange={(e) => set({ referee: e.target.value })} aria-label="Árbitro">
          {t.referees.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {reasons.length > 0 && !unchanged ? (
        <ul className="mt-2 space-y-0.5 text-xs text-warn" role="alert">
          {reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : (
        !unchanged && <p className="mt-2 text-xs text-ok">Horário livre: sem conflitos.</p>
      )}
      <p className="mt-2 text-xs text-faint">A partida fica fixada: a otimização automática não a move mais.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button
          size="sm"
          disabled={unchanged || reasons.length > 0}
          icon={<Pin size={14} />}
          onClick={() => {
            edit(t.id, (x) => reschedule(x, match.id, slot))
            toast({ title: 'Partida reagendada', body: `${fmtDate(slot.date)} às ${slot.time} · ${slot.venue}` })
            setOpen(false)
          }}
        >
          Salvar horário
        </Button>
      </div>
    </motion.div>
  )
}
