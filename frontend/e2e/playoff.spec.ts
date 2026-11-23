import { expect, test } from '@playwright/test'
import { passo } from './demo'
import { login } from './helpers'

/*
 * Testes de sistema: fluxos reais, navegador → frontend compilado → API → regras de
 * negócio. Os IDs (ST01 a ST03) são os mesmos do seminário, e cada caso segue o modelo
 * da aula: pré-condição, passos e resultado esperado.
 */

test('ST01 · organizador sorteia e registra súmula; o resultado continua lá depois de recarregar', async ({ page }) => {
  await passo(page, 'Pré-condição: organizador logado e um torneio ainda sem chave', async () => {
    await login(page, 'organizador@playoff.dev')
    await page.getByText('Circuito Beach Tennis Verão').click()
  })

  await passo(page, 'Passo 1: sortear a chave e gerar os jogos', async () => {
    await page.getByRole('button', { name: /Sortear e gerar jogos/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Sortear e gerar jogos/ }).click()
    await expect(page.getByText('Chave sorteada!')).toBeVisible()
  })

  await passo(page, 'Passo 2: registrar a súmula de uma partida das quartas (6 x 3)', async () => {
    await page.getByRole('button', { name: /Partidas/ }).click()
    await page.locator('button', { hasText: 'Beach Tennis · Quartas' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Set 1 time A').fill('6')
    await dialog.getByLabel('Set 1 time B').fill('3')
    await dialog.getByRole('button', { name: 'Encerrar partida' }).click()
    await expect(page.getByText('Súmula registrada')).toBeVisible()
  })

  await passo(page, 'Passo 3: recarregar a página (tudo vem de novo do servidor)', async () => {
    await page.reload()
    await page.getByRole('button', { name: /Partidas/ }).click()
    await page.getByRole('button', { name: 'encerradas' }).click()
  })

  await passo(page, 'Esperado: a partida continua encerrada depois de recarregar', async () => {
    await expect(page.locator('button', { hasText: 'Beach Tennis · Quartas' })).toHaveCount(1)
  })
})

test('ST02 · espectador não vê gestão; torneio privado só abre com o código certo', async ({ page }) => {
  await passo(page, 'Pré-condição: existe um torneio privado (Liga Corporativa Society)', async () => {})

  await passo(page, 'Passo 1: entrar como espectador', () => login(page, 'visitante@playoff.dev'))

  await passo(page, 'Esperado: nenhum acesso de gestão para o espectador', async () => {
    await expect(page.getByRole('link', { name: /Meu painel/ })).toHaveCount(0)
  })

  const dialog = page.getByRole('dialog')
  await passo(page, 'Passo 2: abrir o torneio privado e digitar um código errado', async () => {
    await page.getByText('Liga Corporativa Society').click()
    await dialog.getByLabel('Código de acesso').fill('errado')
    await dialog.getByRole('button', { name: 'Entrar' }).click()
  })

  await passo(page, 'Esperado: o código errado nega o acesso', async () => {
    await expect(dialog.getByRole('alert')).toHaveText(/Código incorreto/)
  })

  await passo(page, 'Passo 3: digitar o código certo', async () => {
    await dialog.getByLabel('Código de acesso').fill('PLAY2026')
    await dialog.getByRole('button', { name: 'Entrar' }).click()
  })

  await passo(page, 'Esperado: o torneio abre, sem nenhum botão de gestão', async () => {
    await expect(page).toHaveURL(/\/torneios\/t3$/)
    await expect(page.getByRole('button', { name: /Gestão/ })).toHaveCount(0)
    await page.getByRole('button', { name: /Times/ }).click()
    await expect(page.getByText('Atlético Dados')).toBeVisible()
  })
})

test('ST03 · nova conta de organizador cria um torneio', async ({ page }) => {
  await passo(page, 'Passo 1: criar uma conta de organizador', async () => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Criar conta' }).click()
    await page.getByRole('button', { name: /Organizador/ }).click()
    await page.getByLabel('Seu nome').fill('Teste E2E')
    await page.getByLabel('Nome da organização').fill('Liga E2E')
    await page.getByLabel('E-mail').fill(`e2e-${Date.now()}@playoff.dev`)
    await page.getByLabel('Senha').fill('12345678')
    await page.getByRole('button', { name: /^Criar conta/ }).click()
  })

  await passo(page, 'Esperado: o painel do organizador fica disponível', async () => {
    await expect(page.getByRole('link', { name: /Meu painel/ })).toBeVisible()
  })

  await passo(page, 'Passo 2: criar um torneio de futsal pelo assistente', async () => {
    await page.goto('/criar')
    await page.getByPlaceholder(/Copa da Primavera/).fill('Copa E2E')
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('button', { name: /Futsal/ }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('button', { name: /Preencher exemplo/ }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('main').getByRole('button', { name: /Criar torneio/ }).click()
  })

  await passo(page, 'Esperado: a página do torneio novo abre', async () => {
    await expect(page).toHaveURL(/\/torneios\/t_/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Copa E2E' })).toBeVisible()
  })
})
