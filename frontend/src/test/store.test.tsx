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
  it('sem permissão: a ação não é aplicada e aparece um aviso', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState(SPECTATOR)))
    const { result } = renderHook(() => useStore(), { wrapper })
    let ok = true
    act(() => {
      ok = result.current.edit('t1', (t) => ({ ...t, name: 'Hack' }))
    })
    expect(ok).toBe(false)
    expect(result.current.get('t1')!.name).not.toBe('Hack')
    expect(screen.getByText('Sem permissão')).toBeInTheDocument()
    // torneio inexistente também é recusado
    act(() => void result.current.edit('nada', (t) => t))
  })

  it('regra violada vira aviso com a mensagem', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState(ORGANIZER)))
    const { result } = renderHook(() => useStore(), { wrapper })
    act(() => void result.current.transition('t2', 'finalizado'))
    expect(screen.getByText('Não foi possível concluir')).toBeInTheDocument()
    expect(result.current.get('t2')!.status).toBe('publicado')
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
    act(() => result.current.dispatch({ type: 'login', user: SPECTATOR }))
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
