import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { State } from '../lib/state'
import { dialog, ORGANIZER, renderApp, savedTournament, SPECTATOR } from './utils'

const tabs = () => within(screen.getAllByRole('button', { name: /Chaveamento/ })[0].closest('div.scrollbar-thin') as HTMLElement)

describe('página do torneio: espectador (só visualiza)', () => {
  it('vê chave, partidas, times e premiação; não vê Cadastros nem Gestão', async () => {
    const { ue } = renderApp('/torneios/t1', SPECTATOR)
    expect(await screen.findByRole('heading', { name: 'Copa Interclasse Horizonte 2026' })).toBeInTheDocument()
    expect(tabs().queryByRole('button', { name: /Cadastros/ })).not.toBeInTheDocument()
    expect(tabs().queryByRole('button', { name: /Gestão/ })).not.toBeInTheDocument()

    // chaveamento: mata-mata do futsal, com campeão a definir e partida ao vivo destacada
    expect(screen.getByText('Mata-mata')).toBeInTheDocument()
    expect(screen.getAllByText('AO VIVO').length).toBeGreaterThan(0)

    // troca de modalidade: vôlei tem fase de grupos
    await ue.click(screen.getByRole('button', { name: /Vôlei/ }))
    expect(screen.getByText('Fase de grupos')).toBeInTheDocument()
    // natação é prova
    await ue.click(screen.getByRole('button', { name: /Natação/ }))
    expect(screen.queryByText('Mata-mata')).not.toBeInTheDocument()

    await ue.click(tabs().getByRole('button', { name: /Partidas/ }))
    await ue.click(screen.getByRole('button', { name: 'encerradas' }))
    await ue.click(screen.getByRole('button', { name: 'Próximas' }))
    await ue.click(screen.getByRole('button', { name: 'todas' }))

    await ue.click(tabs().getByRole('button', { name: /Times/ }))
    const card = screen.getByText('Leões do Norte').closest('button')!
    await ue.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')
    await ue.click(card)

    await ue.click(tabs().getByRole('button', { name: /Premiação/ }))
    expect(screen.getByText('Troféu Campeão Futsal')).toBeInTheDocument()
    expect(screen.getByText(/Destaque individual/)).toBeInTheDocument()
  })

  it('abre a súmula só para leitura, sem reagendar nem encerrar', async () => {
    const { ue } = renderApp('/torneios/t1', SPECTATOR)
    await ue.click(await screen.findByRole('button', { name: /Partidas/ }))
    await ue.click(screen.getAllByText('Raposas')[0].closest('button')!)
    expect(dialog().getByText('Somente o organizador pode alterar a súmula.')).toBeInTheDocument()
    expect(dialog().queryByRole('button', { name: 'Encerrar partida' })).not.toBeInTheDocument()
    expect(dialog().queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument()
    expect(dialog().queryByRole('button', { name: 'Aumentar' })).not.toBeInTheDocument()
    await ue.keyboard('{Escape}')
    // a janela sai com animação: com a máquina carregada pode passar de 1 s
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  })

  it('favorita pela página e volta', async () => {
    const { ue } = renderApp('/torneios/t2', SPECTATOR)
    await ue.click(await screen.findByRole('button', { name: 'Favoritar torneio' }))
    expect(savedTournament('t2').favoritedBy).toContain(SPECTATOR.id)
    await ue.click(screen.getByRole('button', { name: /Voltar/ }))
  })

  it('torneio sem chave: espectador não vê o botão de sortear', async () => {
    renderApp('/torneios/t2', SPECTATOR)
    expect(await screen.findByText('Chaveamento ainda não gerado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sortear/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Sem partidas ainda|6 equipes inscritas/)).toBeInTheDocument()
  })

  it('outro organizador também é só espectador no torneio alheio', async () => {
    const intruso = { ...ORGANIZER, id: 'u9', orgId: 'o2' }
    renderApp('/torneios/t1', intruso)
    await screen.findByRole('heading', { name: 'Copa Interclasse Horizonte 2026' })
    expect(tabs().queryByRole('button', { name: /Gestão/ })).not.toBeInTheDocument()
  })

  it('torneio sem prêmios e sem partidas', async () => {
    const { ue } = renderApp('/torneios/t2', SPECTATOR, (s: State) => ({ ...s, tournaments: s.tournaments.map((t) => (t.id === 't2' ? { ...t, prizes: [] } : t)) }))
    await ue.click(await screen.findByRole('button', { name: /Premiação/ }))
    expect(screen.getByText('Sem prêmios cadastrados')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Partidas/ }))
    expect(screen.getByText('Sem partidas ainda')).toBeInTheDocument()
  })

  it('campeão e prêmios entregues num torneio finalizado', async () => {
    const { ue } = renderApp('/torneios/t4', SPECTATOR)
    expect(await screen.findByText(/Campeão · Basquete/)).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Premiação/ }))
    expect(screen.getByText('Troféu + camisas oficiais').closest('div[class*="rounded-3xl"]')!.textContent).toMatch(/1º lugar/)
  })
})

describe('página do torneio: organizador dono', () => {
  it('vê Cadastros e Gestão', async () => {
    renderApp('/torneios/t1', ORGANIZER)
    await screen.findByRole('heading', { name: 'Copa Interclasse Horizonte 2026' })
    expect(tabs().getByRole('button', { name: /Cadastros/ })).toBeInTheDocument()
    expect(tabs().getByRole('button', { name: /Gestão/ })).toBeInTheDocument()
  })

  it('partidas com conflito aparecem sinalizadas no calendário', async () => {
    const { ue } = renderApp('/torneios/t3', ORGANIZER)
    await ue.click(await screen.findByRole('button', { name: /Partidas/ }))
    expect(screen.getByText(/partidas em conflito/)).toBeInTheDocument()
  })
})
