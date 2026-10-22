import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('ponto de entrada', () => {
  it('monta o app no #root (em StrictMode) e abre a tela de entrada', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    window.history.pushState({}, '', '/')
    await import('../main')
    expect(await screen.findByText('Entrar como')).toBeInTheDocument()
  })
})
