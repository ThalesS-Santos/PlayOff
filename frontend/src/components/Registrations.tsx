import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Crown, Gavel, Gift, Lock, Pencil, Plus, Shirt, Trash2, Trophy, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { uid } from '../lib/engine'
import { entriesOpen, lockedModalities, prizeModality, prizeWinners, refereeAssignments, TEAM_COLORS, validatePrize, validateReferee, validateTeam } from '../lib/registry'
import { useStore } from '../lib/store'
import type { Prize, Team, Tournament } from '../lib/types'
import { rise, stagger } from './motion'
import { Button, Crest, Empty, Field, inputCls, Modal } from './ui'

/** Aba de cadastros do organizador (RF02): times, jogadores, técnicos e árbitros. */
export function RegistrationsTab({ t }: { t: Tournament }) {
  const { toggleSeed, removeTeam, toast } = useStore()
  const [editing, setEditing] = useState<Team | null>(null)
  const [removing, setRemoving] = useState<Team | null>(null)

  const newTeam = (): Team => ({
    id: uid('tm'),
    name: '',
    short: '',
    color: TEAM_COLORS[t.teams.length % TEAM_COLORS.length],
    coach: '',
    players: [],
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <Shirt size={18} className="text-brand-ink" /> Times <span className="text-sm font-normal text-faint">{t.teams.length}</span>
          </h2>
          <Button icon={<Plus size={16} />} onClick={() => setEditing(newTeam())}>
            Novo time
          </Button>
        </div>

        {!t.teams.length ? (
          <Empty icon={<Shirt />} title="Nenhum time cadastrado" body="Cadastre os times com elenco e técnico, e inscreva-os nas modalidades." />
        ) : (
          <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {t.teams.map((team) => (
              <motion.li key={team.id} variants={rise} className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <Crest team={team} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{team.name}</p>
                    <p className="truncate text-xs text-muted">
                      Técnico(a): {team.coach || '—'} · {team.players.length} atletas
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing(team)} aria-label={`Editar ${team.name}`}>
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setRemoving(team)} aria-label={`Excluir ${team.name}`} className="hover:text-live" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.modalities.map((m) => {
                    const on = m.teamIds.includes(team.id)
                    const seed = m.seeds.indexOf(team.id)
                    const open = entriesOpen(m)
                    if (!on) return null
                    return (
                      <button
                        key={m.id}
                        disabled={!open}
                        onClick={() => void toggleSeed(t.id, m.id, team.id)}
                        title={open ? 'Marcar/desmarcar como cabeça de chave' : 'Jogos já gerados: inscrição bloqueada'}
                        className={clsx(
                          'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                          seed >= 0 ? 'bg-warn/15 text-warn' : 'bg-surface-2 text-muted',
                          open && 'hover:ring-1 hover:ring-warn/50',
                        )}
                      >
                        {!open ? <Lock size={11} /> : seed >= 0 && <Crown size={11} />}
                        {m.sport} · {m.category}
                        {seed >= 0 && <b>#{seed + 1}</b>}
                      </button>
                    )
                  })}
                  {!t.modalities.some((m) => m.teamIds.includes(team.id)) && <span className="text-xs text-warn">Não inscrito em nenhuma modalidade</span>}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
        <p className="mt-3 text-xs text-faint">Clique numa modalidade do time para marcá-lo como cabeça de chave. A ordem em que você marca define o ranking.</p>
      </section>

      <RefereesPanel t={t} />

      <PrizesPanel t={t} />

      <TeamEditor key={editing?.id} t={t} team={editing} onClose={() => setEditing(null)} />

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Excluir ${removing?.name ?? 'time'}?`}>
        {removing && lockedModalities(t, removing.id).length ? (
          <p className="text-sm text-muted">
            Este time já tem jogos gerados em {lockedModalities(t, removing.id).map((m) => m.sport).join(', ')}. Sorteie a modalidade novamente sem ele, ou mantenha o cadastro.
          </p>
        ) : (
          <p className="text-sm text-muted">O time, seu elenco e suas inscrições serão removidos do torneio.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            disabled={!!removing && lockedModalities(t, removing.id).length > 0}
            onClick={async () => {
              const target = removing!
              setRemoving(null)
              if (await removeTeam(t.id, target.id)) toast({ title: 'Time excluído', body: target.name, tone: 'info' })
            }}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/* ───────────── Editor de time ───────────── */

function TeamEditor({ t, team, onClose }: { t: Tournament; team: Team | null; onClose: () => void }) {
  const { saveTeam, toast } = useStore()
  const isNew = !!team && !t.teams.some((x) => x.id === team.id)
  const [draft, setDraft] = useState<Team | null>(team)
  const [shortTouched, setShortTouched] = useState(!isNew)
  const [mods, setMods] = useState<string[]>(() =>
    team ? t.modalities.filter((m) => (isNew ? entriesOpen(m) && t.modalities.length === 1 : m.teamIds.includes(team.id))).map((m) => m.id) : [],
  )
  const [errors, setErrors] = useState<string[]>([])
  if (!team || !draft) return null

  const set = (p: Partial<Team>) => setDraft({ ...draft, ...p })
  const setPlayer = (i: number, p: Partial<Team['players'][number]>) => set({ players: draft.players.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const addPlayer = () => {
    const used = new Set(draft.players.map((p) => p.number))
    let n = 1
    while (used.has(n) && n < 99) n++
    set({ players: [...draft.players, { id: `${draft.id}p_${uid('')}`, name: '', number: n }] })
  }

  const save = async () => {
    const errs = validateTeam(draft, t)
    setErrors(errs)
    if (errs.length) return
    if (!(await saveTeam(t.id, draft, mods))) return
    toast({ title: isNew ? 'Time cadastrado' : 'Time atualizado', body: draft.name.trim() })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo time' : `Editar ${team.name}`} wide>
      <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
        <Field label="Nome do time">
          <input
            className={inputCls}
            value={draft.name}
            autoFocus
            onChange={(e) => {
              const name = e.target.value
              set({ name, ...(shortTouched ? {} : { short: name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() }) })
            }}
            placeholder="Ex.: Águias do 3º A"
          />
        </Field>
        <Field label="Sigla">
          <input
            className={clsx(inputCls, 'uppercase')}
            value={draft.short}
            maxLength={4}
            onChange={(e) => {
              setShortTouched(true)
              set({ short: e.target.value.toUpperCase() })
            }}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Técnico(a)">
          <input className={inputCls} value={draft.coach} onChange={(e) => set({ coach: e.target.value })} placeholder="Nome do técnico(a)" />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Cor</span>
          <div className="flex flex-wrap items-center gap-2">
            {TEAM_COLORS.map((c) => (
              <button key={c} onClick={() => set({ color: c })} aria-label={`Cor ${c}`} className={clsx('size-7 rounded-lg transition-transform', draft.color === c && 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface')} style={{ background: c }} />
            ))}
            <Crest team={{ ...draft, short: draft.short || '?' }} size={36} className="ml-1" />
          </div>
        </div>
      </div>

      {t.modalities.length > 0 && (
        <div className="mt-5">
          <span className="mb-1.5 block text-sm font-medium text-muted">Inscrição nas modalidades</span>
          <div className="flex flex-wrap gap-2">
            {t.modalities.map((m) => {
              const open = entriesOpen(m)
              const on = mods.includes(m.id)
              return (
                <button
                  key={m.id}
                  disabled={!open}
                  onClick={() => setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id])}
                  className={clsx('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors', on ? 'bg-brand-soft text-brand-ink ring-1 ring-brand/50' : 'bg-surface-2 text-muted hover:text-ink', !open && 'opacity-50')}
                  title={open ? undefined : 'Jogos já gerados: inscrição bloqueada'}
                >
                  {!open && <Lock size={12} />}
                  {m.sport} · {m.category}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">Elenco · {draft.players.length} atletas</span>
          <Button size="sm" variant="soft" icon={<UserPlus size={14} />} onClick={addPlayer}>
            Adicionar atleta
          </Button>
        </div>
        {!draft.players.length ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">Nenhum atleta ainda.</p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {draft.players.map((p, i) => (
                <motion.li key={p.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2">
                  <input type="number" min={0} max={99} className={clsx(inputCls, 'h-10 w-16 px-2 text-center font-display font-bold')} value={Number.isNaN(p.number) ? '' : p.number} onChange={(e) => setPlayer(i, { number: e.target.value === '' ? NaN : Number(e.target.value) })} aria-label={`Camisa do atleta ${i + 1}`} />
                  <input className={clsx(inputCls, 'h-10 min-w-0 flex-1')} value={p.name} onChange={(e) => setPlayer(i, { name: e.target.value })} placeholder="Nome" aria-label={`Nome do atleta ${i + 1}`} />
                  <input className={clsx(inputCls, 'hidden h-10 w-32 sm:block')} value={p.nickname ?? ''} onChange={(e) => setPlayer(i, { nickname: e.target.value })} placeholder="Apelido" aria-label={`Apelido do atleta ${i + 1}`} />
                  <button onClick={() => set({ players: draft.players.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-live" aria-label={`Remover atleta ${i + 1}`}>
                    <X size={16} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl bg-live/10 p-3 text-sm text-live" role="alert">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save}>{isNew ? 'Cadastrar time' : 'Salvar'}</Button>
      </div>
    </Modal>
  )
}

/* ───────────── Prêmios ───────────── */

function PrizesPanel({ t }: { t: Tournament }) {
  const { savePrize, removePrize, toast } = useStore()
  const [editing, setEditing] = useState<Prize | null>(null)
  const isNew = !!editing && !t.prizes.some((p) => p.id === editing.id)
  const [errors, setErrors] = useState<string[]>([])

  const open = (p: Prize) => {
    setErrors([])
    setEditing(p)
  }
  const save = async () => {
    if (!editing) return
    const errs = validatePrize(editing)
    setErrors(errs)
    if (errs.length) return
    if (!(await savePrize(t.id, editing))) return
    toast({ title: isNew ? 'Prêmio cadastrado' : 'Prêmio atualizado', body: editing.name.trim() })
    setEditing(null)
  }
  const set = (p: Partial<Prize>) => editing && setEditing({ ...editing, ...p })

  return (
    <section className="lg:col-span-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <Gift size={18} className="text-brand-ink" /> Prêmios <span className="text-sm font-normal text-faint">{t.prizes.length}</span>
        </h2>
        <Button variant="soft" icon={<Plus size={16} />} onClick={() => open({ id: uid('pz'), name: '', kind: 'coletivo', place: Math.min(3, t.prizes.length + 1), modalityId: t.modalities.length > 1 ? t.modalities[0].id : undefined })}>
          Novo prêmio
        </Button>
      </div>
      {!t.prizes.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">Nenhum prêmio cadastrado.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {t.prizes.map((p) => {
            const mod = prizeModality(t, p)
            const winners = prizeWinners(t, p)
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
                  <Trophy size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {p.kind === 'individual' ? 'Individual' : `${p.place}º lugar`} · {mod ? mod.sport : 'Geral'}
                    {p.value != null && ` · R$ ${p.value.toLocaleString('pt-BR')}`}
                  </p>
                  <p className="truncate text-xs text-ok">{p.kind === 'individual' ? (p.awardee ? `Entregue a ${p.awardee}` : '') : winners.map((w) => w.name).join(' e ')}</p>
                </div>
                <button onClick={() => open(p)} className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink" aria-label={`Editar ${p.name}`}>
                  <Pencil size={14} />
                </button>
                <button
                  onClick={async () => {
                    if (await removePrize(t.id, p.id)) toast({ title: 'Prêmio removido', body: p.name, tone: 'info' })
                  }}
                  className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-live"
                  aria-label={`Excluir ${p.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-faint">Prêmios coletivos são entregues automaticamente ao fim da modalidade (sem disputa de 3º lugar, os semifinalistas dividem o 3º).</p>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'Novo prêmio' : 'Editar prêmio'}>
        {editing && (
          <div className="space-y-4">
            <Field label="Nome">
              <input className={inputCls} value={editing.name} autoFocus onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Troféu de campeão, Artilheiro" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select className={inputCls} value={editing.kind} onChange={(e) => set({ kind: e.target.value as Prize['kind'] })}>
                  <option value="coletivo">Coletivo (time)</option>
                  <option value="individual">Individual (atleta)</option>
                </select>
              </Field>
              <Field label="Modalidade">
                <select className={inputCls} value={editing.modalityId ?? ''} onChange={(e) => set({ modalityId: e.target.value || undefined })}>
                  <option value="">Geral</option>
                  {t.modalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sport} · {m.category}
                    </option>
                  ))}
                </select>
              </Field>
              {editing.kind === 'coletivo' && (
                <Field label="Colocação">
                  <select className={inputCls} value={editing.place} onChange={(e) => set({ place: Number(e.target.value) })}>
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}º lugar
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Valor (R$)">
                <input type="number" min={0} className={inputCls} value={editing.value ?? ''} onChange={(e) => set({ value: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Opcional" />
              </Field>
            </div>
            {editing.kind === 'individual' && (
              <Field label="Contemplado(a)" hint="Preencha quando o prêmio for definido.">
                <input className={inputCls} list="prize-athletes" value={editing.awardee ?? ''} onChange={(e) => set({ awardee: e.target.value })} placeholder="Nome do atleta" />
                <datalist id="prize-athletes">
                  {t.teams.flatMap((tm) => tm.players.map((pl) => <option key={pl.id} value={`${pl.name} (${tm.name})`} />))}
                </datalist>
              </Field>
            )}
            {errors.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-live/10 p-3 text-sm text-live" role="alert">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={save}>{isNew ? 'Cadastrar prêmio' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

/* ───────────── Árbitros ───────────── */

function RefereesPanel({ t }: { t: Tournament }) {
  const { addReferee, removeReferee, toast } = useStore()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()

  const add = async () => {
    const err = validateReferee(name, t)
    setError(err)
    if (err) return
    if (!(await addReferee(t.id, name))) return
    toast({ title: 'Árbitro cadastrado', body: name.trim() })
    setName('')
  }

  return (
    <section className="h-fit rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
        <Gavel size={18} className="text-brand-ink" /> Árbitros <span className="text-sm font-normal text-faint">{t.referees.length}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">A otimização da agenda escala os árbitros sem sobreposição.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input className={clsx(inputCls, 'h-10 min-w-0 flex-1')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do árbitro" aria-label="Nome do árbitro" />
        <Button type="submit" icon={<Plus size={16} />} aria-label="Adicionar árbitro" className="shrink-0" />
      </form>
      {error && <p className="mt-2 text-xs text-live">{error}</p>}
      <ul className="mt-4 space-y-1.5">
        {t.referees.map((r) => {
          const busy = refereeAssignments(t, r).length
          return (
            <li key={r} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r}</span>
              {busy > 0 && <span className="text-xs text-faint">{busy} jogos</span>}
              <button
                disabled={busy > 0}
                onClick={() => void removeReferee(t.id, r)}
                title={busy ? 'Escalado em partidas pendentes' : 'Remover'}
                className="rounded-lg p-1 text-faint hover:text-live disabled:opacity-30"
                aria-label={`Remover ${r}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
