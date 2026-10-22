import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { State } from '../lib/state'
import type { Format } from '../lib/types'
import { dialog, ORGANIZER, renderApp, savedTournament, SPECTATOR } from './utils'

/** Beach Tennis (t2, inscrições abertas) com outro formato e, opcionalmente, menos times. */
const withFormat = (format: Format, teams?: number) => (s: State) => ({
  ...s,
  tournaments: s.tournaments.map((t) => (t.id === 't2' ? { ...t, modalities: t.modalities.map((m) => ({ ...m, format, teamIds: teams ? m.teamIds.slice(0, teams) : m.teamIds })) } : t)),
})

describe('pontos corridos', () => {
  it('sorteia com turno e returno e mostra a classificação', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER, withFormat('pontos_corridos'))
    await ue.click(await screen.findByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(dialog().getByText(/15 jogos/)).toBeInTheDocument() // 6 times, turno único
    await ue.click(dialog().getByRole('button', { name: 'Turno e returno' }))
    expect(dialog().getByText(/10 rodadas, 30 jogos/)).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: 'Turno único' }))
    await ue.click(dialog().getByRole('button', { name: 'Turno e returno' }))
    await ue.click(dialog().getByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(await screen.findByText('Chave sorteada!')).toBeInTheDocument()
    expect(screen.getByText(/turno e returno · rodadas na aba Partidas/)).toBeInTheDocument()
    expect(screen.getByText('Classificação')).toBeInTheDocument()
    expect(screen.getByText('O 1º colocado é o campeão')).toBeInTheDocument()
    const t = savedTournament('t2')
    expect(t.modalities[0]).toMatchObject({ returno: true })
    expect(t.modalities[0].matches).toHaveLength(30)
  })
})

describe('dupla eliminação', () => {
  it('com 6 times o sorteio explica que precisa de 4, 8, 16 ou 32', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER, withFormat('dupla_eliminacao'))
    await ue.click(await screen.findByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(dialog().getByText('dupla eliminação exige 4, 8, 16 ou 32 times')).toBeInTheDocument()
    expect(dialog().queryByRole('button', { name: /Sortear e gerar jogos/ })).not.toBeInTheDocument()
  })

  it('mostra as duas chaves e a grande final; o perdedor cai para a chave dos perdedores', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER, withFormat('dupla_eliminacao', 4))
    await ue.click(await screen.findByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(dialog().getByText(/só é eliminado ao perder duas vezes/)).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: /Sortear e gerar jogos/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Chave dos vencedores')).toBeInTheDocument()
    expect(screen.getByText('Chave dos perdedores')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Grande final/ })).toBeInTheDocument()
    expect(screen.getAllByText('Perd. V1-1').length).toBeGreaterThan(0)

    // registra a primeira partida da chave principal (vence o time A)
    const w1 = savedTournament('t2').modalities[0].matches.find((m) => m.bracket === 'W' && m.round === 1)!
    const nameB = savedTournament('t2').teams.find((x) => x.id === w1.b)!.name
    await ue.click(screen.getAllByText(savedTournament('t2').teams.find((x) => x.id === w1.a)!.name)[0].closest('button')!)
    // Beach Tennis usa súmula de sets
    await ue.clear(dialog().getByLabelText('Set 1 time A'))
    await ue.type(dialog().getByLabelText('Set 1 time A'), '6')
    await ue.clear(dialog().getByLabelText('Set 1 time B'))
    await ue.type(dialog().getByLabelText('Set 1 time B'), '3')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText('Súmula registrada')).toBeInTheDocument()
    const l1 = savedTournament('t2').modalities[0].matches.find((m) => m.id === w1.loserNextMatchId)!
    expect(l1[w1.loserNextSide!]).toBe(w1.b)
    // o perdedor aparece agora na chave dos perdedores
    const losers = screen.getByText('Chave dos perdedores').closest('section')!
    expect(within(losers).getByText(nameB)).toBeInTheDocument()
  })
})

describe('calendário em grade (RF05)', () => {
  it('por dia: horários × locais; por local: horários × dias; clicar abre a súmula', async () => {
    const { ue } = renderApp('/torneios/t1', SPECTATOR)
    await ue.click(await screen.findByRole('button', { name: /Partidas/ }))
    await ue.click(screen.getByRole('button', { name: 'Grade' }))
    expect(screen.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true')
    for (const v of ['Quadra 1', 'Quadra 2', 'Piscina Olímpica']) expect(screen.getByRole('columnheader', { name: v })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '09:00' })).toBeInTheDocument()

    // dia com jogos da primeira rodada do futsal
    const dia = screen.getByLabelText('Dia')
    const primeiroDia = savedTournament('t1').modalities[0].matches.map((m) => m.date!).filter(Boolean).sort()[0]
    await ue.selectOptions(dia, primeiroDia)
    const jogo = within(screen.getByRole('table')).getAllByRole('button')[0]
    await ue.click(jogo)
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: /Súmula/ })).toBeInTheDocument()
    await ue.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await ue.click(screen.getByRole('button', { name: 'Por local' }))
    await ue.selectOptions(screen.getByLabelText('Local'), 'Piscina Olímpica')
    expect(within(screen.getByRole('table')).getAllByRole('button').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(2)
    await ue.click(screen.getByRole('button', { name: 'Por dia' }))
    await ue.click(screen.getByRole('button', { name: 'Lista' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('destaca conflitos e avisa partidas sem horário', async () => {
    const { ue } = renderApp('/torneios/t3', ORGANIZER, (s) => ({
      ...s,
      tournaments: s.tournaments.map((t) =>
        t.id !== 't3' ? t : { ...t, modalities: t.modalities.map((m) => ({ ...m, matches: m.matches.map((x, i) => (i === m.matches.length - 1 ? { ...x, date: undefined, time: undefined } : x)) })) },
      ),
    }))
    await ue.click(await screen.findByRole('button', { name: /Partidas/ }))
    await ue.click(screen.getByRole('button', { name: 'Grade' }))
    expect(screen.getByText('1 partida(s) sem horário')).toBeInTheDocument()
    const conflito = savedTournament('t3').modalities[0].matches.find((m) => m.status === 'agendada' && m.groupId)!
    await ue.selectOptions(screen.getByLabelText('Dia'), conflito.date!)
    expect(document.querySelector('td.ring-1')).not.toBeNull()
  })

  it('sem partidas agendadas', async () => {
    const { ue } = renderApp('/torneios/t3', ORGANIZER, (s) => ({
      ...s,
      tournaments: s.tournaments.map((t) => (t.id !== 't3' ? t : { ...t, modalities: t.modalities.map((m) => ({ ...m, matches: m.matches.map((x) => ({ ...x, date: undefined, time: undefined })) })) })),
    }))
    await ue.click(await screen.findByRole('button', { name: /Partidas/ }))
    await ue.click(screen.getByRole('button', { name: 'Grade' }))
    await ue.click(screen.getByRole('button', { name: 'Por local' }))
    expect(screen.getByText('Nenhuma partida agendada.')).toBeInTheDocument()
  })
})

describe('assistente com os formatos novos', () => {
  it('pontos corridos com returno e dupla eliminação com quantidade inválida', async () => {
    const { ue } = renderApp('/criar', ORGANIZER)
    await ue.type(await screen.findByPlaceholderText(/Copa da Primavera/), 'Liga de Verão')
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Futsal/ }))
    await ue.click(screen.getByRole('button', { name: /Basquete/ }))
    const [, formatoFutsal, , formatoBasquete] = screen.getAllByRole('combobox')
    await ue.selectOptions(formatoFutsal, 'pontos_corridos')
    await ue.click(screen.getByRole('checkbox'))
    await ue.selectOptions(formatoBasquete, 'dupla_eliminacao')
    expect(screen.getByText(/exige 4, 8, 16 ou 32 equipes/)).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    for (const b of screen.getAllByRole('button', { name: /Preencher exemplo/ })) await ue.click(b)
    await ue.click(screen.getAllByRole('button', { name: 'Remover Titãs' })[1]) // basquete fica com 7
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText(/Pontos corridos \(turno e returno\)/)).toBeInTheDocument()
    await ue.click(within(screen.getByRole('main')).getByRole('button', { name: /Criar torneio/ }))
    expect(screen.getByText(/Basquete: dupla eliminação exige 4, 8, 16 ou 32 times/)).toBeInTheDocument()
    // sem sortear agora, pode criar e ajustar as inscrições depois
    await ue.click(screen.getByRole('checkbox'))
    await ue.click(within(screen.getByRole('main')).getByRole('button', { name: /Criar torneio/ }))
    expect(await screen.findByText('Torneio criado!')).toBeInTheDocument()
  })
})
