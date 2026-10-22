import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { State } from '../lib/state'
import { dialog, ORGANIZER, renderApp, saved, savedTournament } from './utils'

/** A semifinal do futsal que está ao vivo na demonstração (Raposas x Falcões). */
const liveMatch = () => screen.getAllByText('AO VIVO')[0].closest('button')!
const openTab = async (ue: ReturnType<typeof renderApp>['ue'], name: RegExp) => ue.click(await screen.findByRole('button', { name }))
const matchOf = (tId: string, pred: (m: State['tournaments'][number]['modalities'][number]['matches'][number]) => boolean, modIdx = 0) =>
  savedTournament(tId).modalities[modIdx].matches.find(pred)!

describe('súmula de pontos (futsal)', () => {
  it('mata-mata empatado exige pênaltis; depois o vencedor avança para a final', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    await openTab(ue, /Partidas/)
    await ue.click(liveMatch())
    // placar 2 x 2 salvo ao vivo; mexe nos contadores e volta
    await ue.click(dialog().getAllByRole('button', { name: 'Aumentar' })[0])
    await ue.click(dialog().getAllByRole('button', { name: 'Diminuir' })[0])
    expect(dialog().getByText(/pênaltis/)).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText('Mata-mata precisa de vencedor')).toBeInTheDocument()
    await ue.clear(dialog().getByLabelText('Pênaltis time A'))
    await ue.type(dialog().getByLabelText('Pênaltis time A'), '4')
    await ue.clear(dialog().getByLabelText('Pênaltis time B'))
    await ue.type(dialog().getByLabelText('Pênaltis time B'), '3')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText('Súmula registrada')).toBeInTheDocument()
    const final = matchOf('t1', (m) => m.phase === 'Final')
    expect(final.a && final.b).toBeTruthy()
  })

  it('cartões: adiciona, remove e salva ao vivo', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    await openTab(ue, /Partidas/)
    await ue.click(liveMatch())
    await ue.selectOptions(dialog().getByLabelText('Time'), dialog().getByLabelText('Time').querySelectorAll('option')[1])
    await ue.clear(dialog().getByLabelText('Minuto'))
    await ue.type(dialog().getByLabelText('Minuto'), '12')
    await ue.click(dialog().getByRole('button', { name: 'Cartão amarelo' }))
    await ue.click(dialog().getByRole('button', { name: 'Cartão vermelho' }))
    expect(dialog().getAllByText("12'")).toHaveLength(2)
    await ue.click(dialog().getAllByRole('button', { name: 'Remover cartão' })[1])
    await ue.click(dialog().getByRole('button', { name: /Salvar ao vivo/ }))
    expect(await screen.findByText('Placar ao vivo atualizado')).toBeInTheDocument()
    const live = matchOf('t1', (m) => m.status === 'ao_vivo')
    expect(live.sumula).toMatchObject({ kind: 'pontos', cards: [{ color: 'amarelo', minute: 12 }] })
  })

  it('resultado de fase já superada fica travado (RN14)', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    await openTab(ue, /Partidas/)
    await ue.click(screen.getByRole('button', { name: 'encerradas' }))
    // uma quarta de final do futsal: a semifinal seguinte já foi jogada
    const quarta = screen.getAllByText(/Futsal · Quartas/)[0].closest('button')!
    await ue.click(quarta)
    expect(dialog().getByText(/fase seguinte já começou/)).toBeInTheDocument()
    expect(dialog().queryByRole('button', { name: 'Encerrar partida' })).not.toBeInTheDocument()
  })
})

describe('súmula de sets (vôlei) e de colocação (natação)', () => {
  it('sets: adiciona/remove sets; set empatado é recusado com aviso', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    await openTab(ue, /Partidas/)
    await ue.click(screen.getAllByText(/Vôlei · Semifinal/)[0].closest('button')!)
    const fill = async (i: number, a: string, b: string) => {
      await ue.clear(dialog().getByLabelText(`Set ${i} time A`))
      await ue.type(dialog().getByLabelText(`Set ${i} time A`), a)
      await ue.clear(dialog().getByLabelText(`Set ${i} time B`))
      await ue.type(dialog().getByLabelText(`Set ${i} time B`), b)
    }
    await ue.click(dialog().getByRole('button', { name: 'Adicionar set' }))
    await ue.click(dialog().getByRole('button', { name: 'Adicionar set' }))
    await ue.click(dialog().getByRole('button', { name: 'Adicionar set' }))
    await ue.click(dialog().getAllByRole('button', { name: 'Remover set' })[3])
    // sets empatados na contagem: mata-mata sem vencedor
    await fill(1, '25', '20')
    await fill(2, '20', '25')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText('Mata-mata precisa de vencedor')).toBeInTheDocument()
    // um set empatado é inválido mesmo com vencedor
    await fill(3, '15', '15')
    await fill(2, '25', '20')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText(/Set 3 empatado/)).toBeInTheDocument()
    await fill(3, '15', '10')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText('Súmula registrada')).toBeInTheDocument()
  })

  it('colocação: exige todos os tempos válidos e mostra a classificação', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    await openTab(ue, /Chaveamento/)
    await ue.click(screen.getByRole('button', { name: /Natação/ }))
    await ue.click(screen.getByText(/Natação 50m livre · Final/).closest('button')!)
    const inputs = dialog().getAllByPlaceholderText('28.43')
    await ue.click(dialog().getByRole('button', { name: /Salvar ao vivo|Encerrar partida/ }))
    expect(await screen.findByText('Preencha todos os tempos')).toBeInTheDocument()
    for (const [i, input] of inputs.entries()) await ue.type(input, `${30 + i}.5`)
    await ue.clear(inputs[2])
    await ue.type(inputs[2], '1:75')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findAllByText('Preencha todos os tempos')).not.toHaveLength(0)
    await ue.clear(inputs[2])
    await ue.type(inputs[2], '29,9')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText(/vence!/)).toBeInTheDocument()
    expect(matchOf('t1', () => true, 2).status).toBe('encerrada')
  })
})

describe('gestão do torneio', () => {
  it('não conclui com partidas pendentes; otimiza; cancela e a súmula fica bloqueada', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    await openTab(ue, /Gestão/)
    expect(screen.getByRole('button', { name: 'Concluir torneio' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/partidas sem resultado/)
    await ue.click(screen.getByRole('button', { name: /Otimizar agenda/ }))
    expect(await screen.findByText('Agenda otimizada')).toBeInTheDocument()

    await ue.click(screen.getByRole('button', { name: 'Cancelar torneio' }))
    await ue.click(dialog().getByRole('button', { name: 'Voltar' }))
    await ue.click(screen.getByRole('button', { name: 'Cancelar torneio' }))
    await ue.click(dialog().getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Torneio cancelado')).toBeInTheDocument()
    expect(savedTournament('t1').status).toBe('cancelado')
    expect(screen.queryByRole('button', { name: 'Cancelar torneio' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Otimizar agenda/ })).toBeDisabled()

    await openTab(ue, /Partidas/)
    await ue.click(liveMatch())
    expect(dialog().getByText(/Súmulas são registradas com o chaveamento definido/)).toBeInTheDocument()
  })

  it('torneio com conflitos lista os motivos', async () => {
    const { ue } = renderApp('/torneios/t3', ORGANIZER)
    await openTab(ue, /Gestão/)
    expect(screen.getByText('conflitos detectados')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Otimizar agenda/ }))
    expect(await screen.findByText(/conflito\(s\) antes da otimização/)).toBeInTheDocument()
    expect(screen.getByText('Nenhum conflito')).toBeInTheDocument()
  })

  it('exclui o torneio e volta ao painel', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER)
    await openTab(ue, /Gestão/)
    await ue.click(screen.getByRole('button', { name: /Excluir torneio/ }))
    await ue.click(dialog().getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/painel'))
    expect(saved().tournaments.some((t) => t.id === 't2')).toBe(false)
  })

  it('editar torneio: valida e salva nome, datas, espaços e visibilidade', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER)
    await openTab(ue, /Gestão/)
    await ue.click(screen.getByRole('button', { name: /Editar dados/ }))
    const nome = dialog().getByDisplayValue('Circuito Beach Tennis Verão')
    await ue.clear(nome)
    await ue.type(nome, 'Copa Interclasse Horizonte 2026') // nome já usado pelo mesmo organizador
    await ue.click(dialog().getByRole('button', { name: 'Salvar' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Você já tem um torneio com esse nome.')
    await ue.clear(nome)
    await ue.type(nome, 'Circuito Verão 2027')
    await ue.type(dialog().getByDisplayValue(/Duplas mistas/), ' Novidade.')
    await ue.clear(dialog().getByDisplayValue('Ilhéus, BA'))
    await ue.type(dialog().getAllByRole('textbox')[2], 'Porto Seguro, BA')
    await ue.clear(dialog().getByDisplayValue('Arena Litoral'))
    await ue.type(dialog().getAllByRole('textbox')[3], 'Arena Sul')
    const venues = dialog().getByDisplayValue('Quadra Areia 1, Quadra Areia 2')
    await ue.clear(venues)
    await ue.type(venues, 'Quadra A')
    const [inicio, fim] = dialog().getAllByDisplayValue(/2026-12-0/)
    await ue.clear(fim)
    await ue.type(fim, '2026-12-01')
    await ue.click(dialog().getByRole('button', { name: 'Salvar' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('A data final deve ser depois da inicial.')
    await ue.clear(fim)
    await ue.type(fim, '2026-12-09')
    expect(inicio).toHaveValue('2026-12-05')
    await ue.click(dialog().getByRole('button', { name: 'Privado' }))
    await ue.type(dialog().getByLabelText('Código de acesso'), 'sol1')
    await ue.click(dialog().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Torneio atualizado')).toBeInTheDocument()
    expect(savedTournament('t2')).toMatchObject({ name: 'Circuito Verão 2027', city: 'Porto Seguro, BA', venueName: 'Arena Sul', venues: ['Quadra A'], endDate: '2026-12-09', visibility: 'privado', accessCode: 'SOL1' })
    await ue.click(screen.getByRole('button', { name: /Editar dados/ }))
    await ue.click(dialog().getByRole('button', { name: 'Público' }))
    await ue.click(dialog().getByRole('button', { name: 'Cancelar' }))
    expect(savedTournament('t2').visibility).toBe('privado')
  })
})

describe('sorteio e ciclo de vida', () => {
  it('inscrições abertas → sorteio pela chave → iniciar torneio', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER)
    await ue.click(await screen.findByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(dialog().getByText(/6 times · Eliminação simples/)).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(await screen.findByText('Chave sorteada!')).toBeInTheDocument()
    expect(savedTournament('t2').status).toBe('chaveamento')
    await openTab(ue, /Gestão/)
    await ue.click(screen.getByRole('button', { name: 'Iniciar torneio' }))
    expect(savedTournament('t2').status).toBe('andamento')
  })

  it('encerrar inscrições exige 2 times por modalidade; publicar a partir de "em criação"', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER, (s) => ({
      ...s,
      tournaments: s.tournaments.map((t) => (t.id === 't2' ? { ...t, status: 'criacao' as const, modalities: t.modalities.map((m) => ({ ...m, teamIds: m.teamIds.slice(0, 1) })) } : t)),
    }))
    await openTab(ue, /Gestão/)
    await ue.click(screen.getByRole('button', { name: 'Publicar torneio' }))
    expect(await screen.findByRole('button', { name: 'Encerrar inscrições' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Beach Tennis: inscreva ao menos 2 times.')
    await openTab(ue, /Chaveamento/)
    await ue.click(screen.getByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(dialog().getByText(/Inscreva ao menos 2 times/)).toBeInTheDocument()
  })

  it('grupos: escolhe nº de grupos e classificados; avisa resultados descartados', async () => {
    const { ue } = renderApp('/torneios/t3', ORGANIZER)
    await openTab(ue, /Gestão/)
    await ue.click(screen.getByRole('button', { name: 'Sortear' }))
    expect(dialog().getByText(/partida\(s\) já disputada\(s\)/)).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: '1' }))
    expect(dialog().getByRole('button', { name: 'Só o 1º' })).toBeDisabled()
    expect(dialog().getByText(/grupo único/)).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: '4' }))
    await ue.click(dialog().getByRole('button', { name: 'Só o 1º' }))
    expect(dialog().getByText('4 times avançam ao mata-mata.')).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: 'Cancelar' }))
    await ue.click(screen.getByRole('button', { name: 'Sortear' }))
    await ue.click(dialog().getByRole('button', { name: '3' }))
    await ue.click(dialog().getByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(await screen.findByText('Chave sorteada!')).toBeInTheDocument()
    expect(savedTournament('t3').modalities[0].groups).toHaveLength(3)
    await openTab(ue, /Chaveamento/)
    expect(screen.getAllByText('1º Grupo A').length).toBeGreaterThan(0)
  })
})

describe('reagendamento manual', () => {
  it('mostra conflitos, salva horário livre, fixa e libera', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER)
    await ue.click(await screen.findByRole('button', { name: /Sortear e gerar jogos/ }))
    await ue.click(dialog().getByRole('button', { name: /Sortear e gerar jogos/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await openTab(ue, /Partidas/)
    const [primeira, segunda] = savedTournament('t2').modalities[0].matches.filter((m) => !m.bye && m.a && m.b)
    await ue.click(screen.getAllByText(/Beach Tennis · Quartas/)[1].closest('button')!)
    await ue.click(dialog().getByRole('button', { name: 'Reagendar' }))
    await ue.click(dialog().getByRole('button', { name: 'Cancelar' }))
    await ue.click(dialog().getByRole('button', { name: 'Reagendar' }))
    const alvo = savedTournament('t2').modalities[0].matches.find((m) => m.id === segunda.id)!
    const outro = alvo.id === primeira.id ? segunda : primeira
    await ue.selectOptions(dialog().getByLabelText('Data'), outro.date!)
    await ue.selectOptions(dialog().getByLabelText('Horário'), outro.time!)
    await ue.selectOptions(dialog().getByLabelText('Local'), outro.venue!)
    await ue.selectOptions(dialog().getByLabelText('Árbitro'), outro.referee!)
    expect(dialog().getByRole('alert')).toHaveTextContent(/já recebe outra partida/)
    expect(dialog().getByRole('button', { name: 'Salvar horário' })).toBeDisabled()
    await ue.selectOptions(dialog().getByLabelText('Data'), '2026-12-05')
    await ue.selectOptions(dialog().getByLabelText('Horário'), '20:00')
    expect(dialog().getByText('Horário livre: sem conflitos.')).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: 'Salvar horário' }))
    expect(await screen.findByText('Partida reagendada')).toBeInTheDocument()
    expect(dialog().getByText('Horário fixado')).toBeInTheDocument()
    await ue.click(dialog().getByRole('button', { name: /Liberar para otimização/ }))
    expect(await screen.findByText('Horário liberado')).toBeInTheDocument()
    expect(savedTournament('t2').modalities[0].matches.some((m) => m.pinned)).toBe(false)
  })
})

describe('tabela de grupos e chave', () => {
  it('passar o mouse num time destaca o caminho', async () => {
    const { ue } = renderApp('/torneios/t1', ORGANIZER)
    const leoes = (await screen.findAllByText('Leões do Norte'))[0]
    await ue.hover(leoes)
    await ue.unhover(leoes)
    // clicar numa partida da chave abre a súmula
    await ue.click(leoes.closest('button')!)
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: /Súmula/ })).toBeInTheDocument()
  })
})
