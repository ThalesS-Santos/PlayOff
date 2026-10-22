import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Clock, Flag, MapPin, Minus, Plus, Timer, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ranking, setsWon, winnerOf } from '../lib/engine'
import { useStore } from '../lib/store'
import type { Card, Match, Modality, Sumula, Team, Tournament } from '../lib/types'
import { Reschedule } from './Reschedule'
import { AnimatedNumber, Button, Crest, fmtDate, inputCls, LiveDot, Modal, spring } from './ui'

export function fmtTime(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const c = Math.floor((ms % 1000) / 10)
  return `${m ? `${m}:` : ''}${String(s).padStart(m ? 2 : 1, '0')}.${String(c).padStart(2, '0')}`
}

function parseTime(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,2}))?$/)
  if (!m) return null
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '0').padEnd(2, '0')) * 10
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {!disabled && (
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.max(0, value - 1))} className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted hover:text-ink" aria-label="Diminuir">
          <Minus size={16} />
        </motion.button>
      )}
      <div className="relative h-14 w-14 overflow-hidden text-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }} transition={spring} className="font-display absolute inset-0 grid place-items-center text-5xl font-bold tabular-nums">
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      {!disabled && (
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => onChange(value + 1)} className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-ink" aria-label="Aumentar">
          <Plus size={16} />
        </motion.button>
      )}
    </div>
  )
}

function Cards({ cards, setCards, teams, readOnly }: { cards: Card[]; setCards: (c: Card[]) => void; teams: Team[]; readOnly: boolean }) {
  const [team, setTeam] = useState(teams[0]?.id ?? '')
  const players = teams.find((t) => t.id === team)?.players ?? []
  const [player, setPlayer] = useState(players[0]?.id ?? '')
  const [minute, setMinute] = useState(10)
  useEffect(() => setPlayer(teams.find((t) => t.id === team)?.players[0]?.id ?? ''), [team, teams])
  const name = (c: Card) => teams.find((t) => t.id === c.teamId)?.players.find((p) => p.id === c.playerId)?.name ?? 'Jogador'

  if (readOnly && !cards.length) return null
  return (
    <div className="mt-5 rounded-2xl border border-line p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
        <Flag size={15} /> Advertências e cartões
      </p>
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {cards.map((c, i) => (
            <motion.li key={`${c.playerId}-${c.minute}-${i}`} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 overflow-hidden text-sm">
              <motion.span initial={{ rotate: -25, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }} className={clsx('h-4 w-3 rounded-sm', c.color === 'amarelo' ? 'bg-yellow-400' : 'bg-red-500')} />
              <span className="font-medium">{name(c)}</span>
              <span className="text-muted">· {teams.find((t) => t.id === c.teamId)?.name}</span>
              <span className="ml-auto text-faint tabular-nums">{c.minute}'</span>
              {!readOnly && (
                <button onClick={() => setCards(cards.filter((_, j) => j !== i))} className="text-faint hover:text-live" aria-label="Remover cartão">
                  <Trash2 size={14} />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!readOnly && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_70px_auto]">
          <select className={`${inputCls} h-9`} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Time">
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className={`${inputCls} h-9`} value={player} onChange={(e) => setPlayer(e.target.value)} aria-label="Jogador">
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} · {p.name}
              </option>
            ))}
          </select>
          <input type="number" min={0} className={`${inputCls} h-9`} value={minute} onChange={(e) => setMinute(Number(e.target.value))} aria-label="Minuto" />
          <div className="flex gap-1.5">
            {(['amarelo', 'vermelho'] as const).map((color) => (
              <motion.button key={color} whileTap={{ scale: 0.85 }} onClick={() => setCards([...cards, { teamId: team, playerId: player, color, minute }])} className="grid h-9 flex-1 place-items-center rounded-xl bg-surface-2 px-2 hover:bg-line" aria-label={`Cartão ${color}`}>
                <span className={clsx('h-4 w-3 rounded-sm', color === 'amarelo' ? 'bg-yellow-400' : 'bg-red-500')} />
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function SumulaModal({ t, mod, match, onClose }: { t: Tournament; mod?: Modality; match: Match | null; onClose: () => void }) {
  const { canManage, registerSumula, saveLive, toast } = useStore()
  const readOnly = !canManage(t)
  const team = (id?: string) => t.teams.find((x) => x.id === id)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [penA, setPenA] = useState(0)
  const [penB, setPenB] = useState(0)
  const [sets, setSets] = useState<[number, number][]>([[0, 0]])
  const [times, setTimes] = useState<Record<string, string>>({})
  const [cards, setCards] = useState<Card[]>([])

  useEffect(() => {
    if (!match) return
    const s = match.sumula
    setA(s?.kind === 'pontos' ? s.a : 0)
    setB(s?.kind === 'pontos' ? s.b : 0)
    setPenA(s?.kind === 'pontos' ? (s.penA ?? 0) : 0)
    setPenB(s?.kind === 'pontos' ? (s.penB ?? 0) : 0)
    setSets(s?.kind === 'set' ? s.sets : [[0, 0]])
    setCards(s && s.kind !== 'colocacao' ? s.cards : [])
    setTimes(s?.kind === 'colocacao' ? Object.fromEntries(s.entries.map((e) => [e.teamId, fmtTime(e.timeMs)])) : {})
  }, [match])

  if (!mod) return null
  const knockout = !!match && !match.groupId
  const needPens = mod.kind === 'pontos' && knockout && a === b

  const build = (): Sumula | null => {
    if (mod.kind === 'pontos') return { kind: 'pontos', a, b, ...(needPens ? { penA, penB } : {}), cards }
    if (mod.kind === 'set') return { kind: 'set', sets, cards }
    const entries = (match?.participants ?? []).map((id) => ({ teamId: id, timeMs: parseTime(times[id] ?? '') ?? NaN }))
    if (entries.some((e) => Number.isNaN(e.timeMs))) return null
    return { kind: 'colocacao', entries }
  }

  const finish = () => {
    if (!match) return
    const s = build()
    if (!s) return toast({ title: 'Preencha todos os tempos', body: 'Formato: 28.43 ou 1:02.10', tone: 'warn' })
    const preview = { ...match, sumula: s }
    if (knockout && mod.kind !== 'colocacao' && !winnerOf(preview)) return toast({ title: 'Mata-mata precisa de vencedor', body: mod.kind === 'pontos' ? 'Informe os pênaltis.' : 'Adicione o set decisivo.', tone: 'warn' })
    registerSumula(t.id, mod.id, match.id, s)
    const w = mod.kind === 'colocacao' ? ranking(preview)[0]?.teamId : winnerOf(preview)
    toast({ title: 'Súmula registrada', body: w ? `${team(w)?.name} vence${match.nextMatchId ? ' e avança na chave' : ''}!` : 'Resultado salvo.' })
    onClose()
  }

  const live = () => {
    if (!match) return
    const s = build()
    if (!s) return
    saveLive(t.id, mod.id, match.id, s)
    toast({ title: 'Placar ao vivo atualizado', tone: 'info' })
    onClose()
  }

  const ready = !!match && (match.participants ? true : !!match.a && !!match.b)
  const [wa, wb] = setsWon({ kind: 'set', sets, cards: [] })
  const tm = match ? [team(match.a), team(match.b)].filter(Boolean) as Team[] : []
  const rankPreview = (match?.participants ?? [])
    .map((id) => ({ id, ms: parseTime(times[id] ?? '') }))
    .sort((x, y) => (x.ms ?? Infinity) - (y.ms ?? Infinity))

  return (
    <Modal open={!!match} onClose={onClose} wide title={<span className="flex items-center gap-2">{match?.status === 'ao_vivo' && <LiveDot />}Súmula · {match?.phase}</span>}>
      {match && (
        <>
          <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              {fmtDate(match.date, { weekday: 'short', day: '2-digit', month: 'short' })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {match.time ?? '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {match.venue ?? '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <UserRound size={14} />
              {match.referee ?? '—'}
            </span>
            <span className="rounded-md bg-surface-2 px-2 text-xs leading-5">
              Súmula de {mod.kind === 'pontos' ? 'pontos' : mod.kind === 'set' ? 'sets' : 'colocação'}
            </span>
          </div>

          {!readOnly && match.status === 'agendada' && !match.bye && <Reschedule key={match.id} t={t} mod={mod} match={match} />}

          {!ready && <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Os adversários desta partida ainda não foram definidos.</p>}

          {ready && mod.kind === 'pontos' && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl bg-surface-2/60 p-4">
              {(['a', 'b'] as const).map((side, i) => (
                <div key={side} className={clsx('flex flex-col items-center gap-3', i === 1 && 'col-start-3')}>
                  <Crest team={team(match[side])} size={48} />
                  <span className="text-center text-sm font-semibold">{team(match[side])?.name}</span>
                  <Stepper value={side === 'a' ? a : b} onChange={side === 'a' ? setA : setB} disabled={readOnly} />
                </div>
              ))}
              <span className="font-display col-start-2 row-start-1 text-2xl text-faint">×</span>
            </div>
          )}
          <AnimatePresence>
            {ready && needPens && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-3 flex items-center justify-center gap-4 rounded-2xl border border-warn/30 bg-warn/10 p-3 text-sm">
                  <span className="text-warn">Empate no mata-mata · pênaltis</span>
                  <input type="number" min={0} disabled={readOnly} value={penA} onChange={(e) => setPenA(Number(e.target.value))} className={`${inputCls} h-9 w-16 text-center`} aria-label="Pênaltis time A" />
                  <span className="text-faint">×</span>
                  <input type="number" min={0} disabled={readOnly} value={penB} onChange={(e) => setPenB(Number(e.target.value))} className={`${inputCls} h-9 w-16 text-center`} aria-label="Pênaltis time B" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {ready && mod.kind === 'set' && (
            <div className="rounded-3xl bg-surface-2/60 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {(['a', 'b'] as const).map((side, i) => (
                  <div key={side} className={clsx('flex items-center gap-3', i === 1 ? 'col-start-3 flex-row-reverse text-right' : '')}>
                    <Crest team={team(match[side])} size={40} />
                    <div>
                      <p className="text-sm font-semibold">{team(match[side])?.name}</p>
                      <p className="font-display text-3xl font-bold">
                        <AnimatedNumber value={side === 'a' ? wa : wb} />
                      </p>
                    </div>
                  </div>
                ))}
                <span className="col-start-2 row-start-1 text-xs tracking-widest text-faint uppercase">sets</span>
              </div>
              <ul className="mt-4 space-y-2">
                <AnimatePresence initial={false}>
                  {sets.map(([x, y], i) => (
                    <motion.li key={i} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={spring} className="grid grid-cols-[60px_1fr_auto_1fr_32px] items-center gap-2">
                      <span className="text-xs text-faint">Set {i + 1}</span>
                      <input type="number" min={0} disabled={readOnly} value={x} onChange={(e) => setSets(sets.map((s, j) => (j === i ? [Number(e.target.value), s[1]] : s)))} className={clsx(inputCls, 'h-9 text-center', x > y && 'border-brand text-brand-ink')} aria-label={`Set ${i + 1} time A`} />
                      <span className="text-faint">×</span>
                      <input type="number" min={0} disabled={readOnly} value={y} onChange={(e) => setSets(sets.map((s, j) => (j === i ? [s[0], Number(e.target.value)] : s)))} className={clsx(inputCls, 'h-9 text-center', y > x && 'border-brand text-brand-ink')} aria-label={`Set ${i + 1} time B`} />
                      {!readOnly && sets.length > 1 ? (
                        <button onClick={() => setSets(sets.filter((_, j) => j !== i))} className="text-faint hover:text-live" aria-label="Remover set">
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {!readOnly && (
                <Button variant="soft" size="sm" className="mt-3" icon={<Plus size={15} />} onClick={() => setSets([...sets, [0, 0]])}>
                  Adicionar set
                </Button>
              )}
            </div>
          )}

          {ready && mod.kind === 'colocacao' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted">Tempos</p>
                {match.participants!.map((id) => (
                  <div key={id} className="flex items-center gap-2">
                    <Crest team={team(id)} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm">{team(id)?.name}</span>
                    <div className="relative w-28">
                      <Timer size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
                      <input disabled={readOnly} placeholder="28.43" value={times[id] ?? ''} onChange={(e) => setTimes({ ...times, [id]: e.target.value })} className={`${inputCls} h-9 pl-8 tabular-nums`} aria-label={`Tempo ${team(id)?.name}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-muted">Classificação</p>
                <ol className="space-y-1.5">
                  {rankPreview.map((r, i) => (
                    <motion.li key={r.id} layout transition={spring} className={clsx('flex items-center gap-2 rounded-xl px-2.5 py-1.5', i === 0 && r.ms != null ? 'bg-warn/15' : 'bg-surface-2/70')}>
                      <span className={clsx('w-5 font-display font-bold', i === 0 ? 'text-warn' : i < 3 ? 'text-brand-ink' : 'text-faint')}>{i + 1}º</span>
                      <Crest team={team(r.id)} size={22} />
                      <span className="flex-1 truncate text-sm">{team(r.id)?.name}</span>
                      <span className="text-xs text-muted tabular-nums">{r.ms != null ? fmtTime(r.ms) : '—'}</span>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {ready && mod.kind !== 'colocacao' && <Cards cards={cards} setCards={setCards} teams={tm} readOnly={readOnly} />}

          {!readOnly && ready && (
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {mod.kind !== 'colocacao' && (
                <Button variant="soft" onClick={live} icon={<LiveDot />}>
                  Salvar ao vivo
                </Button>
              )}
              <Button onClick={finish}>Encerrar partida</Button>
            </div>
          )}
          {readOnly && <p className="mt-5 text-center text-xs text-faint">Somente o organizador pode alterar a súmula.</p>}
        </>
      )}
    </Modal>
  )
}
