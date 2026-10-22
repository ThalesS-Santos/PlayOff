/* Presets de animação compartilhados pelos componentes. */

export const spring = { type: 'spring', stiffness: 380, damping: 30 } as const
export const softSpring = { type: 'spring', stiffness: 220, damping: 26 } as const

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

export const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: softSpring },
}
