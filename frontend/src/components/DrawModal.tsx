import clsx from 'clsx'
import { Shuffle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { defaultGroupCount, groupCountOptions } from '../lib/engine'
import { useStore } from '../lib/store'
import type { Modality, Tournament } from '../lib/types'
import { Button, Modal } from './ui'

const FORMAT_LABEL: Record<Modality['format'], string> = {
  eliminacao: 'Eliminação simples',
  grupos_mata: 'Fase de grupos + mata-mata',
  prova: 'Prova (colocação)',
}

/** Sorteio de uma modalidade: escolhe nº de grupos e classificados (RF03). */
export function DrawModal({ t, mod, onClose }: { t: Tournament; mod: Modality | null; onClose: () => void }) {
  return <Modal open={!!mod} onClose={onClose} title={`Sortear ${mod?.sport ?? ''}`}>{mod && <DrawForm key={mod.id} t={t} mod={mod} onClose={onClose} />}</Modal>
}

function DrawForm({ t, mod, onClose }: { t: Tournament; mod: Modality; onClose: () => void }) {
  const { generate, toast } = useStore()
  const n = mod.teamIds.length
  const options = groupCountOptions(n)
  const [groups, setGroups] = useState(Math.min(mod.groupCount ?? defaultGroupCount(n), options[options.length - 1] ?? 1))
  const [advance, setAdvance] = useState(mod.advancePerGroup ?? 2)
  const played = mod.matches.filter((m) => !m.bye && m.status !== 'agendada').length
  const isGroups = mod.format === 'grupos_mata'
  const adv = groups === 1 ? 2 : advance
  const sizes = Array.from({ length: groups }, (_, i) => Math.floor(n / groups) + (i < n % groups ? 1 : 0))

  const run = () => {
    if (!generate(t.id, mod.id, isGroups ? { groupCount: groups, advance: adv } : undefined)) return
    toast({ title: 'Chave sorteada!', body: `${mod.sport}: jogos gerados e agendados.` })
    onClose()
  }

  if (n < 2) return <p className="text-sm text-muted">Inscreva ao menos 2 times nesta modalidade (aba Cadastros) para sortear.</p>

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
              <button key={g} onClick={() => setGroups(g)} className={clsx('h-10 min-w-10 rounded-xl px-3 text-sm font-medium transition-colors', g === groups ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-ink')}>
                {g}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Grupos de {[...new Set(sizes)].sort().join(' e ')} times</p>

          <p className="mt-5 mb-2 text-sm font-medium text-muted">Classificados por grupo</p>
          <div className="flex gap-2">
            {[1, 2].map((a) => (
              <button
                key={a}
                disabled={groups === 1}
                onClick={() => setAdvance(a)}
                className={clsx('h-10 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-40', a === adv ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-ink')}
              >
                {a === 1 ? 'Só o 1º' : '1º e 2º'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">{groups * adv} times avançam ao mata-mata{groups === 1 ? ' (grupo único: 1º e 2º fazem a final)' : ''}.</p>
        </>
      )}

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
