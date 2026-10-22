import clsx from 'clsx'
import { motion } from 'motion/react'
import { Check, Palette, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBrandHue } from '../components/useBrandHue'
import { rise, spring, stagger } from '../components/motion'
import { Button, Crest, Field, inputCls, Page } from '../components/ui'
import { useStore } from '../lib/store'

const PRESETS = [
  { name: 'Violeta', hue: 285 },
  { name: 'Oceano', hue: 230 },
  { name: 'Turquesa', hue: 195 },
  { name: 'Grama', hue: 150 },
  { name: 'Limão', hue: 115 },
  { name: 'Âmbar', hue: 70 },
  { name: 'Coral', hue: 30 },
  { name: 'Rubi', hue: 10 },
]

/** RF06 — personalização da identidade visual por organização. */
export default function Identity() {
  const { orgs, user, dispatch, toast } = useStore()
  const org = orgs.find((o) => o.id === user?.orgId) ?? orgs[0]
  const [hue, setHue] = useState(org.hue)
  const [name, setName] = useState(org.name)
  const [short, setShort] = useState(org.short)
  useBrandHue(hue)
  useEffect(() => () => document.documentElement.style.setProperty('--brand-h', String(org.hue)), [org.hue])

  const sample = { id: 'x', name: 'Leões', short: 'LEÕ', color: `oklch(0.68 0.2 ${hue})`, coach: '', players: [] }

  return (
    <Page className="max-w-5xl pt-8">
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.p variants={rise} className="text-sm font-medium text-brand-ink">
          Personalização
        </motion.p>
        <motion.h1 variants={rise} className="font-display text-3xl font-bold">
          Identidade visual
        </motion.h1>
        <motion.p variants={rise} className="mt-1 text-muted">
          Suas cores e sua marca em todos os torneios da organização — o público vê o PlayOff com a sua cara.
        </motion.p>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <motion.section initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <Field label="Nome da organização">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Sigla" hint="Aparece no logotipo (até 3 letras)">
            <input className={inputCls} maxLength={3} value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} />
          </Field>
          <div>
            <span className="mb-2 block text-sm font-medium text-muted">Cor principal</span>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <motion.button key={p.hue} whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} onClick={() => setHue(p.hue)} className={clsx('relative flex h-14 flex-col items-center justify-center rounded-xl text-[11px] font-medium text-white')} style={{ background: `oklch(0.62 0.19 ${p.hue})` }}>
                  {hue === p.hue && (
                    <motion.span layoutId="hue-check" className="absolute inset-0 rounded-xl ring-2 ring-white ring-offset-2 ring-offset-surface" transition={spring}>
                      <Check size={14} className="absolute top-1 right-1" />
                    </motion.span>
                  )}
                  {p.name}
                </motion.button>
              ))}
            </div>
            <input type="range" min={0} max={360} value={hue} onChange={(e) => setHue(Number(e.target.value))} className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full" style={{ background: 'linear-gradient(90deg, oklch(0.65 0.2 0), oklch(0.65 0.2 60), oklch(0.65 0.2 120), oklch(0.65 0.2 180), oklch(0.65 0.2 240), oklch(0.65 0.2 300), oklch(0.65 0.2 360))' }} aria-label="Matiz personalizado" />
          </div>
          <Button
            className="w-full"
            icon={<Palette size={16} />}
            onClick={() => {
              dispatch({ type: 'org', org: { ...org, name: name.trim() || org.name, short: short || org.short, hue } })
              toast({ title: 'Identidade salva', body: 'Aplicada a todos os torneios da organização.' })
            }}
          >
            Salvar identidade
          </Button>
        </motion.section>

        <motion.section initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="overflow-hidden rounded-3xl border border-line bg-bg">
          <p className="border-b border-line px-4 py-2 text-xs text-faint">Pré-visualização</p>
          <div className="relative h-32" style={{ background: `linear-gradient(120deg, oklch(0.6 0.2 ${hue}), oklch(0.7 0.18 ${hue + 70}))`, transition: 'background .6s' }}>
            <div className="grid-dots absolute inset-0" />
            <div className="absolute bottom-3 left-4 flex items-center gap-2">
              <motion.span key={short} initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={spring} className="grid size-10 place-items-center rounded-xl bg-white/90 font-display font-bold text-black">
                {short}
              </motion.span>
              <span className="font-display text-lg font-bold text-white drop-shadow">{name}</span>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <Button size="sm">Botão principal</Button>
              <Button size="sm" variant="soft">
                Secundário
              </Button>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-faint">
                <span>FINAL</span>
                <span className="text-brand-ink">Encerrada</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Crest team={sample} size={28} />
                <span className="flex-1 font-semibold">Leões</span>
                <span className="font-display text-lg font-bold text-brand-ink">3</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3 text-sm text-brand-ink">
              <Trophy size={18} /> Destaques, links e seleções usam a sua cor.
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" animate={{ width: ['20%', '80%', '55%'] }} transition={{ duration: 4, repeat: Infinity, repeatType: 'mirror' }} />
            </div>
          </div>
        </motion.section>
      </div>
    </Page>
  )
}
