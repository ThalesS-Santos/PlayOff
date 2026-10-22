import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Heart, Plus, Search, SearchX, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AccessModal } from '../components/AccessModal'
import { TournamentCard } from '../components/TournamentCard'
import { rise, spring, stagger } from '../components/motion'
import { AnimatedNumber, Button, Empty, inputCls, Page } from '../components/ui'
import { useStore } from '../lib/store'
import type { Tournament } from '../lib/types'

type Filter = 'todos' | 'andamento' | 'publicado' | 'finalizado' | 'favoritos'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'andamento', label: 'Ao vivo' },
  { id: 'publicado', label: 'Inscrições abertas' },
  { id: 'finalizado', label: 'Finalizados' },
  { id: 'favoritos', label: 'Favoritos' },
]

export default function Catalog({ favoritesOnly }: { favoritesOnly?: boolean }) {
  const { tournaments, user, canManage, unlocked } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>(favoritesOnly ? 'favoritos' : 'todos')
  const [locked, setLocked] = useState<Tournament | null>(null)

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return tournaments.filter((t) => {
      if (term && !`${t.name} ${t.city} ${t.modalities.map((m) => m.sport).join(' ')}`.toLowerCase().includes(term)) return false
      if (filter === 'favoritos') return !!user && t.favoritedBy.includes(user.id)
      if (filter === 'publicado') return t.status === 'publicado' || t.status === 'chaveamento'
      if (filter !== 'todos') return t.status === filter
      return true
    })
  }, [tournaments, q, filter, user])

  const stats = useMemo(() => {
    const matches = tournaments.flatMap((t) => t.modalities.flatMap((m) => m.matches.filter((x) => !x.bye)))
    return {
      torneios: tournaments.length,
      equipes: tournaments.reduce((n, t) => n + t.teams.length, 0),
      partidas: matches.filter((m) => m.status === 'encerrada').length,
      aoVivo: matches.filter((m) => m.status === 'ao_vivo').length,
    }
  }, [tournaments])

  const open = (t: Tournament) => {
    if (t.visibility === 'privado' && !canManage(t) && !unlocked.includes(t.id)) setLocked(t)
    else nav(`/torneios/${t.id}`)
  }

  return (
    <Page>
      <motion.section variants={stagger} initial="hidden" animate="show" className="pt-8 sm:pt-12">
        <motion.p variants={rise} className="text-sm font-medium text-brand-ink">
          Olá, {user?.name.split(' ')[0]} 👋
        </motion.p>
        <motion.div variants={rise} className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{favoritesOnly ? 'Seus favoritos' : 'Explore torneios'}</h1>
          {user?.role === 'organizador' && (
            <Button icon={<Plus size={17} />} onClick={() => nav('/criar')}>
              Criar torneio
            </Button>
          )}
        </motion.div>

        <motion.div variants={stagger} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Torneios', v: stats.torneios },
            { label: 'Equipes inscritas', v: stats.equipes },
            { label: 'Partidas jogadas', v: stats.partidas },
            { label: 'Ao vivo agora', v: stats.aoVivo, live: true },
          ].map((s) => (
            <motion.div key={s.label} variants={rise} className="rounded-2xl border border-line bg-surface/70 p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className={clsx('font-display mt-1 text-3xl font-bold', s.live && s.v > 0 && 'text-live')}>
                <AnimatedNumber value={s.v} />
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={rise} className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80">
            <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
            <input className={`${inputCls} pl-10`} placeholder="Buscar por nome, cidade ou esporte" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="scrollbar-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={clsx('relative h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors', filter === f.id ? 'text-white' : 'text-muted hover:text-ink')}>
                {filter === f.id && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-brand" transition={spring} />}
                <span className="relative flex items-center gap-1.5">
                  {f.id === 'favoritos' && <Heart size={13} />}
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.section>

      <motion.div layout className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((t) => (
            <TournamentCard key={t.id} t={t} onOpen={() => open(t)} />
          ))}
        </AnimatePresence>
      </motion.div>
      {!list.length && (
        <div className="mt-6">
          {filter === 'favoritos' ? (
            <Empty icon={<Heart />} title="Nenhum favorito ainda" body="Toque no coração de um torneio para acompanhá-lo daqui." action={<Button variant="soft" onClick={() => setFilter('todos')}>Ver todos</Button>} />
          ) : tournaments.length ? (
            <Empty icon={<SearchX />} title="Nada encontrado" body="Tente outro termo ou filtro." />
          ) : (
            <Empty icon={<Trophy />} title="Nenhum torneio" body="Crie o primeiro campeonato." />
          )}
        </div>
      )}

      <AccessModal t={locked} onClose={() => setLocked(null)} onGranted={(t) => (setLocked(null), nav(`/torneios/${t.id}`))} />
    </Page>
  )
}
