import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Compass, LayoutDashboard, LogOut, Palette, Plus, RefreshCcw, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { spring } from './motion'
import { Button } from './ui'

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <motion.svg viewBox="0 0 32 32" className="size-8" initial="hidden" animate="show">
        <motion.rect width="32" height="32" rx="9" className="fill-brand" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} />
        {['M8 10h6v4h4', 'M8 22h6v-4', 'M18 16h6'].map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
          />
        ))}
      </motion.svg>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">
          Play<span className="text-brand">Off</span>
        </span>
      )}
    </span>
  )
}

function NavItem({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink to={to} end className={({ isActive }) => clsx('relative flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors', isActive ? 'text-ink' : 'text-muted hover:text-ink')}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-surface-2 ring-1 ring-line" transition={spring} />}
          <span className="relative flex items-center gap-2">
            {icon}
            <span className="hidden md:inline">{children}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}

export function Navbar() {
  const { user, logout, reset, toast, mode } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const isOrg = user?.role === 'organizador'

  return (
    <header className="glass sticky top-0 z-40 border-b border-line/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <NavLink to="/torneios" className="mr-2 shrink-0">
          <Logo />
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavItem to="/torneios" icon={<Compass size={17} />}>
            Explorar
          </NavItem>
          {isOrg && (
            <>
              <NavItem to="/painel" icon={<LayoutDashboard size={17} />}>
                Meu painel
              </NavItem>
              <NavItem to="/identidade" icon={<Palette size={17} />}>
                Identidade
              </NavItem>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {isOrg && (
            <Button size="sm" icon={<Plus size={16} />} onClick={() => nav('/criar')} className="hidden sm:inline-flex">
              Criar torneio
            </Button>
          )}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2"
              aria-label="Menu do usuário"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-accent text-sm font-bold text-white">{user?.name[0]}</span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-sm font-medium">{user?.name}</span>
                <span className="block text-xs text-muted capitalize">{user?.role}</span>
              </span>
            </motion.button>
            <AnimatePresence>
              {open && (
                <>
                  <div className="fixed inset-0" onClick={() => setOpen(false)} />
                  <motion.div
                    role="menu"
                    aria-label="Menu do usuário"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={spring}
                    style={{ transformOrigin: 'top right' }}
                    className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-surface-2 p-1.5 shadow-2xl"
                  >
                    {isOrg && (
                      <MenuBtn icon={<Plus size={16} />} onClick={() => (setOpen(false), nav('/criar'))}>
                        Criar torneio
                      </MenuBtn>
                    )}
                    <MenuBtn icon={<UserRound size={16} />} onClick={() => (setOpen(false), nav('/favoritos'))}>
                      Meus favoritos
                    </MenuBtn>
                    <MenuBtn
                      icon={<RefreshCcw size={16} />}
                      onClick={async () => {
                        setOpen(false)
                        await reset()
                        toast({ title: mode === 'api' ? 'Dados atualizados' : 'Dados de demonstração restaurados', tone: 'info' })
                      }}
                    >
                      {mode === 'api' ? 'Atualizar dados' : 'Restaurar demonstração'}
                    </MenuBtn>
                    <div className="my-1 h-px bg-line" />
                    <MenuBtn
                      icon={<LogOut size={16} />}
                      onClick={() => {
                        logout()
                        nav('/')
                      }}
                    >
                      Sair
                    </MenuBtn>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuBtn({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted transition hover:bg-surface hover:text-ink">
      {icon}
      {children}
    </button>
  )
}
