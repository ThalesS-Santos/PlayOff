import { render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { DEMO_USERS } from '../lib/seed'
import { freshState, STORAGE_KEY, type State } from '../lib/state'
import type { User } from '../lib/types'

export const ORGANIZER = DEMO_USERS[0]
export const SPECTATOR = DEMO_USERS[1]

/** Abre o app inteiro numa rota, com o usuário (e estado opcional) já salvos no navegador. */
export function renderApp(path = '/', user: User | null = null, mutate?: (s: State) => State) {
  const s = freshState(user)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mutate ? mutate(s) : s))
  window.history.pushState({}, '', path)
  const ue = userEvent.setup()
  const view = render(createElement(App))
  return { ue, ...view }
}

/** Estado salvo atual (o que a aplicação persistiu). */
export const saved = (): State => JSON.parse(localStorage.getItem(STORAGE_KEY)!)
export const savedTournament = (id: string) => saved().tournaments.find((t) => t.id === id)!

/** O diálogo aberto no momento. */
export const dialog = () => within(screen.getByRole('dialog'))
