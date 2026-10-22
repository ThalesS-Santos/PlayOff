import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CODE_LOCK_MS } from '../lib/permissions'
import { dialog, ORGANIZER, renderApp, saved, SPECTATOR } from './utils'
import { FAKE_TIMERS } from './setup'

describe('login (RF07) e rotas protegidas', () => {
  it('sem login, qualquer rota leva à tela de entrada', async () => {
    renderApp('/painel')
    expect(await screen.findByText('Entrar como')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('entra como organizador com o nome digitado', async () => {
    const { ue } = renderApp('/')
    await ue.clear(screen.getByLabelText('Seu nome'))
    await ue.type(screen.getByLabelText('Seu nome'), 'Ana Lima')
    await ue.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByText(/Olá, Ana/)).toBeInTheDocument()
    expect(saved().user).toMatchObject({ id: ORGANIZER.id, name: 'Ana Lima', role: 'organizador' })
    expect(screen.getByRole('link', { name: /Meu painel/ })).toBeInTheDocument()
  })

  it('entra como espectador; nome vazio usa o padrão', async () => {
    const { ue } = renderApp('/')
    await ue.click(screen.getByRole('button', { name: /Espectador/ }))
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Visitante')
    await ue.clear(screen.getByLabelText('Seu nome'))
    await ue.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByText(/Olá, Visitante/)).toBeInTheDocument()
    // e volta para organizador mostra o nome de exemplo
    expect(saved().user?.role).toBe('espectador')
  })

  it('o painel do herói reage ao mouse sem erros', async () => {
    const { ue, container } = renderApp('/')
    const hero = container.querySelector('[class*="perspective"]') as HTMLElement
    await ue.pointer({ target: hero, coords: { clientX: 10, clientY: 10 } })
    await ue.unhover(hero)
    await ue.click(screen.getByRole('button', { name: /Organizador/ }))
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Thales Sena')
  })

  it.each(['/criar', '/painel', '/identidade'])('espectador não acessa %s', async (path) => {
    renderApp(path, SPECTATOR)
    expect(await screen.findByText('Explore torneios')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/torneios')
  })

  it('espectador não vê ações de organizador', async () => {
    renderApp('/torneios', SPECTATOR)
    await screen.findByText('Explore torneios')
    expect(screen.queryByRole('button', { name: /Criar torneio/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Meu painel/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Identidade/ })).not.toBeInTheDocument()
  })

  it('rota desconhecida volta ao catálogo', async () => {
    renderApp('/qualquer-coisa', SPECTATOR)
    expect(await screen.findByText('Explore torneios')).toBeInTheDocument()
  })

  it('menu do usuário: favoritos, restaurar demonstração e sair', async () => {
    const { ue } = renderApp('/torneios', ORGANIZER, (s) => ({ ...s, tournaments: s.tournaments.filter((t) => t.id !== 't1') }))
    const menu = async (item: RegExp) => {
      await ue.click(screen.getByRole('button', { name: 'Menu do usuário' }))
      await ue.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
    }
    await screen.findByText('Explore torneios')
    await menu(/Restaurar demonstração/)
    expect(await screen.findByText('Dados de demonstração restaurados')).toBeInTheDocument()
    expect(saved().tournaments.some((t) => t.id === 't1')).toBe(true)

    await menu(/Criar torneio/)
    expect(await screen.findByRole('heading', { name: 'Criar torneio' })).toBeInTheDocument()

    await menu(/Meus favoritos/)
    expect(await screen.findByText('Seus favoritos')).toBeInTheDocument()

    await menu(/Sair/)
    expect(await screen.findByText('Entrar como')).toBeInTheDocument()
    expect(saved().user).toBeNull()
  })

  it('clicar fora fecha o menu do usuário', async () => {
    const { ue } = renderApp('/torneios', SPECTATOR)
    await ue.click(await screen.findByRole('button', { name: 'Menu do usuário' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await ue.click(document.querySelector('div.fixed.inset-0') as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })
})

describe('catálogo (acessar torneio)', () => {
  it('lista, busca e filtra', async () => {
    const { ue } = renderApp('/torneios', SPECTATOR)
    expect(await screen.findByText('Copa Interclasse Horizonte 2026')).toBeInTheDocument()
    await ue.type(screen.getByPlaceholderText(/Buscar/), 'beach')
    expect(screen.getByText('Circuito Beach Tennis Verão')).toBeInTheDocument()
    expect(screen.queryByText('Copa Interclasse Horizonte 2026')).not.toBeInTheDocument()
    await ue.clear(screen.getByPlaceholderText(/Buscar/))
    await ue.type(screen.getByPlaceholderText(/Buscar/), 'zzz')
    expect(screen.getByText('Nada encontrado')).toBeInTheDocument()
    await ue.clear(screen.getByPlaceholderText(/Buscar/))

    await ue.click(screen.getByRole('button', { name: 'Finalizados' }))
    expect(screen.getByText('Copa Bairro Basquete 3x3')).toBeInTheDocument()
    expect(screen.queryByText('Circuito Beach Tennis Verão')).not.toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: 'Inscrições abertas' }))
    expect(screen.getByText('Circuito Beach Tennis Verão')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: 'Ao vivo' }))
    expect(screen.getByText('Copa Interclasse Horizonte 2026')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Favoritos/ }))
    // o espectador da demonstração já favoritou o basquete
    expect(screen.getByText('Copa Bairro Basquete 3x3')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: 'Todos' }))
    expect(document.querySelectorAll('article')).toHaveLength(4)
  })

  it('favoritar pelo cartão e ver em Meus favoritos', async () => {
    const { ue } = renderApp('/favoritos', SPECTATOR, (s) => ({ ...s, tournaments: s.tournaments.map((t) => ({ ...t, favoritedBy: [] })) }))
    expect(await screen.findByText('Nenhum favorito ainda')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: 'Ver todos' }))
    const card = screen.getByText('Circuito Beach Tennis Verão').closest('article')!
    await ue.click(within(card).getByRole('button', { name: 'Favoritar torneio' }))
    expect(await screen.findByText('Adicionado aos favoritos')).toBeInTheDocument()
    expect(saved().tournaments.find((t) => t.id === 't2')!.favoritedBy).toEqual([SPECTATOR.id])
    // o clique no coração não abre o torneio
    expect(window.location.pathname).toBe('/favoritos')
    await ue.click(within(card).getByRole('button', { name: 'Remover dos favoritos' }))
    expect(await screen.findByText('Removido dos favoritos')).toBeInTheDocument()
  })

  it('catálogo vazio', async () => {
    renderApp('/torneios', SPECTATOR, (s) => ({ ...s, tournaments: [] }))
    expect(await screen.findByText('Nenhum torneio')).toBeInTheDocument()
  })

  it('abre torneio público pelo clique e pelo teclado; efeito de inclinação do cartão', async () => {
    const { ue } = renderApp('/torneios', SPECTATOR)
    const card = (await screen.findByText('Circuito Beach Tennis Verão')).closest('article')!
    await ue.pointer({ target: card, coords: { clientX: 5, clientY: 5 } })
    await ue.unhover(card)
    card.focus()
    await ue.keyboard('{Enter}')
    expect(window.location.pathname).toBe('/torneios/t2')
  })

  it('torneio inexistente mostra "Torneio não encontrado"', async () => {
    const { ue } = renderApp('/torneios/nao-existe', SPECTATOR)
    expect(await screen.findByText('Torneio não encontrado')).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: 'Buscar torneios' }))
    expect(window.location.pathname).toBe('/torneios')
  })
})

describe('torneio privado (RN03)', () => {
  it('pede código; erro, acerto e acesso liberado depois', async () => {
    const { ue } = renderApp('/torneios', SPECTATOR)
    await ue.click((await screen.findByText('Liga Corporativa Society')).closest('article')!)
    expect(dialog().getByText(/Peça o código/)).toBeInTheDocument()
    // a dica com o código não aparece mais para o público
    expect(screen.queryByText(/PLAY2026/)).not.toBeInTheDocument()
    await ue.type(dialog().getByLabelText('Código de acesso'), 'errado{Enter}')
    expect(dialog().getByRole('alert')).toHaveTextContent('Código incorreto')
    await ue.clear(dialog().getByLabelText('Código de acesso'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await ue.type(dialog().getByLabelText('Código de acesso'), 'play2026')
    await ue.click(dialog().getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/torneios/t3'))
    expect(saved().unlocked).toEqual(['t3'])
    expect(await screen.findByRole('heading', { name: 'Liga Corporativa Society' })).toBeInTheDocument()
  })

  it('desistir fecha e limpa', async () => {
    const { ue } = renderApp('/torneios', SPECTATOR)
    await ue.click((await screen.findByText('Liga Corporativa Society')).closest('article')!)
    await ue.type(dialog().getByLabelText('Código de acesso'), 'x{Enter}')
    await ue.click(dialog().getByRole('button', { name: 'Desistir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await ue.click(screen.getByText('Liga Corporativa Society').closest('article')!)
    expect(dialog().getByLabelText('Código de acesso')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('bloqueia após 5 tentativas erradas', async () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const { ue } = renderApp('/torneios/t3', SPECTATOR)
    const input = await screen.findByLabelText('Código de acesso')
    for (let i = 0; i < 5; i++) {
      await ue.clear(input)
      await ue.type(input, `erro${i}{Enter}`)
    }
    expect(screen.getByRole('alert')).toHaveTextContent(/Muitas tentativas/)
    await ue.clear(input)
    await ue.type(input, 'PLAY2026{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/Muitas tentativas/)
    act(() => vi.advanceTimersByTime(CODE_LOCK_MS))
    await ue.clear(input)
    await ue.type(input, 'PLAY2026{Enter}')
    expect(await screen.findByRole('heading', { name: 'Liga Corporativa Society' })).toBeInTheDocument()
  })

  it('link direto de torneio privado: desistir volta ao catálogo', async () => {
    const { ue } = renderApp('/torneios/t3', SPECTATOR)
    await ue.click(await screen.findByRole('button', { name: 'Desistir' }))
    await waitFor(() => expect(window.location.pathname).toBe('/torneios'))
  })

  it('o dono entra sem código e vê o código na gestão', async () => {
    const { ue } = renderApp('/torneios/t3', ORGANIZER)
    expect(await screen.findByRole('heading', { name: 'Liga Corporativa Society' })).toBeInTheDocument()
    await ue.click(screen.getByRole('button', { name: /Gestão/ }))
    expect(screen.getByText(/Código de acesso: PLAY2026/)).toBeInTheDocument()
  })
})
