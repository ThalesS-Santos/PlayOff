import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Crown, Globe2, Lock, Plus, Rocket, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { spring } from '../components/motion'
import { Button, Crest, Field, inputCls, Page } from '../components/ui'
import { uid } from '../lib/engine'
import { FORMAT_LABEL } from '../lib/format'
import { TEAM_COLORS } from '../lib/registry'
import { useStore } from '../lib/store'
import { draftStepErrors, splitList, type TournamentDraft } from '../lib/tournament'
import type { Format, Prize, SumulaKind } from '../lib/types'

const SPORTS: { name: string; kind: SumulaKind }[] = [
  { name: 'Futsal', kind: 'pontos' },
  { name: 'Futebol Society', kind: 'pontos' },
  { name: 'Basquete', kind: 'pontos' },
  { name: 'Handebol', kind: 'pontos' },
  { name: 'Vôlei', kind: 'set' },
  { name: 'Beach Tennis', kind: 'set' },
  { name: 'Tênis de Mesa', kind: 'set' },
  { name: 'Natação', kind: 'colocacao' },
  { name: 'Atletismo', kind: 'colocacao' },
]

const COVERS: [string, string][] = [
  ['#7c5cff', '#ff5c8a'],
  ['#06b6d4', '#facc15'],
  ['#10b981', '#3b82f6'],
  ['#f97316', '#ef4444'],
  ['#a855f7', '#22d3ee'],
  ['#0ea5e9', '#6366f1'],
]

const SAMPLE_NAMES = ['Águias', 'Titãs', 'Cometas', 'Lobos', 'Vikings', 'Guerreiros', 'Tempestade', 'Relâmpago', 'Gaviões', 'Centauros', 'Jaguares', 'Netuno']

interface DraftMod {
  id: string
  sport: string
  kind: SumulaKind
  category: 'M' | 'F' | 'Misto'
  sub: string
  format: Format
  returno?: boolean
  teams: string[]
  seeds: string[]
}

const STEPS = ['Dados', 'Modalidades', 'Equipes', 'Premiação', 'Revisão']

export default function CreateTournament() {
  const { user, createTournament, toast, tournaments } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStart] = useState('2026-11-14')
  const [endDate, setEnd] = useState('2026-11-29')
  const [city, setCity] = useState('Salvador, BA')
  const [venueName, setVenueName] = useState('Ginásio Municipal')
  const [venues, setVenues] = useState('Quadra 1, Quadra 2')
  const [referees, setReferees] = useState('Ana Prado, Caio Nunes, Rita Melo')
  const [visibility, setVisibility] = useState<'publico' | 'privado'>('publico')
  const [code, setCode] = useState('')
  const [cover, setCover] = useState(COVERS[0])
  const [mods, setMods] = useState<DraftMod[]>([])
  const [prizes, setPrizes] = useState<Omit<Prize, 'id'>[]>([{ name: 'Troféu de Campeão', kind: 'coletivo', place: 1, value: 500 }])
  const [generateNow, setGenerateNow] = useState(true)

  const draft = (): TournamentDraft => ({
    name,
    description,
    startDate,
    endDate,
    city,
    venueName,
    venues: splitList(venues),
    referees: splitList(referees),
    visibility,
    accessCode: code,
    cover,
    modalities: mods,
    prizes,
    generateNow,
  })

  // as mesmas regras que o servidor aplica ao receber o torneio
  const validate = (s: number) => {
    const e = draftStepErrors(s, draft(), tournaments, user!.id)
    setErrors(e)
    return !e.length
  }

  const go = (to: number) => {
    if (to > step && !validate(step)) return
    setErrors([])
    setDir(to > step ? 1 : -1)
    setStep(to)
  }

  const create = async () => {
    if (!validate(4)) return
    const t = await createTournament(draft())
    if (!t) return
    setDone(true)
    setTimeout(() => {
      toast({ title: 'Torneio criado!', body: generateNow ? 'Chaveamento gerado e agenda montada.' : 'Publicado no catálogo.' })
      nav(`/torneios/${t.id}`)
    }, 1400)
  }

  return (
    <Page className="max-w-4xl pt-8">
      <h1 className="font-display text-3xl font-bold">Criar torneio</h1>
      <p className="mt-1 text-muted">Da concepção ao fim — em poucos passos.</p>

      {/* trilha de passos */}
      <ol className="mt-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button onClick={() => i < step && go(i)} className="flex items-center gap-2" disabled={i > step}>
              <motion.span
                animate={{ scale: i === step ? 1.1 : 1 }}
                transition={spring}
                // cor por classe: a biblioteca de animação não interpola variáveis CSS
                className={clsx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white transition-colors duration-300', i <= step ? 'bg-brand' : 'bg-surface-2')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {i < step ? (
                    <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Check size={15} />
                    </motion.span>
                  ) : (
                    <motion.span key="n" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      {i + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              <span className={clsx('hidden text-sm font-medium md:block', i === step ? 'text-ink' : 'text-faint')}>{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <motion.span className="absolute inset-y-0 left-0 bg-brand" animate={{ width: i < step ? '100%' : '0%' }} transition={{ duration: 0.45 }} />
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="relative mt-8 overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-7">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 60, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -60, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nome do torneio">
                    <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Copa da Primavera 2026" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Descrição">
                    <textarea className={`${inputCls} h-20 py-2.5`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Conte do que se trata o campeonato" />
                  </Field>
                </div>
                <Field label="Início">
                  <input type="date" className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="Fim">
                  <input type="date" className={inputCls} value={endDate} onChange={(e) => setEnd(e.target.value)} />
                </Field>
                <Field label="Cidade">
                  <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="Local">
                  <input className={inputCls} value={venueName} onChange={(e) => setVenueName(e.target.value)} />
                </Field>
                <Field label="Quadras / espaços" hint="Separados por vírgula — usados pelo otimizador de agenda">
                  <input className={inputCls} value={venues} onChange={(e) => setVenues(e.target.value)} />
                </Field>
                <Field label="Árbitros" hint="Separados por vírgula">
                  <input className={inputCls} value={referees} onChange={(e) => setReferees(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-muted">Visibilidade</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ['publico', 'Público', 'Aparece no catálogo para todos', Globe2],
                      ['privado', 'Privado', 'Acesso só com código', Lock],
                    ] as const).map(([v, title, body, Icon]) => (
                      <button key={v} onClick={() => setVisibility(v)} className={clsx('relative flex items-center gap-3 rounded-2xl border p-3 text-left', visibility === v ? 'border-transparent' : 'border-line')}>
                        {visibility === v && <motion.span layoutId="vis" className="absolute inset-0 rounded-2xl bg-brand-soft ring-2 ring-brand" transition={spring} />}
                        <Icon size={18} className="relative text-brand-ink" />
                        <span className="relative">
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted">{body}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {visibility === 'privado' && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="pt-3">
                          <input className={`${inputCls} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de acesso" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-muted">Capa</span>
                  <div className="flex flex-wrap gap-2">
                    {COVERS.map((c) => (
                      <motion.button key={c.join()} whileHover={{ y: -3 }} whileTap={{ scale: 0.9 }} onClick={() => setCover(c)} className={clsx('h-12 w-20 rounded-xl ring-offset-2 ring-offset-surface', cover === c && 'ring-2 ring-white')} style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }} aria-label="Escolher capa" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && <ModalitiesStep mods={mods} setMods={setMods} />}
            {step === 2 && <TeamsStep mods={mods} setMods={setMods} />}
            {step === 3 && <PrizesStep prizes={prizes} setPrizes={setPrizes} mods={mods} />}
            {step === 4 && (
              <div>
                <div className="relative h-28 overflow-hidden rounded-2xl" style={{ background: `linear-gradient(120deg, ${cover[0]}, ${cover[1]})` }}>
                  <div className="grid-dots absolute inset-0" />
                  <p className="font-display absolute bottom-3 left-4 text-2xl font-bold text-white drop-shadow">{name}</p>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <Info k="Período" v={`${startDate.split('-').reverse().join('/')} – ${endDate.split('-').reverse().join('/')}`} />
                  <Info k="Local" v={`${venueName} · ${city}`} />
                  <Info k="Visibilidade" v={visibility === 'publico' ? 'Público' : `Privado (${code.toUpperCase()})`} />
                  <Info k="Prêmios" v={`${prizes.length}`} />
                </dl>
                <ul className="mt-5 space-y-2">
                  {mods.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5 text-sm">
                      <span className="font-medium">
                        {m.sport} <span className="text-faint">· {m.category}</span>
                      </span>
                      <span className="text-muted">
                        {m.teams.length} equipes · {FORMAT_LABEL[m.format]}
                        {m.format === 'pontos_corridos' && (m.returno ? ' (turno e returno)' : ' (turno único)')}
                      </span>
                    </li>
                  ))}
                </ul>
                <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-3">
                  <input type="checkbox" checked={generateNow} onChange={(e) => setGenerateNow(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
                  <span className="text-sm">
                    <b>Sortear chave e montar agenda agora</b>
                    <span className="block text-muted">Desmarque para abrir inscrições e gerar depois.</span>
                  </span>
                </label>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {errors.length > 0 && (
            <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 space-y-1 overflow-hidden rounded-2xl bg-live/10 px-4 py-3 text-sm text-live">
              {errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="mt-7 flex justify-between">
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => (step ? go(step - 1) : nav(-1))}>
            {step ? 'Voltar' : 'Cancelar'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => go(step + 1)}>
              Continuar <ArrowRight size={16} />
            </Button>
          ) : (
            <Button icon={<Rocket size={16} />} onClick={create}>
              Criar torneio
            </Button>
          )}
        </div>

        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 grid place-items-center bg-surface/95 backdrop-blur">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute size-2 rounded-sm"
                  style={{ background: i % 2 ? 'var(--color-brand)' : 'var(--color-accent)' }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{ x: Math.cos(i * 0.26) * (120 + (i % 5) * 30), y: Math.sin(i * 0.26) * (120 + (i % 5) * 30), opacity: 0, rotate: 360 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
              ))}
              <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand text-white">
                  <Check size={30} />
                </div>
                <p className="font-display mt-4 text-xl font-bold">Torneio criado!</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Page>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  )
}

function ModalitiesStep({ mods, setMods }: { mods: DraftMod[]; setMods: (m: DraftMod[]) => void }) {
  const add = (s: (typeof SPORTS)[number]) =>
    setMods([...mods, { id: uid('md'), sport: s.name, kind: s.kind, category: 'M', sub: '', format: s.kind === 'colocacao' ? 'prova' : 'eliminacao', teams: [], seeds: [] }])
  const patch = (id: string, p: Partial<DraftMod>) => setMods(mods.map((m) => (m.id === id ? { ...m, ...p } : m)))

  return (
    <div>
      <p className="text-sm font-medium text-muted">Adicione modalidades — o tipo de súmula é definido pelo esporte.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SPORTS.map((s) => (
          <motion.button key={s.name} whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }} onClick={() => add(s)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:border-brand hover:text-brand-ink">
            <Plus size={14} /> {s.name}
          </motion.button>
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        <AnimatePresence initial={false}>
          {mods.map((m) => (
            <motion.li key={m.id} layout initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={spring} className="rounded-2xl border border-line bg-surface-2/40 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {m.sport}
                  <span className="ml-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand-ink">súmula de {m.kind === 'pontos' ? 'pontos' : m.kind === 'set' ? 'sets' : 'colocação'}</span>
                </p>
                <button onClick={() => setMods(mods.filter((x) => x.id !== m.id))} className="text-faint hover:text-live" aria-label="Remover modalidade">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Categoria">
                  <select className={inputCls} value={m.category} onChange={(e) => patch(m.id, { category: e.target.value as DraftMod['category'] })}>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="Misto">Misto</option>
                  </select>
                </Field>
                <Field label="Submodalidade">
                  <input className={inputCls} value={m.sub} onChange={(e) => patch(m.id, { sub: e.target.value })} placeholder="Dupla, quarteto…" />
                </Field>
                <Field label="Formato">
                  <select className={inputCls} value={m.format} disabled={m.kind === 'colocacao'} onChange={(e) => patch(m.id, { format: e.target.value as Format })}>
                    {m.kind === 'colocacao' ? (
                      <option value="prova">Prova (colocação)</option>
                    ) : (
                      (['eliminacao', 'dupla_eliminacao', 'grupos_mata', 'pontos_corridos'] as const).map((f) => (
                        <option key={f} value={f}>
                          {FORMAT_LABEL[f]}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
              </div>
              {m.format === 'pontos_corridos' && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={!!m.returno} onChange={(e) => patch(m.id, { returno: e.target.checked })} className="size-4 accent-[var(--color-brand)]" />
                  Turno e returno (cada dupla de times se enfrenta duas vezes)
                </label>
              )}
              {m.format === 'dupla_eliminacao' && <p className="mt-3 text-xs text-faint">Dupla eliminação aceita de 3 a 32 equipes; faltando equipes para completar a chave, os cabeças de chave folgam na 1ª rodada.</p>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function TeamsStep({ mods, setMods }: { mods: DraftMod[]; setMods: (m: DraftMod[]) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const patch = (id: string, p: Partial<DraftMod>) => setMods(mods.map((m) => (m.id === id ? { ...m, ...p } : m)))
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Inscreva as equipes. Toque numa equipe para marcá-la como <b className="text-warn">cabeça de chave</b> — elas só se cruzam nas fases finais.
      </p>
      {mods.map((m) => (
        <section key={m.id} className="rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {m.sport} <span className="text-sm font-normal text-faint">· {m.teams.length} equipes</span>
            </p>
            <Button
              size="sm"
              variant="soft"
              icon={<Wand2 size={14} />}
              onClick={() => {
                const n = m.format === 'grupos_mata' ? 8 : m.kind === 'colocacao' ? 6 : 8
                const names = SAMPLE_NAMES.filter((x) => !m.teams.includes(x)).slice(0, Math.max(0, n - m.teams.length))
                patch(m.id, { teams: [...m.teams, ...names] })
              }}
            >
              Preencher exemplo
            </Button>
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const v = (drafts[m.id] ?? '').trim()
              if (!v || m.teams.some((x) => x.toLocaleLowerCase('pt-BR') === v.toLocaleLowerCase('pt-BR'))) return
              patch(m.id, { teams: [...m.teams, v] })
              setDrafts({ ...drafts, [m.id]: '' })
            }}
          >
            <input className={inputCls} placeholder="Nome da equipe e Enter" value={drafts[m.id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [m.id]: e.target.value })} />
            <Button type="submit" variant="soft" icon={<Plus size={16} />}>
              Adicionar
            </Button>
          </form>
          <motion.ul layout className="mt-3 flex flex-wrap gap-2">
            <AnimatePresence>
              {m.teams.map((tn, i) => {
                const seed = m.seeds.indexOf(tn)
                return (
                  <motion.li key={tn} layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring}>
                    <div className={clsx('flex items-center gap-2 rounded-xl border py-1 pr-1 pl-1.5 text-sm', seed >= 0 ? 'border-warn/50 bg-warn/10' : 'border-line bg-surface-2/50')}>
                      <button onClick={() => patch(m.id, { seeds: seed >= 0 ? m.seeds.filter((s) => s !== tn) : [...m.seeds, tn] })} className="flex items-center gap-2" title="Alternar cabeça de chave">
                        <Crest team={{ id: tn, name: tn, short: tn.slice(0, 3).toUpperCase(), color: TEAM_COLORS[i % TEAM_COLORS.length], coach: '', players: [] }} size={24} />
                        {tn}
                        <AnimatePresence>
                          {seed >= 0 && (
                            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} className="flex items-center gap-0.5 text-xs font-bold text-warn">
                              <Crown size={12} />
                              {seed + 1}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                      <button onClick={() => patch(m.id, { teams: m.teams.filter((x) => x !== tn), seeds: m.seeds.filter((x) => x !== tn) })} className="rounded-md p-1 text-faint hover:bg-surface hover:text-live" aria-label={`Remover ${tn}`}>
                        <X size={13} />
                      </button>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </motion.ul>
        </section>
      ))}
    </div>
  )
}

function PrizesStep({ prizes, setPrizes, mods }: { prizes: Omit<Prize, 'id'>[]; setPrizes: (p: Omit<Prize, 'id'>[]) => void; mods: DraftMod[] }) {
  const patch = (i: number, p: Partial<Prize>) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div>
      <p className="text-sm text-muted">Opcional: prêmios coletivos são entregues automaticamente do 1º ao 3º lugar de cada modalidade.</p>
      <ul className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {prizes.map((p, i) => (
            <motion.li key={i} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_120px_120px_100px_100px_36px]">
              <input className={`${inputCls} col-span-2 sm:col-span-1`} value={p.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Nome do prêmio" aria-label={`Nome do prêmio ${i + 1}`} />
              <select className={inputCls} value={p.kind} onChange={(e) => patch(i, { kind: e.target.value as Prize['kind'] })} aria-label={`Tipo do prêmio ${i + 1}`}>
                <option value="coletivo">Coletivo</option>
                <option value="individual">Individual</option>
              </select>
              <select className={inputCls} value={p.modalityId ?? ''} onChange={(e) => patch(i, { modalityId: e.target.value || undefined })} aria-label={`Modalidade do prêmio ${i + 1}`}>
                <option value="">Geral</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sport}
                  </option>
                ))}
              </select>
              <select className={inputCls} value={p.place} disabled={p.kind === 'individual'} onChange={(e) => patch(i, { place: Number(e.target.value) })} aria-label={`Colocação do prêmio ${i + 1}`}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}º
                  </option>
                ))}
              </select>
              <input type="number" min={0} className={inputCls} value={p.value ?? ''} onChange={(e) => patch(i, { value: e.target.value ? Number(e.target.value) : undefined })} placeholder="R$" aria-label={`Valor do prêmio ${i + 1}`} />
              <button onClick={() => setPrizes(prizes.filter((_, j) => j !== i))} className="grid place-items-center text-faint hover:text-live" aria-label={`Remover prêmio ${i + 1}`}>
                <Trash2 size={16} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <Button className="mt-4" variant="soft" size="sm" icon={<Sparkles size={14} />} onClick={() => setPrizes([...prizes, { name: '', kind: 'coletivo', place: Math.min(3, prizes.length + 1) }])}>
        Adicionar prêmio
      </Button>
    </div>
  )
}
