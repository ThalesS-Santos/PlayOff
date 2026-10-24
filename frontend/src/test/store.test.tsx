import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useBrandHue } from '../components/useBrandHue'
import { Toaster } from '../components/ui'
import { freshState, STORAGE_KEY } from '../lib/state'
import { useStore } from '../lib/store'
import { StoreProvider } from '../lib/StoreProvider'
import { takeConsoleCalls } from './setup'
import { ORGANIZER, SPECTATOR } from './utils'

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>
    {children}
    <Toaster />
  </StoreProvider>
)

describe('StoreProvider', () => {
  it('sem permissão: a ação não é aplicada e aparece um aviso', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState(SPECTATOR)))
    const { result } = renderHook(() => useStore(), { wrapper })
    let ok = true
    await act(async () => {
      ok = await result.current.addReferee('t1', 'Intruso')
    })
    expect(ok).toBe(false)
    expect(result.current.get('t1')!.referees).not.toContain('Intruso')
    expect(screen.getByText('Sem permissão')).toBeInTheDocument()
    // torneio inexistente também é recusado; espectador não exclui nem altera a identidade
    await act(async () => {
      expect(await result.current.addReferee('nada', 'X')).toBe(false)
      expect(await result.current.removeTournament('t1')).toBe(false)
      expect(await result.current.saveOrg({ id: 'o1', name: 'X', short: 'X', hue: 1 })).toBe(false)
    })
    expect(result.current.get('t1')).toBeDefined()
  })

  it('regra violada vira aviso com a mensagem', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState(ORGANIZER)))
    const { result } = renderHook(() => useStore(), { wrapper })
    await act(async () => void (await result.current.transition('t2', 'finalizado')))
    expect(screen.getByText('Não foi possível concluir')).toBeInTheDocument()
    expect(result.current.get('t2')!.status).toBe('publicado')
    // no modo local, login/cadastro por senha não existem
    await act(async () => {
      expect(await result.current.login('a@b.com', 'x')).toBe(false)
      expect(await result.current.register({ name: 'A', email: 'a@b.com', password: 'x', role: 'espectador' })).toBe(false)
      expect(await result.current.loadTournament('t1')).toBe('ok')
      expect(await result.current.loadTournament('nada')).toBe('nao_encontrado')
    })
  })

  it('criar torneio inválido no modo local vira aviso; favoritar exige usuário', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState(ORGANIZER)))
    const { result } = renderHook(() => useStore(), { wrapper })
    await act(async () => {
      expect(await result.current.createTournament({ name: '', description: '', startDate: '', endDate: '', city: '', venueName: '', venues: [], visibility: 'publico', referees: [], cover: ['#000000', '#ffffff'], modalities: [], prizes: [], generateNow: false })).toBeNull()
    })
    expect(screen.getByText('Não foi possível concluir')).toBeInTheDocument()
    act(() => result.current.logout())
    await act(async () => expect(await result.current.toggleFavorite(result.current.get('t1')!)).toBe(false))
  })

  it('armazenamento bloqueado ao ler e ao gravar: segue funcionando em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cheio')
    })
    const { result } = renderHook(() => useStore(), { wrapper })
    expect(result.current.tournaments.length).toBe(4)
    act(() => result.current.loginDemo(SPECTATOR))
    expect(result.current.user).toEqual(SPECTATOR)
  })

  it('useStore fora do provedor falha com mensagem clara', () => {
    expect(() => render(<Consumer />)).toThrow('useStore fora do StoreProvider')
    // se alguma versão do React registrar o erro no console, ele é esperado neste teste
    takeConsoleCalls()
  })
})

function Consumer() {
  useStore()
  return null
}

describe('useBrandHue', () => {
  it('aplica a matiz e ignora valor ausente', () => {
    document.documentElement.style.setProperty('--brand-h', '1')
    const { rerender } = renderHook(({ h }) => useBrandHue(h), { initialProps: { h: undefined as number | undefined } })
    expect(document.documentElement.style.getPropertyValue('--brand-h')).toBe('1')
    rerender({ h: 42 })
    expect(document.documentElement.style.getPropertyValue('--brand-h')).toBe('42')
  })
})
