import clsx from 'clsx'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { ArrowRight, CalendarClock, Eye, GitFork, Palette, ShieldCheck, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { rise, spring, stagger } from '../components/motion'
import { Button, inputCls } from '../components/ui'
import { useStore } from '../lib/store'
import type { Role } from '../lib/types'

const ROLES: { id: Role; title: string; body: string; icon: typeof Trophy }[] = [
  { id: 'organizador', title: 'Organizador', body: 'Cria torneios, gera chaves, agenda jogos e registra súmulas.', icon: Trophy },
  { id: 'espectador', title: 'Espectador', body: 'Acompanha chaves, partidas, times e favorita torneios.', icon: Eye },
]

const FEATURES = [
  { icon: GitFork, text: 'Chaveamento automático' },
  { icon: CalendarClock, text: 'Agenda sem conflitos' },
  { icon: Palette, text: 'Sua marca, seu tema' },
  { icon: ShieldCheck, text: 'Torneios privados' },
]

/** Chave decorativa desenhada traço a traço no fundo do herói. */
function HeroBracket() {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-1, 1], [8, -8]), { stiffness: 80, damping: 20 })
  const ry = useSpring(useTransform(mx, [-1, 1], [-10, 10]), { stiffness: 80, damping: 20 })
  const rows = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <motion.div
      className="relative h-full w-full [perspective:1200px]"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1)
        my.set(((e.clientY - r.top) / r.height) * 2 - 1)
      }}
      onPointerLeave={() => (mx.set(0), my.set(0))}
    >
      <motion.svg viewBox="0 0 420 360" className="h-full w-full" style={{ rotateX: rx, rotateY: ry }}>
        <defs>
          <linearGradient id="hb" x1="0" x2="1">
            <stop offset="0" stopColor="var(--color-brand)" />
            <stop offset="1" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        {rows.map((i) => (
          <motion.rect
            key={`a${i}`}
            x={10}
            y={14 + i * 42}
            width={92}
            height={26}
            rx={8}
            className="fill-surface-2 stroke-line"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 10 }}
            transition={{ delay: 0.1 + i * 0.05, ...spring }}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <motion.rect key={`b${i}`} x={150} y={35 + i * 84} width={92} height={26} rx={8} className="fill-surface-2 stroke-line" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.07, ...spring }} />
        ))}
        {[0, 1].map((i) => (
          <motion.rect key={`c${i}`} x={290} y={77 + i * 168} width={92} height={26} rx={8} className="fill-surface-2 stroke-line" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 + i * 0.08, ...spring }} />
        ))}
        {rows.map((i) => {
          const y = 27 + i * 42
          const ty = 48 + Math.floor(i / 2) * 84
          return <motion.path key={`l1${i}`} d={`M102 ${y} H126 V${ty} H150`} fill="none" stroke="url(#hb)" strokeWidth={2} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }} transition={{ delay: 0.45 + i * 0.05, duration: 0.6 }} />
        })}
        {[0, 1, 2, 3].map((i) => {
          const y = 48 + i * 84
          const ty = 90 + Math.floor(i / 2) * 168
          return <motion.path key={`l2${i}`} d={`M242 ${y} H266 V${ty} H290`} fill="none" stroke="url(#hb)" strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1 + i * 0.06, duration: 0.6 }} />
        })}
        {[0, 1].map((i) => (
          <motion.path key={`l3${i}`} d={`M382 ${90 + i * 168} H400 V174`} fill="none" stroke="url(#hb)" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.45 + i * 0.05, duration: 0.5 }} />
        ))}
        <motion.g initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 1.9, type: 'spring', stiffness: 260, damping: 14 }} style={{ originX: '400px', originY: '174px' }}>
          <circle cx={400} cy={174} r={16} fill="url(#hb)" />
          <path d="M393 168h14v4a7 7 0 0 1-14 0zM397 179h6v4h-6z" fill="white" />
        </motion.g>
      </motion.svg>
    </motion.div>
  )
}

function RolePicker({ role, onPick }: { role: Role; onPick: (r: Role) => void }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {ROLES.map((r) => (
        <motion.button
          key={r.id}
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPick(r.id)}
          className={clsx('relative rounded-2xl border p-4 text-left transition-colors', role === r.id ? 'border-transparent' : 'border-line hover:border-faint')}
        >
          {role === r.id && <motion.span layoutId="role-ring" className="absolute inset-0 rounded-2xl bg-brand-soft ring-2 ring-brand" transition={spring} />}
          <span className="relative block">
            <r.icon size={20} className={role === r.id ? 'text-brand-ink' : 'text-muted'} />
            <span className="mt-2 block font-semibold">{r.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{r.body}</span>
          </span>
        </motion.button>
      ))}
    </div>
  )
}

/** Modo demonstração: escolhe o perfil, sem senha. */
function DemoLogin() {
  const { loginDemo, demoUsers } = useStore()
  const nav = useNavigate()
  const [role, setRole] = useState<Role>('organizador')
  const [name, setName] = useState('Thales Sena')

  const enter = () => {
    const base = demoUsers.find((u) => u.role === role)!
    loginDemo({ ...base, name: name.trim() || base.name })
    nav('/torneios')
  }

  return (
    <>
      <p className="text-sm font-medium text-muted">Entrar como</p>
      <RolePicker
        role={role}
        onPick={(r) => {
          setRole(r)
          setName(r === 'organizador' ? 'Thales Sena' : 'Visitante')
        }}
      />
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          enter()
        }}
      >
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" aria-label="Seu nome" />
        <Button type="submit" size="lg" className="h-11 shrink-0">
          Entrar <ArrowRight size={18} />
        </Button>
      </form>
      <p className="mt-3 text-xs text-faint">Modo demonstração: login simulado, sem senha. Dados ficam só no seu navegador.</p>
    </>
  )
}

/** Modo API: login com e-mail e senha, ou cadastro (RF07). */
function AccountLogin() {
  const { login, register } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState<'entrar' | 'criar'>('entrar')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '', role: 'espectador' as Role })
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p })

  const submit = async () => {
    setBusy(true)
    const ok =
      tab === 'entrar'
        ? await login(form.email, form.password)
        : await register({ name: form.name, email: form.email, password: form.password, role: form.role, orgName: form.role === 'organizador' ? form.orgName : undefined })
    setBusy(false)
    if (ok) nav('/torneios')
  }

  return (
    <>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {(['entrar', 'criar'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('h-9 flex-1 rounded-lg text-sm font-medium', tab === k ? 'bg-surface text-ink shadow' : 'text-muted hover:text-ink')}>
            {k === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {tab === 'criar' && (
          <>
            <RolePicker role={form.role} onPick={(role) => set({ role })} />
            <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Seu nome" aria-label="Seu nome" autoComplete="name" />
            {form.role === 'organizador' && <input className={inputCls} value={form.orgName} onChange={(e) => set({ orgName: e.target.value })} placeholder="Nome da organização" aria-label="Nome da organização" />}
          </>
        )}
        <input className={inputCls} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="E-mail" aria-label="E-mail" autoComplete="email" />
        <input
          className={inputCls}
          type="password"
          value={form.password}
          onChange={(e) => set({ password: e.target.value })}
          placeholder={tab === 'criar' ? 'Senha (mín. 8 caracteres)' : 'Senha'}
          aria-label="Senha"
          autoComplete={tab === 'criar' ? 'new-password' : 'current-password'}
        />
        <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
          {tab === 'entrar' ? 'Entrar' : 'Criar conta'} <ArrowRight size={18} />
        </Button>
      </form>
      {import.meta.env.DEV && <p className="mt-3 text-xs text-faint">Servidor de desenvolvimento: organizador@playoff.dev ou visitante@playoff.dev, senha playoff123.</p>}
    </>
  )
}

export default function Login() {
  const { mode } = useStore()
  return (
    <div className="app-glow relative min-h-screen overflow-hidden">
      <div className="grid-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className={clsx('pointer-events-none absolute size-[28rem] rounded-full blur-3xl', i ? 'bg-accent/20 -right-40 bottom-0' : 'bg-brand/25 -left-40 top-20')}
          animate={{ x: [0, i ? -60 : 60, 0], y: [0, i ? 40 : -40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 14 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise}>
            <Logo />
          </motion.div>
          <motion.h1 variants={rise} className="font-display mt-8 text-4xl leading-[1.05] font-bold sm:text-6xl">
            Do sorteio à <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">grande final</span>, num só lugar.
          </motion.h1>
          <motion.p variants={rise} className="mt-5 max-w-lg text-lg text-muted">
            Crie campeonatos de qualquer esporte, gere chaves e agendas automaticamente e acompanhe tudo ao vivo.
          </motion.p>
          <motion.ul variants={stagger} className="mt-6 flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <motion.li key={f.text} variants={rise} className="flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-sm text-muted">
                <f.icon size={15} className="text-brand-ink" />
                {f.text}
              </motion.li>
            ))}
          </motion.ul>

          <motion.div variants={rise} className="mt-10 max-w-lg rounded-3xl border border-line bg-surface/70 p-5 backdrop-blur sm:p-6">
            {mode === 'api' ? <AccountLogin /> : <DemoLogin />}
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="hidden aspect-[7/6] lg:block">
          <HeroBracket />
        </motion.div>
      </div>
    </div>
  )
}
