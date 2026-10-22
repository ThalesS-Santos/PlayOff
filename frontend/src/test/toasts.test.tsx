import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FAKE_TIMERS } from './setup'
import { ORGANIZER, renderApp } from './utils'

// arquivo próprio: o fechamento depende de animações de saída, e outros testes de tela
// no mesmo arquivo deixam animações em andamento no módulo compartilhado de animação
describe('avisos (toasts)', () => {
  it('fecham sozinhos e pelo botão', async () => {
    vi.useFakeTimers(FAKE_TIMERS)
    const { ue } = renderApp('/torneios/t2', ORGANIZER)
    await ue.click(await screen.findByRole('button', { name: 'Favoritar torneio' }))
    await ue.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    await waitFor(() => expect(screen.queryByText('Adicionado aos favoritos')).not.toBeInTheDocument())
    await ue.click(screen.getByRole('button', { name: 'Remover dos favoritos' }))
    expect(screen.getByText('Removido dos favoritos')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(4000))
    await waitFor(() => expect(screen.queryByText('Removido dos favoritos')).not.toBeInTheDocument())
  })
})
