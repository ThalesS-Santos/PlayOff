import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { dialog, ORGANIZER, renderApp, savedTournament } from './utils'

const openCadastros = async (path = '/torneios/t2') => {
  const r = renderApp(path, ORGANIZER)
  await r.ue.click(await screen.findByRole('button', { name: /Cadastros/ }))
  return r
}

describe('cadastro de times (RF02)', () => {
  it('valida, cadastra com elenco, cor, sigla e inscrição', async () => {
    const { ue } = await openCadastros()
    await ue.click(screen.getByRole('button', { name: /Novo time/ }))
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar time' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Informe o nome do time.')

    await ue.type(dialog().getByPlaceholderText(/Águias/), 'Sol & Mar') // nome já existente
    expect(dialog().getByDisplayValue('SOL')).toBeInTheDocument() // sigla sugerida
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar time' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Já existe um time com esse nome.')

    const nome = dialog().getByPlaceholderText(/Águias/)
    await ue.clear(nome)
    await ue.type(nome, 'Maresia FC')
    const sigla = dialog().getByDisplayValue('MAR')
    await ue.clear(sigla)
    await ue.type(sigla, 'msa')
    await ue.type(nome, ' 2') // sigla editada à mão não muda mais sozinha
    expect(sigla).toHaveValue('MSA')
    await ue.type(dialog().getByPlaceholderText('Nome do técnico(a)'), 'Rita Melo')
    await ue.click(dialog().getByRole('button', { name: 'Cor #3b82f6' }))
    // torneio com uma só modalidade aberta: o time novo já vem inscrito nela
    expect(dialog().getByRole('button', { name: /Beach Tennis/ }).className).toMatch(/ring-brand/)

    await ue.click(dialog().getByRole('button', { name: /Adicionar atleta/ }))
    await ue.click(dialog().getByRole('button', { name: /Adicionar atleta/ }))
    await ue.click(dialog().getByRole('button', { name: /Adicionar atleta/ }))
    await ue.type(dialog().getByLabelText('Nome do atleta 1'), 'Lia')
    await ue.type(dialog().getByLabelText('Apelido do atleta 1'), 'Lilica')
    await ue.type(dialog().getByLabelText('Nome do atleta 2'), 'Rui')
    await ue.clear(dialog().getByLabelText('Camisa do atleta 2'))
    await ue.type(dialog().getByLabelText('Camisa do atleta 2'), '1')
    await ue.click(dialog().getByRole('button', { name: 'Remover atleta 3' }))
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar time' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Rui: camisa 1 repetida.')
    await ue.clear(dialog().getByLabelText('Camisa do atleta 2'))
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar time' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Rui: número da camisa deve ser de 0 a 99.')
    await ue.type(dialog().getByLabelText('Camisa do atleta 2'), '9')
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar time' }))

    expect(await screen.findByText('Time cadastrado')).toBeInTheDocument()
    const t = savedTournament('t2')
    const novo = t.teams.find((x) => x.name === 'Maresia FC 2')!
    expect(novo).toMatchObject({ short: 'MSA', coach: 'Rita Melo', color: '#3b82f6' })
    expect(novo.players).toMatchObject([{ name: 'Lia', nickname: 'Lilica', number: 1 }, { name: 'Rui', number: 9 }])
    expect(t.modalities[0].teamIds).toContain(novo.id)
  })

  it('edita, marca cabeça de chave e exclui; cancelar não salva', async () => {
    const { ue } = await openCadastros()
    await ue.click(screen.getByRole('button', { name: 'Editar Ondas' }))
    await ue.clear(dialog().getByDisplayValue('Ondas'))
    await ue.type(dialog().getByPlaceholderText(/Águias/), 'Ondas Bravas')
    await ue.click(dialog().getByRole('button', { name: 'Cancelar' }))
    expect(savedTournament('t2').teams.some((x) => x.name === 'Ondas Bravas')).toBe(false)

    await ue.click(screen.getByRole('button', { name: 'Editar Ondas' }))
    await ue.clear(dialog().getByDisplayValue('Ondas'))
    await ue.type(dialog().getByPlaceholderText(/Águias/), 'Ondas Bravas')
    await ue.click(dialog().getByRole('button', { name: /Beach Tennis/ })) // desinscreve
    await ue.click(dialog().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Time atualizado')).toBeInTheDocument()
    expect(screen.getByText('Não inscrito em nenhuma modalidade')).toBeInTheDocument()

    // cabeça de chave: clique alterna e mostra a posição
    const card = screen.getByText('Coqueiros').closest('li')!
    await ue.click(within(card).getByRole('button', { name: /Beach Tennis/ }))
    expect(within(card).getByText('#3')).toBeInTheDocument()
    await ue.click(within(card).getByRole('button', { name: /Beach Tennis/ }))
    expect(within(card).queryByText('#3')).not.toBeInTheDocument()

    await ue.click(screen.getByRole('button', { name: 'Excluir Coqueiros' }))
    await ue.click(dialog().getByRole('button', { name: 'Voltar' }))
    await ue.click(screen.getByRole('button', { name: 'Excluir Coqueiros' }))
    await ue.click(dialog().getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Time excluído')).toBeInTheDocument()
    expect(savedTournament('t2').teams.some((x) => x.name === 'Coqueiros')).toBe(false)
  })

  it('time com jogos gerados: inscrição travada e exclusão bloqueada', async () => {
    const { ue } = await openCadastros('/torneios/t1')
    const card = screen.getByText('Leões do Norte').closest('li')!
    expect(within(card).getByRole('button', { name: /Futsal/ })).toBeDisabled()
    await ue.click(within(card).getByRole('button', { name: 'Excluir Leões do Norte' }))
    expect(dialog().getByText(/já tem jogos gerados em Futsal/)).toBeInTheDocument()
    expect(dialog().getByRole('button', { name: 'Excluir' })).toBeDisabled()
    await ue.keyboard('{Escape}')
    // novo time num torneio já sorteado: não dá para inscrever
    await ue.click(screen.getByRole('button', { name: /Novo time/ }))
    const travadas = dialog().getAllByTitle(/Jogos já gerados/)
    expect(travadas).toHaveLength(3)
    for (const b of travadas) expect(b).toBeDisabled()
  })

  it('torneio sem times mostra estado vazio', async () => {
    const { ue } = renderApp('/torneios/t2', ORGANIZER, (s) => ({
      ...s,
      tournaments: s.tournaments.map((t) => (t.id === 't2' ? { ...t, teams: [], modalities: t.modalities.map((m) => ({ ...m, teamIds: [], seeds: [] })) } : t)),
    }))
    await ue.click(await screen.findByRole('button', { name: /Cadastros/ }))
    expect(screen.getByText('Nenhum time cadastrado')).toBeInTheDocument()
    // com uma única modalidade aberta, o time novo já vem inscrito nela
    await ue.click(screen.getByRole('button', { name: /Novo time/ }))
    expect(dialog().getByRole('button', { name: /Beach Tennis/ }).className).toMatch(/ring-brand/)
  })
})

describe('árbitros', () => {
  it('cadastra, recusa duplicado e remove quem não está escalado', async () => {
    const { ue } = await openCadastros()
    await ue.click(screen.getByRole('button', { name: 'Adicionar árbitro' }))
    expect(screen.getByText('Informe o nome do árbitro.')).toBeInTheDocument()
    await ue.type(screen.getByLabelText('Nome do árbitro'), 'paula reis{Enter}')
    expect(screen.getByText('Árbitro já cadastrado.')).toBeInTheDocument()
    await ue.clear(screen.getByLabelText('Nome do árbitro'))
    await ue.type(screen.getByLabelText('Nome do árbitro'), 'Caio Nunes{Enter}')
    expect(await screen.findByText('Árbitro cadastrado')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do árbitro')).toHaveValue('')
    await ue.click(screen.getByRole('button', { name: 'Remover Caio Nunes' }))
    expect(savedTournament('t2').referees).toEqual(['Paula Reis', 'Diego Matos'])
  })

  it('árbitro escalado em partida pendente não pode ser removido', async () => {
    await openCadastros('/torneios/t1')
    const escalado = savedTournament('t1').modalities.flatMap((m) => m.matches).find((m) => m.status !== 'encerrada' && m.referee)!.referee!
    expect(screen.getByRole('button', { name: `Remover ${escalado}` })).toBeDisabled()
  })
})

describe('prêmios', () => {
  it('cadastra coletivo e individual, edita, valida e remove', async () => {
    const { ue } = await openCadastros('/torneios/t1')
    await ue.click(screen.getByRole('button', { name: /Novo prêmio/ }))
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar prêmio' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Informe o nome do prêmio.')
    await ue.type(dialog().getByPlaceholderText(/Troféu de campeão/), 'Bronze Vôlei')
    const selects = dialog().getAllByRole('combobox')
    await ue.selectOptions(selects[1], 't1m2')
    await ue.selectOptions(selects[2], '3')
    await ue.type(dialog().getByPlaceholderText('Opcional'), '-5')
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar prêmio' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Valor não pode ser negativo.')
    await ue.clear(dialog().getByPlaceholderText('Opcional'))
    await ue.type(dialog().getByPlaceholderText('Opcional'), '200')
    await ue.click(dialog().getByRole('button', { name: 'Cadastrar prêmio' }))
    expect(await screen.findByText('Prêmio cadastrado')).toBeInTheDocument()
    expect(savedTournament('t1').prizes.find((p) => p.name === 'Bronze Vôlei')).toMatchObject({ kind: 'coletivo', modalityId: 't1m2', place: 3, value: 200 })

    await ue.click(screen.getByRole('button', { name: 'Editar Artilheiro da Copa' }))
    expect(dialog().queryByText('Colocação')).not.toBeInTheDocument() // individual: sem colocação
    await ue.type(dialog().getByPlaceholderText('Nome do atleta'), 'Lucas Silva (Dragões)')
    await ue.clear(dialog().getByPlaceholderText('Opcional'))
    await ue.click(dialog().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Prêmio atualizado')).toBeInTheDocument()
    expect(screen.getByText('Entregue a Lucas Silva (Dragões)')).toBeInTheDocument()
    expect(savedTournament('t1').prizes.find((p) => p.id === 'pz4')!.value).toBeUndefined()

    await ue.click(screen.getByRole('button', { name: 'Editar Medalhas de Prata' }))
    await ue.selectOptions(dialog().getAllByRole('combobox')[0], 'individual')
    await ue.click(dialog().getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await ue.click(screen.getByRole('button', { name: 'Excluir Bronze Vôlei' }))
    expect(await screen.findByText('Prêmio removido')).toBeInTheDocument()
    expect(savedTournament('t1').prizes.some((p) => p.name === 'Bronze Vôlei')).toBe(false)
  })

  it('torneio sem prêmios', async () => {
    renderApp('/torneios/t2', ORGANIZER, (s) => ({ ...s, tournaments: s.tournaments.map((t) => (t.id === 't2' ? { ...t, prizes: [] } : t)) }))
    const { ue } = { ue: (await import('@testing-library/user-event')).default.setup() }
    await ue.click(await screen.findByRole('button', { name: /Cadastros/ }))
    expect(screen.getByText('Nenhum prêmio cadastrado.')).toBeInTheDocument()
  })
})
