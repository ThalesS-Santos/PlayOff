import clsx from 'clsx'
import { useState } from 'react'
import { useStore } from '../lib/store'
import { splitList, validateDetails, type TournamentDetails } from '../lib/tournament'
import type { Tournament } from '../lib/types'
import { Button, Field, inputCls, Modal } from './ui'

/** Caso de uso "Editar torneio": dados básicos, período, espaços e visibilidade. */
export function EditTournamentModal({ t, open, onClose }: { t: Tournament; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Editar torneio" wide>
      {open && <EditForm t={t} onClose={onClose} />}
    </Modal>
  )
}

function EditForm({ t, onClose }: { t: Tournament; onClose: () => void }) {
  const { editDetails, toast, tournaments } = useStore()
  const [d, setD] = useState<TournamentDetails & { venuesText: string }>({
    name: t.name,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate,
    city: t.city,
    venueName: t.venueName,
    venues: t.venues,
    venuesText: t.venues.join(', '),
    visibility: t.visibility,
    accessCode: t.accessCode ?? '',
  })
  const [errors, setErrors] = useState<string[]>([])
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p })
  const details = (): TournamentDetails => ({ ...d, venues: splitList(d.venuesText) })

  const save = async () => {
    const errs = validateDetails(details(), tournaments, t.organizerId, t.id)
    setErrors(errs)
    if (errs.length) return
    if (!(await editDetails(t.id, details()))) return
    toast({ title: 'Torneio atualizado', body: d.name.trim() })
    onClose()
  }

  return (
    <div className="space-y-4">
      <Field label="Nome do torneio">
        <input className={inputCls} value={d.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Descrição">
        <textarea className={`${inputCls} h-20 py-2.5`} value={d.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início">
          <input type="date" className={inputCls} value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="Fim">
          <input type="date" className={inputCls} value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
        <Field label="Cidade">
          <input className={inputCls} value={d.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Local">
          <input className={inputCls} value={d.venueName} onChange={(e) => set({ venueName: e.target.value })} />
        </Field>
      </div>
      <Field label="Quadras / espaços" hint="Separados por vírgula. Mudar o período ou os espaços reagenda as partidas pendentes.">
        <input className={inputCls} value={d.venuesText} onChange={(e) => set({ venuesText: e.target.value })} />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">Visibilidade</span>
        <div className="flex gap-2">
          {(['publico', 'privado'] as const).map((v) => (
            <button key={v} onClick={() => set({ visibility: v })} className={clsx('h-10 rounded-xl px-4 text-sm font-medium', d.visibility === v ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-ink')}>
              {v === 'publico' ? 'Público' : 'Privado'}
            </button>
          ))}
        </div>
        {d.visibility === 'privado' && (
          <input className={`${inputCls} mt-3 uppercase tracking-widest`} value={d.accessCode} onChange={(e) => set({ accessCode: e.target.value })} placeholder="Código de acesso" aria-label="Código de acesso" />
        )}
      </div>
      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-live/10 p-3 text-sm text-live" role="alert">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save}>Salvar</Button>
      </div>
    </div>
  )
}
