import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Crown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { winnerOf } from '../lib/engine'
import { scoreOf } from '../lib/format'
import type { Match, Modality, Team } from '../lib/types'
import { softSpring } from './motion'
import { AnimatedNumber, Crest, LiveDot } from './ui'

const W = 220
const H = 68
const GAP_Y = 22
const GAP_X = 64
const HEAD = 34

function Side({ m, side, team, hovered, onHover }: { m: Match; side: 'a' | 'b'; team?: Team; hovered?: string; onHover: (id?: string) => void }) {
  const w = winnerOf(m)
  const id = m[side]
  const isWinner = !!id && w === id
  const isLoser = !!w && !!id && w !== id
  const score = scoreOf(m, side)
  const pen = m.sumula?.kind === 'pontos' && m.sumula.penA != null ? (side === 'a' ? m.sumula.penA : m.sumula.penB) : undefined
  return (
    <div
      onPointerEnter={() => onHover(id)}
      onPointerLeave={() => onHover(undefined)}
      className={clsx(
        'relative flex h-1/2 items-center gap-2 px-2.5 transition-colors',
        isLoser && 'opacity-45',
        hovered && id === hovered && 'bg-brand-soft',
      )}
    >
      <Crest team={team} size={22} />
      <span className={clsx('min-w-0 flex-1 truncate text-[13px]', team ? 'font-medium' : 'text-faint italic')}>
        {team?.name ?? (side === 'a' ? m.placeholderA : m.placeholderB) ?? (m.bye ? 'BYE' : 'A definir')}
      </span>
      {pen != null && <span className="text-[10px] text-faint tabular-nums">({pen})</span>}
      {score != null && (
        <span className={clsx('w-6 text-right font-display text-sm font-bold', isWinner ? 'text-brand-ink' : 'text-muted')}>
          <AnimatedNumber value={score} />
        </span>
      )}
      {isWinner && <motion.span layoutId={`win-${m.id}`} className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />}
    </div>
  )
}

function MatchCard({ m, byId, hovered, onHover, onSelect, style }: { m: Match; byId: Map<string, Team>; hovered?: string; onHover: (id?: string) => void; onSelect?: (m: Match) => void; style?: React.CSSProperties }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={softSpring}
      whileHover={{ scale: 1.03, zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => !m.bye && onSelect?.(m)}
      className={clsx(
        'overflow-hidden rounded-xl border bg-surface text-left shadow-[0_10px_30px_-18px_black]',
        style ? 'absolute' : 'relative',
        m.status === 'ao_vivo' ? 'border-live/60 ring-2 ring-live/20' : 'border-line',
        m.bye && 'opacity-50',
      )}
      style={{ width: W, height: H, ...style }}
    >
      <Side m={m} side="a" team={byId.get(m.a ?? '')} hovered={hovered} onHover={onHover} />
      <div className="h-px bg-line" />
      <Side m={m} side="b" team={byId.get(m.b ?? '')} hovered={hovered} onHover={onHover} />
      {m.status === 'ao_vivo' && (
        <span className="absolute top-1 right-1.5 flex items-center gap-1 text-[9px] font-bold text-live">
          <LiveDot />
        </span>
      )}
    </motion.button>
  )
}

/** Chave em colunas por rodada, sem árvore (chave dos perdedores da dupla eliminação). */
export function BracketColumns({ matches, teams, onSelect }: { matches: Match[]; teams: Team[]; onSelect?: (m: Match) => void }) {
  const [hovered, setHovered] = useState<string>()
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const rounds: Match[][] = []
  for (const m of matches) (rounds[m.round - 1] ??= []).push(m)
  return (
    <div className="scrollbar-thin -mx-4 flex gap-6 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {rounds.map((r) => (
        <div key={r[0].id} className="flex shrink-0 flex-col justify-around gap-4">
          <p className="text-xs font-semibold tracking-wider text-faint uppercase">{r[0].phase}</p>
          {[...r]
            .sort((x, y) => x.slot - y.slot)
            .map((m) => (
              <MatchCard key={m.id} m={m} byId={byId} hovered={hovered} onHover={setHovered} onSelect={onSelect} />
            ))}
        </div>
      ))}
    </div>
  )
}

export function Bracket({ mod, teams, onSelect, matches, showChampion = true }: { mod: Modality; teams: Team[]; onSelect?: (m: Match) => void; matches?: Match[]; showChampion?: boolean }) {
  const [hovered, setHovered] = useState<string>()
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const ko = matches ?? mod.matches.filter((m) => !m.groupId && !m.participants)
  const rounds = useMemo(() => {
    const rs: Match[][] = []
    for (const m of ko) (rs[m.round - 1] ??= []).push(m)
    return rs.map((r) => r.sort((x, y) => x.slot - y.slot))
  }, [ko])
  if (!rounds.length) return null

  const first = rounds[0].length
  const unit = H + GAP_Y
  const height = first * unit + HEAD
  const final = rounds[rounds.length - 1][0]
  const champ = final && final.status === 'encerrada' ? byId.get(winnerOf(final) ?? '') : undefined
  const width = rounds.length * (W + GAP_X) + (showChampion ? 190 : 0)

  const pos = (r: number, i: number) => ({
    x: r * (W + GAP_X),
    y: HEAD + (i + 0.5) * 2 ** r * unit - H / 2,
  })

  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <div className="relative" style={{ width, height: Math.max(height, 200) }}>
        {/* cabeçalhos de fase */}
        {rounds.map((r, ri) => (
          <motion.div key={ri} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ri * 0.12 }} className="absolute top-0 text-xs font-semibold tracking-wider text-faint uppercase" style={{ left: ri * (W + GAP_X), width: W }}>
            {r[0].phase}
          </motion.div>
        ))}

        {/* conectores */}
        <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
          {rounds.slice(0, -1).flatMap((r, ri) =>
            r.map((m, i) => {
              const a = pos(ri, i)
              const b = pos(ri + 1, Math.floor(i / 2))
              const x1 = a.x + W
              const y1 = a.y + H / 2
              const x2 = b.x
              const y2 = b.y + (i % 2 === 0 ? H * 0.25 : H * 0.75)
              const mid = x1 + GAP_X / 2
              const w = winnerOf(m)
              const lit = !!w && (hovered ? w === hovered : true)
              return (
                <g key={m.id}>
                  <path d={`M${x1} ${y1} H${mid} V${y2} H${x2}`} fill="none" className="stroke-line" strokeWidth={1.5} />
                  <motion.path
                    d={`M${x1} ${y1} H${mid} V${y2} H${x2}`}
                    fill="none"
                    stroke="var(--color-brand)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 1 }}
                    animate={{ pathLength: w ? 1 : 0, opacity: lit ? 1 : 0.18 }}
                    transition={{ pathLength: { duration: 0.7, delay: 0.25 + ri * 0.18, ease: 'easeInOut' }, opacity: { duration: 0.2 } }}
                  />
                </g>
              )
            }),
          )}
          {final && showChampion && (
            <motion.path
              d={`M${pos(rounds.length - 1, 0).x + W} ${pos(rounds.length - 1, 0).y + H / 2} h${GAP_X - 10}`}
              stroke="var(--color-brand)"
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: champ ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.3 + rounds.length * 0.18 }}
            />
          )}
        </svg>

        {/* partidas */}
        {rounds.map((r, ri) =>
          r.map((m, i) => {
            const p = pos(ri, i)
            return <MatchCard key={m.id} m={m} byId={byId} hovered={hovered} onHover={setHovered} onSelect={onSelect} style={{ left: p.x, top: p.y }} />
          }),
        )}

        {/* campeão */}
        {final && showChampion && (
          <div className="absolute" style={{ left: pos(rounds.length - 1, 0).x + W + GAP_X - 6, top: pos(rounds.length - 1, 0).y - 22 }}>
            <AnimatePresence mode="wait">
              {champ ? (
                <motion.div
                  key={champ.id}
                  initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.5 + rounds.length * 0.18 }}
                  className="relative w-40 rounded-2xl border border-warn/40 bg-gradient-to-b from-warn/15 to-surface p-3 text-center"
                >
                  <motion.div animate={{ rotate: [0, -8, 8, 0], y: [0, -3, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }} className="mx-auto mb-1 grid size-9 place-items-center rounded-full bg-warn/20 text-warn">
                    <Crown size={18} />
                  </motion.div>
                  <p className="text-[10px] font-semibold tracking-widest text-warn uppercase">Campeão</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Crest team={champ} size={24} />
                    <span className="truncate text-sm font-semibold">{champ.name}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="tbd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid w-40 place-items-center rounded-2xl border border-dashed border-line p-4 text-center text-xs text-faint" style={{ height: 112 }}>
                  <Crown size={18} className="mb-1" />
                  Campeão a definir
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
