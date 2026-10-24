import clsx from 'clsx'
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Crown,
  GitFork,
  Gift,
  Grid3x3,
  LayoutGrid,
  List,
  ListOrdered,
  Lock,
  MapPin,
  Pencil,
  Play,
  SearchX,
  Shirt,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AccessModal } from '../components/AccessModal'
import { Bracket, BracketColumns } from '../components/Bracket'
import { Calendar, GroupTables, MatchRow } from '../components/Competition'
import { DrawModal } from '../components/DrawModal'
import { EditTournamentModal } from '../components/EditTournament'
import { rise, spring, stagger } from '../components/motion'
import { RegistrationsTab } from '../components/Registrations'
import { ScheduleGrid } from '../components/ScheduleGrid'
import { SumulaModal } from '../components/SumulaModal'
import { FavButton } from '../components/TournamentCard'
import { AnimatedNumber, Button, Crest, Empty, Modal, Page, StatusBadge, Tabs } from '../components/ui'
import { champion, detectConflicts, progress } from '../lib/engine'
import { fmtDate, FORMAT_LABEL } from '../lib/format'
import { canView } from '../lib/permissions'
import { prizeModality, prizeWinners } from '../lib/registry'
import { STATUS_LABEL, useStore } from '../lib/store'
import { isClosed, transitionErrors } from '../lib/tournament'
import type { Match, Modality, Team, Tournament, TournamentStatus } from '../lib/types'

type Tab = 'chave' | 'partidas' | 'times' | 'premios' | 'cadastros' | 'gestao'

const NEXT: Partial<Record<TournamentStatus, { to: TournamentStatus; label: string }>> = {
  criacao: { to: 'publicado', label: 'Publicar torneio' },
  publicado: { to: 'chaveamento', label: 'Encerrar inscrições' },
  chaveamento: { to: 'andamento', label: 'Iniciar torneio' },
  andamento: { to: 'finalizado', label: 'Concluir torneio' },
}

export default function TournamentPage() {
  const { id } = useParams()
  const { get, mode, loadTournament } = useStore()
  const nav = useNavigate()
  const [loading, setLoading] = useState(mode === 'api')
  // modo API: o catálogo traz só o resumo; o torneio completo vem ao abrir a página
  const load = useRef(loadTournament)
  useEffect(() => {
    load.current = loadTournament
  })
  useEffect(() => {
    if (mode !== 'api') return
    let alive = true
    void load.current(id ?? '').then(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id, mode])
  const t = get(id ?? '')
  if (!t && loading)
    return (
      <Page className="pt-12">
        <p className="text-center text-sm text-muted" role="status">
          Carregando torneio…
        </p>
      </Page>
    )
  if (!t)
    return (
      <Page className="pt-12">
        <Empty
          icon={<SearchX />}
          title="Torneio não encontrado"
          body="Ele pode ter sido excluído ou o endereço está errado."
          action={<Button onClick={() => nav('/torneios')}>Buscar torneios</Button>}
        />
      </Page>
    )
  return <TournamentView key={t.id} t={t} />
}

function TournamentView({ t }: { t: Tournament }) {
  const { canManage, unlocked, orgOf, user } = useStore()
  const nav = useNavigate()
  const manage = canManage(t)
  const locked = !canView(user, t, unlocked)
  const [tab, setTab] = useState<Tab>('chave')
  const [modId, setModId] = useState(t.modalities[0]?.id)
  const [sel, setSel] = useState<{ m: Match; modId: string } | null>(null)
  const mod = t.modalities.find((m) => m.id === modId) ?? t.modalities[0]
  const { scrollY } = useScroll()
  const coverY = useTransform(scrollY, [0, 300], [0, 90])
  const coverOpacity = useTransform(scrollY, [0, 260], [1, 0.3])

  if (locked) return <AccessModal t={t} onClose={() => nav('/torneios')} onGranted={() => undefined} />

  const selMatch = sel ? t.modalities.find((m) => m.id === sel.modId)?.matches.find((x) => x.id === sel.m.id) ?? null : null
  const pct = progress(t)
  const live = t.modalities.flatMap((m) => m.matches.filter((x) => x.status === 'ao_vivo').map((x) => ({ m: x, mod: m })))

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'chave', label: 'Chaveamento', icon: <GitFork size={16} /> },
    { id: 'partidas', label: 'Partidas', icon: <CalendarRange size={16} />, count: t.modalities.reduce((n, m) => n + m.matches.filter((x) => !x.bye).length, 0) },
    { id: 'times', label: 'Times', icon: <Shirt size={16} />, count: t.teams.length },
    { id: 'premios', label: 'Premiação', icon: <Gift size={16} /> },
    ...(manage
      ? [
          { id: 'cadastros' as const, label: 'Cadastros', icon: <ClipboardList size={16} /> },
          { id: 'gestao' as const, label: 'Gestão', icon: <Wand2 size={16} /> },
        ]
      : []),
  ]

  return (
    <>
      <div className="relative h-56 overflow-hidden sm:h-64">
        <motion.div style={{ y: coverY, opacity: coverOpacity, background: `linear-gradient(120deg, ${t.cover[0]}, ${t.cover[1]})` }} className="absolute inset-0">
          <div className="grid-dots absolute inset-0" />
          <motion.div className="absolute -top-20 right-10 size-72 rounded-full bg-white/20 blur-3xl" animate={{ x: [0, -40, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
      </div>

      <Page className="-mt-36 sm:-mt-40">
        <motion.div variants={stagger} initial="hidden" animate="show" className="relative">
          <motion.div variants={rise} className="flex items-center justify-between">
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => nav(-1)} className="bg-black/20 text-white backdrop-blur hover:bg-black/35 hover:text-white">
              Voltar
            </Button>
            <FavButton t={t} />
          </motion.div>
          <motion.div variants={rise} className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-black/30 px-2 py-1 text-xs font-semibold text-white backdrop-blur">{orgOf(t).name}</span>
            <StatusBadge status={t.status} />
            {t.visibility === 'privado' && (
              <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                <Lock size={11} /> Privado
              </span>
            )}
          </motion.div>
          <motion.h1 variants={rise} className="font-display mt-3 max-w-3xl text-3xl font-bold text-white drop-shadow sm:text-5xl">
            {t.name}
          </motion.h1>
          <motion.p variants={rise} className="mt-3 max-w-2xl text-muted">
            {t.description}
          </motion.p>
          <motion.div variants={rise} className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={15} /> {fmtDate(t.startDate, { day: '2-digit', month: 'long' })} – {fmtDate(t.endDate, { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={15} /> {t.venueName} · {t.city}
            </span>
          </motion.div>

          <motion.div variants={rise} className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Progresso" value={<AnimatedNumber value={pct * 100} format={(n) => `${Math.round(n)}%`} />}>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </Stat>
            <Stat label="Modalidades" value={<AnimatedNumber value={t.modalities.length} />} />
            <Stat label="Equipes" value={<AnimatedNumber value={t.teams.length} />} />
            <Stat label="Ao vivo" value={<AnimatedNumber value={live.length} />} live={live.length > 0} />
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {live.length > 0 && tab !== 'partidas' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mt-6 grid gap-3 md:grid-cols-2">
              {live.map(({ m, mod: md }) => (
                <MatchRow key={m.id} m={m} mod={md} teams={t.teams} onClick={() => setSel({ m, modId: md.id })} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass sticky top-16 z-20 -mx-4 mt-8 border-y border-line/60 px-4 py-2 sm:mx-0 sm:rounded-2xl sm:border">
          <Tabs id="torneio" tabs={tabs} value={tab} onChange={setTab} />
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {tab === 'chave' && mod && <BracketTab t={t} mod={mod} setModId={setModId} onSelect={(m) => setSel({ m, modId: mod.id })} />}
              {tab === 'partidas' && <MatchesTab t={t} onSelect={(m, md) => setSel({ m, modId: md.id })} />}
              {tab === 'times' && <TeamsTab t={t} />}
              {tab === 'premios' && <PrizesTab t={t} />}
              {tab === 'cadastros' && <RegistrationsTab t={t} />}
              {tab === 'gestao' && <ManageTab t={t} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </Page>

      <SumulaModal t={t} mod={t.modalities.find((m) => m.id === sel?.modId)} match={selMatch} onClose={() => setSel(null)} />
    </>
  )
}

function Stat({ label, value, children, live }: { label: string; value: React.ReactNode; children?: React.ReactNode; live?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-4 backdrop-blur">
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx('font-display mt-1 text-2xl font-bold', live && 'text-live')}>{value}</p>
      {children}
    </div>
  )
}

/* ───────────── Modalidade (seletor) ───────────── */

function ModalityPicker({ t, value, onChange }: { t: Tournament; value: string; onChange: (id: string) => void }) {
  if (t.modalities.length < 2) return null
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {t.modalities.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} className={clsx('relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors', value === m.id ? 'text-ink' : 'text-muted hover:text-ink')}>
          {value === m.id && <motion.span layoutId="mod-pill" className="absolute inset-0 rounded-xl bg-brand-soft ring-1 ring-brand/50" transition={spring} />}
          <span className="relative">
            {m.sport} <span className="text-faint">· {m.category}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/* ───────────── Abas ───────────── */

function BracketTab({ t, mod, setModId, onSelect }: { t: Tournament; mod: Modality; setModId: (id: string) => void; onSelect: (m: Match) => void }) {
  const { canManage } = useStore()
  const [drawing, setDrawing] = useState(false)
  const champ = champion(mod)
  const champTeam = t.teams.find((x) => x.id === champ)

  return (
    <div>
      <ModalityPicker t={t} value={mod.id} onChange={setModId} />
      {!mod.matches.length ? (
        <Empty
          icon={<Shuffle />}
          title="Chaveamento ainda não gerado"
          body={`${mod.teamIds.length} equipes inscritas. A chave é sorteada quando as inscrições encerram.`}
          action={
            canManage(t) &&
            !isClosed(t) && (
              <Button icon={<Sparkles size={16} />} onClick={() => setDrawing(true)}>
                Sortear e gerar jogos
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {mod.format === 'prova' ? (
            <div className="max-w-2xl">
              <MatchRow m={mod.matches[0]} mod={mod} teams={t.teams} onClick={() => onSelect(mod.matches[0])} />
            </div>
          ) : mod.format === 'pontos_corridos' ? (
            <section>
              <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
                <ListOrdered size={18} className="text-brand-ink" /> Pontos corridos
                <span className="text-xs font-normal text-faint">{mod.returno ? 'turno e returno' : 'turno único'} · rodadas na aba Partidas</span>
              </h2>
              <div className="max-w-3xl">
                <GroupTables mod={mod} teams={t.teams} />
              </div>
            </section>
          ) : mod.format === 'dupla_eliminacao' ? (
            <>
              <section>
                <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
                  <GitFork size={18} className="text-brand-ink" /> Chave dos vencedores
                  <span className="text-xs font-normal text-faint">quem perde aqui cai para a chave dos perdedores</span>
                </h2>
                <div className="rounded-3xl border border-line bg-surface/40 p-4 sm:p-6">
                  <Bracket mod={mod} teams={t.teams} onSelect={onSelect} matches={mod.matches.filter((m) => m.bracket === 'W')} showChampion={false} />
                </div>
              </section>
              <section>
                <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
                  <GitFork size={18} className="rotate-180 text-brand-ink" /> Chave dos perdedores
                  <span className="text-xs font-normal text-faint">uma derrota a mais e o time está fora</span>
                </h2>
                <div className="rounded-3xl border border-line bg-surface/40 p-4 sm:p-6">
                  <BracketColumns matches={mod.matches.filter((m) => m.bracket === 'L')} teams={t.teams} onSelect={onSelect} />
                </div>
              </section>
              <section className="max-w-xl">
                <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Trophy size={18} className="text-brand-ink" /> Grande final
                </h2>
                {mod.matches
                  .filter((m) => m.bracket === 'F')
                  .map((m) => (
                    <MatchRow key={m.id} m={m} mod={mod} teams={t.teams} onClick={() => onSelect(m)} />
                  ))}
              </section>
            </>
          ) : (
            <>
              {mod.groups.length > 0 && (
                <section>
                  <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
                    <LayoutGrid size={18} className="text-brand-ink" /> Fase de grupos
                  </h2>
                  <GroupTables mod={mod} teams={t.teams} />
                </section>
              )}
              <section>
                <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-semibold">
                  <GitFork size={18} className="text-brand-ink" /> Mata-mata
                  <span className="text-xs font-normal text-faint">passe o mouse num time para ver o caminho</span>
                </h2>
                <div className="rounded-3xl border border-line bg-surface/40 p-4 sm:p-6">
                  <Bracket mod={mod} teams={t.teams} onSelect={onSelect} />
                </div>
              </section>
            </>
          )}
          {champTeam && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 rounded-3xl border border-warn/30 bg-gradient-to-r from-warn/15 to-transparent p-5">
              <Crown className="text-warn" />
              <Crest team={champTeam} size={44} />
              <div>
                <p className="text-xs tracking-widest text-warn uppercase">Campeão · {mod.sport}</p>
                <p className="font-display text-xl font-bold">{champTeam.name}</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
      <DrawModal t={t} mod={drawing ? mod : null} onClose={() => setDrawing(false)} />
    </div>
  )
}

function MatchesTab({ t, onSelect }: { t: Tournament; onSelect: (m: Match, mod: Modality) => void }) {
  const [only, setOnly] = useState<'todas' | 'proximas' | 'encerradas'>('todas')
  const [view, setView] = useState<'lista' | 'grade'>('lista')
  const conflicts = useMemo(() => {
    const map = new Map<string, string>()
    detectConflicts(t).forEach((c) => c.matchIds.forEach((id) => map.set(id, c.reason)))
    return map
  }, [t])
  const items = t.modalities
    .flatMap((mod) => mod.matches.filter((m) => !m.bye).map((m) => ({ m, mod })))
    .filter(({ m }) => (only === 'todas' ? true : only === 'encerradas' ? m.status === 'encerrada' : m.status !== 'encerrada'))

  if (!t.modalities.some((m) => m.matches.length)) return <Empty icon={<CalendarRange />} title="Sem partidas ainda" body="O calendário aparece assim que a chave for gerada." />

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(['todas', 'proximas', 'encerradas'] as const).map((k) => (
          <button key={k} onClick={() => setOnly(k)} className={clsx('relative h-9 rounded-full px-4 text-sm font-medium capitalize', only === k ? 'text-white' : 'text-muted hover:text-ink')}>
            {only === k && <motion.span layoutId="match-filter" className="absolute inset-0 rounded-full bg-brand" transition={spring} />}
            <span className="relative">{k === 'proximas' ? 'Próximas' : k}</span>
          </button>
        ))}
        {conflicts.size > 0 && <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-medium text-warn">{conflicts.size} partidas em conflito</span>}
        <div className="ml-auto flex rounded-xl bg-surface-2 p-1" role="group" aria-label="Visualização">
          {(['lista', 'grade'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={clsx('flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium', view === v ? 'bg-surface text-ink shadow' : 'text-muted hover:text-ink')}>
              {v === 'lista' ? <List size={14} /> : <Grid3x3 size={14} />}
              {v === 'lista' ? 'Lista' : 'Grade'}
            </button>
          ))}
        </div>
      </div>
      {view === 'lista' ? <Calendar items={items} teams={t.teams} conflicts={conflicts} onSelect={onSelect} /> : <ScheduleGrid t={t} items={items} conflicts={conflicts} onSelect={onSelect} />}
    </div>
  )
}

function TeamsTab({ t }: { t: Tournament }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="space-y-8">
      {t.modalities.map((mod) => (
        <section key={mod.id}>
          <h2 className="font-display mb-3 text-lg font-semibold">
            {mod.sport} <span className="text-sm font-normal text-faint">· {mod.category}{mod.sub ? ` · ${mod.sub}` : ''}</span>
          </h2>
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mod.teamIds.map((id) => {
              const tm = t.teams.find((x) => x.id === id)!
              return <TeamCard key={id} team={tm} seed={mod.seeds.indexOf(id)} open={open === id} onToggle={() => setOpen(open === id ? null : id)} />
            })}
          </motion.div>
        </section>
      ))}
    </div>
  )
}

function TeamCard({ team, seed, open, onToggle }: { team: Team; seed: number; open: boolean; onToggle: () => void }) {
  return (
    <motion.div layout variants={rise} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <motion.div layout>
          <Crest team={team} size={44} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold">
            {team.name}
            {seed >= 0 && <span className="rounded-md bg-warn/15 px-1.5 text-[10px] font-bold text-warn">CABEÇA {seed + 1}</span>}
          </p>
          <p className="text-xs text-muted">
            Técnico(a): {team.coach} · {team.players.length} atletas
          </p>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-faint">
          <ChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden border-t border-line">
            {team.players.map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 px-4 py-2 text-sm odd:bg-surface-2/40">
                <span className="w-7 font-display font-bold tabular-nums" style={{ color: team.color }}>
                  {p.number}
                </span>
                {p.name}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PrizesTab({ t }: { t: Tournament }) {
  if (!t.prizes.length) return <Empty icon={<Gift />} title="Sem prêmios cadastrados" />
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {t.prizes.map((p) => {
        const mod = prizeModality(t, p)
        const winners = prizeWinners(t, p)
        return (
          <motion.div key={p.id} variants={rise} whileHover={{ y: -4, rotate: -0.5 }} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5">
            <motion.div className="absolute -top-10 -right-10 size-32 rounded-full bg-warn/10 blur-2xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity }} />
            <div className="relative flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-warn/15 text-warn">
                <Trophy size={22} />
              </span>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted capitalize">{p.kind}</span>
            </div>
            <p className="font-display relative mt-4 text-lg font-semibold">{p.name}</p>
            <p className="relative text-sm text-muted">
              {p.kind === 'individual' ? 'Destaque individual' : `${p.place}º lugar`} {mod ? `· ${mod.sport}` : '· Geral'}
            </p>
            {p.value != null && <p className="font-display relative mt-3 text-2xl font-bold text-ok">R$ {p.value.toLocaleString('pt-BR')}</p>}
            {winners.map((w) => (
              <div key={w.id} className="relative mt-4 flex items-center gap-2 rounded-xl bg-warn/10 p-2 text-sm">
                <Crest team={w} size={24} /> <b>{w.name}</b>
              </div>
            ))}
            {p.kind === 'individual' && p.awardee && <div className="relative mt-4 rounded-xl bg-warn/10 p-2 text-sm font-semibold">{p.awardee}</div>}
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/* ───────────── Gestão (organizador) ───────────── */

function ManageTab({ t }: { t: Tournament }) {
  const { optimize, toast, transition, removeTournament } = useStore()
  const [drawMod, setDrawMod] = useState<Modality | null>(null)
  const [editing, setEditing] = useState(false)
  const nav = useNavigate()
  const conflicts = detectConflicts(t)
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null)
  const next = NEXT[t.status]
  const blocked = next ? transitionErrors(t, next.to) : []
  const closed = isClosed(t)

  const runOptimize = async () => {
    if (!(await optimize(t.id))) return
    toast({ title: 'Agenda otimizada', body: conflicts.length ? `${conflicts.length} conflito(s) antes da otimização.` : 'Calendário já estava balanceado.' })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel icon={<Play size={18} />} title="Ciclo do torneio" body="Avance o torneio pelos estados definidos no diagrama de estados.">
        <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          {(['criacao', 'publicado', 'chaveamento', 'andamento', 'finalizado'] as TournamentStatus[]).map((s, i, arr) => {
            const cur = arr.indexOf(t.status)
            return (
              <li key={s} className="flex items-center gap-1.5">
                <motion.span animate={{ scale: s === t.status ? 1.05 : 1 }} className={clsx('rounded-full px-2.5 py-1', i < cur ? 'bg-ok/15 text-ok' : s === t.status ? 'bg-brand text-white' : 'bg-surface-2 text-faint')}>
                  {STATUS_LABEL[s]}
                </motion.span>
                {i < arr.length - 1 && <span className="text-faint">→</span>}
              </li>
            )
          })}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          {next && (
            <Button
              disabled={blocked.length > 0}
              onClick={async () => {
                if (await transition(t.id, next.to)) toast({ title: STATUS_LABEL[next.to], body: t.name })
              }}
            >
              {next.label}
            </Button>
          )}
          {!closed && (
            <Button variant="danger" onClick={() => setConfirm('cancel')}>
              Cancelar torneio
            </Button>
          )}
        </div>
        {blocked.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-xs text-warn" role="status">
            {blocked.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon={<Wand2 size={18} />} title="Otimização logística" body="Realoca partidas pendentes sem conflitos de local, árbitro ou equipe, respeitando descanso entre jogos (RF04).">
        <div className="mt-4 flex items-center gap-4">
          <div className={clsx('grid size-16 place-items-center rounded-2xl font-display text-2xl font-bold', conflicts.length ? 'bg-warn/15 text-warn' : 'bg-ok/15 text-ok')}>
            <AnimatedNumber value={conflicts.length} />
          </div>
          <div className="text-sm">
            <p className="font-medium">{conflicts.length ? 'conflitos detectados' : 'Nenhum conflito'}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {conflicts.slice(0, 3).map((c, i) => (
                <li key={i}>• {c.reason}</li>
              ))}
            </ul>
          </div>
        </div>
        <Button className="mt-5" onClick={runOptimize} disabled={closed} icon={<Sparkles size={16} />}>
          Otimizar agenda
        </Button>
      </Panel>

      <Panel icon={<Shuffle size={18} />} title="Chaveamento" body="Sorteie novamente uma modalidade (os resultados registrados nela serão perdidos).">
        <div className="mt-4 space-y-2">
          {t.modalities.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
              <span>
                {m.sport} <span className="text-faint">· {m.teamIds.length} equipes · {FORMAT_LABEL[m.format]}</span>
              </span>
              <Button size="sm" variant="soft" icon={<Shuffle size={14} />} disabled={closed} onClick={() => setDrawMod(m)}>
                Sortear
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel icon={<Users size={18} />} title="Acesso e dados" body={t.visibility === 'privado' ? `Torneio privado. Código de acesso: ${t.accessCode}` : 'Torneio público: aparece no catálogo para todos.'}>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="soft" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
            Editar dados
          </Button>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirm('delete')}>
            Excluir torneio
          </Button>
        </div>
      </Panel>

      <DrawModal t={t} mod={drawMod} onClose={() => setDrawMod(null)} />
      <EditTournamentModal t={t} open={editing} onClose={() => setEditing(false)} />

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'delete' ? 'Excluir torneio?' : 'Cancelar torneio?'}>
        <p className="text-sm text-muted">{confirm === 'delete' ? 'O torneio some do catálogo. Você pode restaurar a demonstração pelo menu do usuário.' : 'O torneio passa ao estado "Cancelado" e não poderá mais ser disputado.'}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const what = confirm
              setConfirm(null)
              if (what === 'delete') {
                if (!(await removeTournament(t.id))) return
                nav('/painel')
                toast({ title: 'Torneio excluído', tone: 'info' })
              } else if (await transition(t.id, 'cancelado')) {
                toast({ title: 'Torneio cancelado', tone: 'warn' })
              }
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Panel({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">{icon}</span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {children}
    </motion.section>
  )
}
