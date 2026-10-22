import { motion, useAnimationControls } from 'motion/react'
import { KeyRound, Lock } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../lib/store'
import type { Tournament } from '../lib/types'
import { Button, inputCls, Modal } from './ui'

/** Máquina de estados "Acessar torneio": verificando permissão → concedido | negado (tentar novamente). */
export function AccessModal({ t, onClose, onGranted }: { t: Tournament | null; onClose: () => void; onGranted: (t: Tournament) => void }) {
  const { dispatch, toast } = useStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const shake = useAnimationControls()

  const submit = async () => {
    if (!t) return
    if (code.trim().toUpperCase() === t.accessCode) {
      dispatch({ type: 'unlock', id: t.id })
      toast({ title: 'Acesso concedido', body: t.name })
      setCode('')
      setError(false)
      onGranted(t)
    } else {
      setError(true)
      await shake.start({ x: [0, -10, 10, -8, 8, -4, 0], transition: { duration: 0.45 } })
    }
  }

  return (
    <Modal open={!!t} onClose={() => (setError(false), setCode(''), onClose())} title="Torneio privado">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Lock size={20} />
        </motion.div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{t?.name}</p>
          <p className="text-sm text-muted">Peça o código de acesso ao organizador.</p>
        </div>
      </div>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <motion.div animate={shake}>
          <div className="relative">
            <KeyRound size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              value={code}
              onChange={(e) => (setCode(e.target.value), setError(false))}
              placeholder="Código de acesso"
              className={`${inputCls} pl-10 uppercase tracking-widest ${error ? 'border-live focus:border-live focus:ring-live/15' : ''}`}
              aria-invalid={error}
            />
          </div>
        </motion.div>
        <motion.p initial={false} animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }} className="overflow-hidden text-sm text-live">
          <span className="block pt-2">Código incorreto. Tente novamente.</span>
        </motion.p>
        <p className="mt-2 text-xs text-faint">Dica da demonstração: PLAY2026</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Desistir
          </Button>
          <Button type="submit">Entrar</Button>
        </div>
      </form>
    </Modal>
  )
}
