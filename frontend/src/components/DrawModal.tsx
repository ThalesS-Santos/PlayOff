import clsx from 'clsx'
import { Shuffle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { defaultGroupCount, formatErrors, groupCountOptions } from '../lib/engine'
import { FORMAT_LABEL } from '../lib/format'
import { useStore } from '../lib/store'
import type { Modality, Tournament } from '../lib/types'
import { Button, Modal } from './ui'

/** Sorteio de uma modalidade: nº de grupos e classificados, ou turno/returno (RF03). */
export function DrawModal({ t, mod, onClose }: { t: Tournament; mod: Modality | null; onClose: () => void }) {
  return <Modal open={!!mod} onClose={onClose} title={`Sortear ${mod?.sport ?? ''}`}>{mod && <DrawForm key={mod.id} t={t} mod={mod} onClose={onClose} />}</Modal>
}

function Choice<T extends string | number>({ value, current, onPick, disabled, children }: { value: T; current: T; onPick: (v: T) => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onPick(value)}
      className={clsx('h-10 min-w-10 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-40', value === current ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-ink')}
    >
      {children}
    </button>
  )
}

function DrawForm({ t, mod, onClose }: { t: Tournament; mod: Modality; onClose: () => void }) {
  const { generate, toast } = useStore()
  const n = mod.teamIds.length
  const options = groupCountOptions(n)
  const [groups, setGroups] = useState(Math.min(mod.groupCount ?? defaultGroupCount(n), options[options.length - 1] ?? 1))
  const [advance, setAdvance] = useState(mod.advancePerGroup ?? 2)
  const [returno, setReturno] = useState(!!mod.returno)
  const played = mod.matches.filter((m) => !m.bye && m.status !== 'agendada').length
  const isGroups = mod.format === 'grupos_mata'
  const isLeague = mod.format === 'pontos_corridos'
  const adv = groups === 1 ? 2 : advance
  const sizes = Array.from({ length: groups }, (_, i) => Math.floor(n / groups) + (i < n % groups ? 1 : 0))
  const problems = formatErrors(mod.format, n)

  const run = async () => {
    const opts = isGroups ? { groupCount: groups, advance: adv } : isLeague ? { returno } : undefined
    if (!(await generate(t.id, mod.id, opts))) return
    toast({ title: 'Chave sorteada!', body: `${mod.sport}: jogos gerados e agendados.` })
    onClose()
  }

  if (problems.length)
    return (
      <p className="text-sm text-muted">
        {FORMAT_LABEL[mod.format]} com {n} time(s): <b className="text-warn">{problems[0]}</b>. Ajuste as inscrições na aba Cadastros.
      </p>
    )

  const rounds = n % 2 ? n : n - 1
  return (
    <div>
      <p className="text-sm text-muted">
        {n} times · {FORMAT_LABEL[mod.format]} · {mod.seeds.length ? `${mod.seeds.length} cabeça(s) de chave` : 'sem cabeças de chave'}
      </p>

      {isGroups && (
        <>
          <p className="mt-5 mb-2 text-sm font-medium text-muted">Número de grupos</p>
          <div className="flex flex-wrap gap-2">
            {options.map((g) => (
              <Choice key={g} value={g} current={groups} onPick={setGroups}>
                {g}
              </Choice>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Grupos de {[...new Set(sizes)].sort().join(' e ')} times</p>

          <p className="mt-5 mb-2 text-sm font-medium text-muted">Classificados por grupo</p>
          <div className="flex gap-2">
            <Choice value={1} current={adv} onPick={setAdvance} disabled={groups === 1}>
              Só o 1º
            </Choice>
            <Choice value={2} current={adv} onPick={setAdvance}>
              1º e 2º
            </Choice>
          </div>
          <p className="mt-2 text-xs text-faint">{groups * adv} times avançam ao mata-mata{groups === 1 ? ' (grupo único: 1º e 2º fazem a final)' : ''}.</p>
        </>
      )}

      {isLeague && (
        <>
          <p className="mt-5 mb-2 text-sm font-medium text-muted">Disputa</p>
          <div className="flex gap-2">
            <Choice value="turno" current={returno ? 'returno' : 'turno'} onPick={() => setReturno(false)}>
              Turno único
            </Choice>
            <Choice value="returno" current={returno ? 'returno' : 'turno'} onPick={() => setReturno(true)}>
              Turno e returno
            </Choice>
          </div>
          <p className="mt-2 text-xs text-faint">
            {rounds * (returno ? 2 : 1)} rodadas, {(n * (n - 1)) / (returno ? 1 : 2)} jogos. Campeão: 1º colocado.
          </p>
        </>
      )}

      {mod.format === 'dupla_eliminacao' && <p className="mt-4 text-xs text-faint">Cada time só é eliminado ao perder duas vezes: chave dos vencedores, chave dos perdedores e grande final.</p>}

      {played > 0 && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {played} partida(s) já disputada(s) nesta modalidade serão descartadas.
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button icon={<Shuffle size={16} />} onClick={run}>
          Sortear e gerar jogos
        </Button>
      </div>
    </div>
  )
}
