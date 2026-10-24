import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ORGANIZER, renderApp, saved } from './utils'
import { FAKE_TIMERS } from './setup'

describe('assistente "Criar torneio" (RF01)', () => {
  it('valida cada passo e cria o torneio com chave e agenda', async () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const { ue } = renderApp('/criar', ORGANIZER)
    await screen.findByRole('heading', { name: 'Criar torneio' })
    const next = () => ue.click(screen.getByRole('button', { name: /Continuar/ }))

    // passo 1: dados
    await next()
    expect(screen.getByText(/Dê um nome ao torneio/)).toBeInTheDocument()
    await ue.type(screen.getByPlaceholderText(/Copa da Primavera/), 'Copa Interclasse Horizonte 2026')
    const [venues, refs] = [screen.getByDisplayValue('Quadra 1, Quadra 2'), screen.getByDisplayValue(/Ana Prado/)]
    await ue.clear(venues)
    await ue.clear(refs)
    await ue.click(screen.getByRole('button', { name: /Privado/ }))
    await next()
    for (const msg of ['Você já tem um torneio com esse nome.', 'Informe ao menos uma quadra ou espaço.', 'Torneio privado precisa de um código com 4+ caracteres.', 'Informe ao menos um árbitro.'])
      expect(screen.getByText(new RegExp(msg.replace(/[.+]/g, '\\$&')))).toBeInTheDocument()
    await ue.clear(screen.getByPlaceholderText(/Copa da Primavera/))
    await ue.type(screen.getByPlaceholderText(/Copa da Primavera/), 'Jogos da Primavera')
    await ue.type(screen.getByPlaceholderText(/Conte do que/), 'Torneio de teste')
    await ue.type(venues, 'Quadra A, Quadra B')
    await ue.type(refs, 'Ana, Caio')
    await ue.type(screen.getByPlaceholderText('Código de acesso'), 'prima')
    await ue.click(screen.getAllByRole('button', { name: 'Escolher capa' })[2])
    await next()

    // passo 2: modalidades
    await next()
    expect(screen.getByText(/Adicione pelo menos uma modalidade/)).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Futsal/ }))
    await ue.click(screen.getByRole('button', { name: /Vôlei/ }))
    await ue.click(screen.getByRole('button', { name: /Natação/ }))
    await ue.click(screen.getByRole('button', { name: /Basquete/ }))
    await ue.click(screen.getAllByRole('button', { name: 'Remover modalidade' })[3])
    const [catFutsal, formatoFutsal] = screen.getAllByRole('combobox')
    await ue.selectOptions(catFutsal, 'Misto')
    await ue.selectOptions(formatoFutsal, 'grupos_mata')
    await ue.type(screen.getAllByPlaceholderText(/Dupla, quarteto/)[1], 'Dupla')
    await next()

    // passo 3: equipes
    await next()
    expect(screen.getByText(/Futsal: inscreva ao menos 2 equipes/)).toBeInTheDocument()
    const [exFutsal, exVolei] = screen.getAllByRole('button', { name: /Preencher exemplo/ })
    await ue.click(exFutsal)
    await ue.click(exVolei)
    const inputs = screen.getAllByPlaceholderText('Nome da equipe e Enter')
    await ue.type(inputs[2], 'Golfinhos{Enter}')
    await ue.type(inputs[2], 'golfinhos{Enter}') // repetido (sem diferenciar maiúsculas) é ignorado
    await ue.type(inputs[2], '{Enter}')
    await ue.type(inputs[2], 'Orcas')
    await ue.click(screen.getAllByRole('button', { name: 'Adicionar' })[2])
    await ue.click(screen.getAllByTitle('Alternar cabeça de chave')[0]) // Águias cabeça 1
    await ue.click(screen.getAllByTitle('Alternar cabeça de chave')[1])
    await ue.click(screen.getAllByTitle('Alternar cabeça de chave')[1]) // desmarca
    await ue.click(screen.getAllByRole('button', { name: 'Remover Titãs' })[0])
    await next()

    // passo 4: prêmios
    await ue.click(screen.getByRole('button', { name: /Adicionar prêmio/ }))
    await next()
    expect(screen.getByText(/Prêmio 2: Informe o nome do prêmio/)).toBeInTheDocument()
    await ue.type(screen.getByLabelText('Nome do prêmio 2'), 'Melhor goleiro')
    await ue.selectOptions(screen.getByLabelText('Tipo do prêmio 2'), 'individual')
    await ue.selectOptions(screen.getByLabelText('Modalidade do prêmio 1'), screen.getByLabelText('Modalidade do prêmio 1').querySelectorAll('option')[1])
    await ue.type(screen.getByLabelText('Valor do prêmio 2'), '50')
    await ue.click(screen.getByRole('button', { name: /Adicionar prêmio/ }))
    await ue.click(screen.getByRole('button', { name: 'Remover prêmio 3' }))
    await next()

    // passo 5: revisão — volta um passo pelo indicador e retorna
    expect(screen.getByText('Privado (PRIMA)')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Voltar/ }))
    await next()
    await ue.click(screen.getByRole('button', { name: /Dados/ })) // passo "Dados" pelo indicador
    expect(screen.getByDisplayValue('Jogos da Primavera')).toBeInTheDocument()
    for (let i = 0; i < 4; i++) await next()
    await ue.click(within(screen.getByRole('main')).getByRole('button', { name: /Criar torneio/ }))
    expect(await screen.findByText('Torneio criado!')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(1500))
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/torneios\/t_/))

    const t = saved().tournaments[0]
    expect(t).toMatchObject({ name: 'Jogos da Primavera', visibility: 'privado', accessCode: 'PRIMA', status: 'chaveamento', venues: ['Quadra A', 'Quadra B'], referees: ['Ana', 'Caio'] })
    expect(t.modalities.map((m) => m.sport)).toEqual(['Futsal', 'Vôlei', 'Natação'])
    expect(t.modalities.every((m) => m.matches.length > 0)).toBe(true)
    expect(t.prizes).toMatchObject([{ modalityId: t.modalities[0].id }, { name: 'Melhor goleiro', kind: 'individual', value: 50 }])
    expect(t.modalities[0].seeds).toHaveLength(1)
    // o fluxo inteiro do assistente leva ~14 s sozinho; com a máquina carregada passava dos 20 s padrão
  }, 60_000)

  it('sem sortear agora: publica com inscrições abertas; cancelar volta', async () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const { ue } = renderApp('/criar', ORGANIZER)
    await ue.type(await screen.findByPlaceholderText(/Copa da Primavera/), 'Torneio Relâmpago')
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Beach Tennis/ }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Preencher exemplo/ }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: 'Remover prêmio 1' }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('checkbox'))
    await ue.click(within(screen.getByRole('main')).getByRole('button', { name: /Criar torneio/ }))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(saved().tournaments[0]).toMatchObject({ name: 'Torneio Relâmpago', status: 'publicado', prizes: [] })
    expect(saved().tournaments[0].modalities[0].matches).toEqual([])

    await ue.click(screen.getByRole('link', { name: /Meu painel/ }))
    await ue.click(await screen.findByRole('button', { name: /Novo torneio/ }))
    await ue.click(await screen.findByRole('button', { name: /Cancelar/ }))
    await waitFor(() => expect(window.location.pathname).toBe('/painel'))
  })
})

describe('painel do organizador', () => {
  it('lista só os torneios do organizador, conflitos e próximos jogos', async () => {
    const { ue } = renderApp('/painel', ORGANIZER)
    expect(await screen.findByText('Seus torneios')).toBeInTheDocument()
    expect(screen.getByText('Liga Corporativa Society')).toBeInTheDocument()
    expect(screen.queryByText('Copa Bairro Basquete 3x3')).not.toBeInTheDocument() // de outro organizador
    expect(screen.getByText(/conflito\(s\)/)).toBeInTheDocument()
    expect(screen.getByText('Próximos jogos')).toBeInTheDocument()
    await ue.click(screen.getAllByText('Copa Interclasse Horizonte 2026')[0].closest('button')!)
    expect(window.location.pathname).toBe('/torneios/t1')
  })

  it('sem torneios e sem jogos', async () => {
    const { ue } = renderApp('/painel', ORGANIZER, (s) => ({ ...s, tournaments: [] }))
    expect(await screen.findByText('Você ainda não criou torneios')).toBeInTheDocument()
    expect(screen.getByText('Nenhum jogo agendado.')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: 'Criar o primeiro' }))
    expect(await screen.findByRole('heading', { name: 'Criar torneio' })).toBeInTheDocument()
  })

  it('próximo jogo leva ao torneio', async () => {
    const { ue } = renderApp('/painel', ORGANIZER)
    const proximos = (await screen.findByText('Próximos jogos')).closest('section')!
    await ue.click(proximos.querySelector('button')!)
    expect(window.location.pathname).toMatch(/^\/torneios\/t\d/)
  })
})

describe('identidade visual (RF06)', () => {
  it('altera nome, sigla e cor da organização', async () => {
    const { ue } = renderApp('/identidade', ORGANIZER)
    expect(await screen.findByRole('heading', { name: 'Identidade visual' })).toBeInTheDocument()
    const nome = screen.getByDisplayValue('Liga Horizonte')
    await ue.clear(nome)
    await ue.type(nome, 'Liga Nova')
    const sigla = screen.getByDisplayValue('LH')
    await ue.clear(sigla)
    await ue.type(sigla, 'ln')
    await ue.click(screen.getByRole('button', { name: 'Coral' }))
    expect(document.documentElement.style.getPropertyValue('--brand-h')).toBe('30')
    const range = screen.getByLabelText('Matiz personalizado')
    // range: simula o arraste com um evento de mudança
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(range, '200')
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await ue.click(screen.getByRole('button', { name: /Salvar identidade/ }))
    expect(await screen.findByText('Identidade salva')).toBeInTheDocument()
    expect(saved().orgs.find((o) => o.id === 'o1')).toMatchObject({ name: 'Liga Nova', short: 'LN', hue: 200 })
  })

  it('campos vazios mantêm os valores anteriores; ao sair a cor volta à salva', async () => {
    const { ue, unmount } = renderApp('/identidade', ORGANIZER)
    await ue.clear(await screen.findByDisplayValue('Liga Horizonte'))
    await ue.clear(screen.getByDisplayValue('LH'))
    await ue.click(screen.getByRole('button', { name: 'Grama' }))
    await ue.click(screen.getByRole('button', { name: /Salvar identidade/ }))
    expect(saved().orgs.find((o) => o.id === 'o1')).toMatchObject({ name: 'Liga Horizonte', short: 'LH', hue: 150 })
    unmount()
    expect(document.documentElement.style.getPropertyValue('--brand-h')).toBe('150')
  })
})
