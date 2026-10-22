import { motion, useAnimationControls } from 'motion/react'
import { KeyRound, Lock } from 'lucide-react'
import { useState } from 'react'
import { checkAccessCode } from '../lib/permissions'
import { useStore } from '../lib/store'
import type { Tournament } from '../lib/types'
import { Button, inputCls, Modal } from './ui'

/** Máquina de estados "Acessar torneio": verificando permissão → concedido | negado (tentar novamente). */
export function AccessModal({ t, onClose, onGranted }: { t: Tournament | null; onClose: () => void; onGranted: (t: Tournament) => void }) {
  const { dispatch, toast } = useStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<{ count: number; lockedUntil?: number }>({ count: 0 })
  const shake = useAnimationControls()

  const close = () => {
    setError(null)
    setCode('')
    onClose()
  }

  const submit = () => {
    if (!t) return
    const { result, attempts: next } = checkAccessCode(t, code, attempts)
    setAttempts(next)
    if (result.ok) {
      dispatch({ type: 'unlock', id: t.id })
      toast({ title: 'Acesso concedido', body: t.name })
      setCode('')
      setError(null)
      onGranted(t)
      return
    }
    setError(result.reason === 'bloqueado' ? `Muitas tentativas. Aguarde ${Math.ceil((result.retryInMs ?? 0) / 1000)} s e tente de novo.` : 'Código incorreto. Tente novamente.')
    void shake.start({ x: [0, -10, 10, -8, 8, -4, 0], transition: { duration: 0.45 } })
  }

  return (
    <Modal open={!!t} onClose={close} title="Torneio privado">
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
              onChange={(e) => (setCode(e.target.value), setError(null))}
              placeholder="Código de acesso"
              aria-label="Código de acesso"
              className={`${inputCls} pl-10 uppercase tracking-widest ${error ? 'border-live focus:border-live focus:ring-live/15' : ''}`}
              aria-invalid={!!error}
            />
          </div>
        </motion.div>
        {error && (
          <p className="pt-2 text-sm text-live" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Desistir
          </Button>
          <Button type="submit">Entrar</Button>
        </div>
      </form>
    </Modal>
  )
}
