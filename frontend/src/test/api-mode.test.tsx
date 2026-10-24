import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { SESSION_KEY } from '../lib/state'
import { API_URL, startApi } from './api-server'
import { dialog } from './utils'

/** Abre o app no modo API, já logado (ou na tela de login, sem e-mail). */
async function renderApi(path = '/', email?: string) {
  const api = await startApi()
  if (email) localStorage.setItem(SESSION_KEY, JSON.stringify(await api.login(email)))
  window.history.pushState({}, '', path)
  const ue = userEvent.setup()
  render(createElement(App, { apiUrl: API_URL, fetchImpl: api.fetchImpl }))
  const token = () => (JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { token: string } | null)?.token
  return { ue, api, token }
}

describe('modo API: login e cadastro (RF07)', () => {
  it('senha errada mostra o erro do servidor; a certa entra e guarda a sessão', async () => {
    const { ue, token } = await renderApi('/')
    expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true')
    await ue.type(screen.getByLabelText('E-mail'), 'organizador@playoff.dev')
    await ue.type(screen.getByLabelText('Senha'), 'errada')
    await ue.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
    expect(token()).toBeUndefined()
    await ue.clear(screen.getByLabelText('Senha'))
    await ue.type(screen.getByLabelText('Senha'), 'playoff123')
    await ue.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByText('Explore torneios')).toBeInTheDocument()
    expect(document.querySelectorAll('article')).toHaveLength(4)
    expect(token()).toBeTruthy()
  })

  it('cria conta de organizador com organização; dados inválidos mostram a mensagem da API', async () => {
    const { ue, api, token } = await renderApi('/')
    await ue.click(screen.getByRole('tab', { name: 'Criar conta' }))
    await ue.click(screen.getByRole('button', { name: /Organizador/ }))
    await ue.type(screen.getByLabelText('Seu nome'), 'Ana Lima')
    await ue.type(screen.getByLabelText('Nome da organização'), 'Liga da Ana')
    await ue.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
    await ue.type(screen.getByLabelText('Senha'), '123')
    await ue.click(screen.getByRole('button', { name: /^Criar conta/ }))
    expect(await screen.findByText('A senha precisa de ao menos 8 caracteres.')).toBeInTheDocument()
    await ue.type(screen.getByLabelText('Senha'), '45678')
    await ue.click(screen.getByRole('button', { name: /^Criar conta/ }))
    expect(await screen.findByRole('link', { name: /Meu painel/ })).toBeInTheDocument()
    const me = (await api.call('GET', '/me', token())).json()
    expect(me.user).toMatchObject({ name: 'Ana Lima', role: 'organizador' })
    expect((await api.call('GET', '/organizacoes')).json().some((o: { name: string }) => o.name === 'Liga da Ana')).toBe(true)
  })

  it('espectador se cadastra sem organização', async () => {
    const { ue } = await renderApi('/')
    await ue.click(screen.getByRole('tab', { name: 'Criar conta' }))
    expect(screen.queryByLabelText('Nome da organização')).not.toBeInTheDocument()
    await ue.type(screen.getByLabelText('Seu nome'), 'Rui')
    await ue.type(screen.getByLabelText('E-mail'), 'rui@exemplo.com')
    await ue.type(screen.getByLabelText('Senha'), '12345678')
    await ue.click(screen.getByRole('button', { name: /^Criar conta/ }))
    expect(await screen.findByText('Explore torneios')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Meu painel/ })).not.toBeInTheDocument()
  })

  it('sessão salva é retomada; sessão inválida volta ao login com aviso', async () => {
    await renderApi('/torneios', 'visitante@playoff.dev')
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(await screen.findByText(/Olá, Visitante/)).toBeInTheDocument()
  })

  it('token inválido ou expirado: encerra a sessão', async () => {
    const api = await startApi()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'expirado', user: { id: 'u1', name: 'X', role: 'organizador' } }))
    window.history.pushState({}, '', '/torneios')
    render(createElement(App, { apiUrl: API_URL, fetchImpl: api.fetchImpl }))
    expect(await screen.findByText('Sessão expirada')).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'Entrar' })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('sair encerra a sessão', async () => {
    const { ue } = await renderApi('/torneios', 'visitante@playoff.dev')
    await ue.click(await screen.findByRole('button', { name: 'Menu do usuário' }))
    await ue.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Sair/ }))
    expect(await screen.findByRole('tab', { name: 'Entrar' })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('sem conexão com o servidor mostra aviso claro', async () => {
    window.history.pushState({}, '', '/')
    const ue = userEvent.setup()
    render(createElement(App, { apiUrl: API_URL, fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) }))
    await ue.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await ue.type(screen.getByLabelText('Senha'), 'x')
    await ue.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByText(/Não foi possível falar com o servidor/)).toBeInTheDocument()
  })
})

describe('modo API: torneios', () => {
  it('catálogo mostra privado bloqueado com a contagem de equipes vinda do servidor', async () => {
    await renderApi('/torneios', 'visitante@playoff.dev')
    const card = (await screen.findByText('Liga Corporativa Society')).closest('article')!
    expect(within(card).getByText('Privado')).toBeInTheDocument()
    expect(within(card).getByText('8 equipes')).toBeInTheDocument()
  })

  it('privado: o código é conferido no servidor; depois o torneio completo carrega', async () => {
    const { ue, api, token } = await renderApi('/torneios', 'visitante@playoff.dev')
    await ue.click((await screen.findByText('Liga Corporativa Society')).closest('article')!)
    await ue.type(dialog().getByLabelText('Código de acesso'), 'errado{Enter}')
    expect(await dialog().findByRole('alert')).toHaveTextContent('Código incorreto. Tente novamente.')
    await ue.clear(dialog().getByLabelText('Código de acesso'))
    await ue.type(dialog().getByLabelText('Código de acesso'), 'PLAY2026{Enter}')
    // (o cartão do catálogo também tem esse título: espera a página do torneio de fato)
    await waitFor(() => expect(window.location.pathname).toBe('/torneios/t3'))
    // a troca de página espera a animação de saída do catálogo, mais lenta com a suíte toda rodando
    await ue.click(await screen.findByRole('button', { name: /Times/ }, { timeout: 5000 }))
    expect(await screen.findByText('Atlético Dados')).toBeInTheDocument()
    expect((await api.call('GET', '/me', token())).json().unlocked).toEqual(['t3'])
  })

  it('bloqueio após 5 tentativas vem do servidor (429)', async () => {
    const { ue } = await renderApi('/torneios/t3', 'visitante@playoff.dev')
    const input = await screen.findByLabelText('Código de acesso')
    for (let i = 0; i < 5; i++) {
      await ue.clear(input)
      await ue.type(input, `e${i}{Enter}`)
      await screen.findByRole('alert')
    }
    expect(screen.getByRole('alert')).toHaveTextContent(/Muitas tentativas/)
  })

  it('torneio inexistente no servidor', async () => {
    await renderApi('/torneios/nao-existe', 'visitante@playoff.dev')
    expect(await screen.findByText('Torneio não encontrado')).toBeInTheDocument()
  })

  it('favoritar grava no servidor', async () => {
    const { ue, api, token } = await renderApi('/torneios/t2', 'visitante@playoff.dev')
    await ue.click(await screen.findByRole('button', { name: 'Favoritar torneio' }))
    expect(await screen.findByText('Adicionado aos favoritos')).toBeInTheDocument()
    expect((await api.call('GET', '/torneios/t2', token())).json().favoritedBy).toEqual(['u2'])
    await ue.click(screen.getByRole('button', { name: 'Remover dos favoritos' }))
    await waitFor(async () => expect((await api.call('GET', '/torneios/t2', token())).json().favoritedBy).toEqual([]))
  })
})

describe('modo API: gestão pelo organizador', () => {
  it('sorteia, registra súmula e cadastra árbitro: tudo gravado no servidor', async () => {
    const { ue, api } = await renderApi('/torneios/t2', 'organizador@playoff.dev')
    await ue.click(await screen.findByRole('button', { name: /Sortear e gerar jogos/ }))
    await ue.click(dialog().getByRole('button', { name: /Sortear e gerar jogos/ }))
    expect(await screen.findByText('Chave sorteada!')).toBeInTheDocument()
    let t = (await api.call('GET', '/torneios/t2')).json()
    expect(t.status).toBe('chaveamento')

    // súmula de sets numa partida com adversários definidos
    const m = t.modalities[0].matches.find((x: { bye?: boolean; a?: string; b?: string }) => !x.bye && x.a && x.b)
    const nomeA = t.teams.find((x: { id: string }) => x.id === m.a).name
    await ue.click(screen.getAllByText(nomeA)[0].closest('button')!)
    await ue.clear(dialog().getByLabelText('Set 1 time A'))
    await ue.type(dialog().getByLabelText('Set 1 time A'), '6')
    await ue.clear(dialog().getByLabelText('Set 1 time B'))
    await ue.type(dialog().getByLabelText('Set 1 time B'), '6')
    await ue.click(dialog().getByRole('button', { name: 'Adicionar set' }))
    await ue.clear(dialog().getByLabelText('Set 2 time A'))
    await ue.type(dialog().getByLabelText('Set 2 time A'), '6')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    // set empatado: a regra é aplicada no servidor e a mensagem aparece na tela
    expect(await screen.findByText(/Set 1 empatado/)).toBeInTheDocument()
    await ue.clear(dialog().getByLabelText('Set 1 time B'))
    await ue.type(dialog().getByLabelText('Set 1 time B'), '2')
    await ue.click(dialog().getByRole('button', { name: 'Encerrar partida' }))
    expect(await screen.findByText('Súmula registrada')).toBeInTheDocument()
    t = (await api.call('GET', '/torneios/t2')).json()
    expect(t.modalities[0].matches.find((x: { id: string }) => x.id === m.id).status).toBe('encerrada')

    await ue.click(screen.getByRole('button', { name: /Cadastros/ }))
    await ue.type(screen.getByLabelText('Nome do árbitro'), 'Caio Nunes{Enter}')
    expect(await screen.findByText('Árbitro cadastrado')).toBeInTheDocument()
    expect((await api.call('GET', '/torneios/t2')).json().referees).toContain('Caio Nunes')
  })

  it('cria torneio pelo assistente no servidor e depois exclui', async () => {
    const { ue, api } = await renderApi('/criar', 'organizador@playoff.dev')
    await ue.type(await screen.findByPlaceholderText(/Copa da Primavera/), 'Copa pela API')
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Futsal/ }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Preencher exemplo/ }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(screen.getByRole('button', { name: /Continuar/ }))
    await ue.click(within(screen.getByRole('main')).getByRole('button', { name: /Criar torneio/ }))
    expect(await screen.findByText('Torneio criado!')).toBeInTheDocument()
    const criado = (await api.call('GET', '/torneios')).json().find((x: { name: string }) => x.name === 'Copa pela API')
    expect(criado).toMatchObject({ status: 'chaveamento', organizerId: 'u1' })
    await waitFor(() => expect(window.location.pathname).toBe(`/torneios/${criado.id}`), { timeout: 3000 })

    await ue.click(await screen.findByRole('button', { name: /Gestão/ }))
    await ue.click(screen.getByRole('button', { name: /Excluir torneio/ }))
    await ue.click(dialog().getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/painel'))
    expect((await api.call('GET', `/torneios/${criado.id}`)).status).toBe(404)
  })

  it('identidade visual e "Atualizar dados" pelo servidor', async () => {
    const { ue, api } = await renderApi('/identidade', 'organizador@playoff.dev')
    const nome = await screen.findByDisplayValue('Liga Horizonte')
    await ue.clear(nome)
    await ue.type(nome, 'Liga via API')
    await ue.click(screen.getByRole('button', { name: /Salvar identidade/ }))
    expect(await screen.findByText('Identidade salva')).toBeInTheDocument()
    expect((await api.call('GET', '/organizacoes')).json().find((o: { id: string }) => o.id === 'o1').name).toBe('Liga via API')
    await ue.click(screen.getByRole('button', { name: 'Menu do usuário' }))
    await ue.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Atualizar dados/ }))
    expect(await screen.findByText('Dados atualizados')).toBeInTheDocument()
  })

  it('organizador num torneio alheio: o servidor recusa e a tela não oferece gestão', async () => {
    const { api } = await renderApi('/torneios/t4', 'organizador@playoff.dev')
    expect(await screen.findByRole('heading', { name: 'Copa Bairro Basquete 3x3' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gestão/ })).not.toBeInTheDocument()
    const { token } = await api.login('organizador@playoff.dev')
    expect((await api.call('POST', '/torneios/t4/agenda/otimizar', token)).status).toBe(403)
  })
})
