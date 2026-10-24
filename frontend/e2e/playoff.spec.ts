import { expect, test, type Page } from '@playwright/test'

/* Fluxos reais: navegador → frontend compilado → API → regras de negócio. */

async function login(page: Page, email: string, password = 'playoff123') {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /^Entrar/ }).click()
  await expect(page.getByText('Explore torneios')).toBeVisible()
}

test('organizador sorteia e registra súmula; o resultado continua lá depois de recarregar', async ({ page }) => {
  await login(page, 'organizador@playoff.dev')
  await page.getByText('Circuito Beach Tennis Verão').click()
  await page.getByRole('button', { name: /Sortear e gerar jogos/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Sortear e gerar jogos/ }).click()
  await expect(page.getByText('Chave sorteada!')).toBeVisible()

  // abre a primeira partida com dois times e registra 6x3
  await page.getByRole('button', { name: /Partidas/ }).click()
  await page.locator('button', { hasText: 'Beach Tennis · Quartas' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Set 1 time A').fill('6')
  await dialog.getByLabel('Set 1 time B').fill('3')
  await dialog.getByRole('button', { name: 'Encerrar partida' }).click()
  await expect(page.getByText('Súmula registrada')).toBeVisible()

  // recarregar a página busca tudo de novo no servidor
  await page.reload()
  await page.getByRole('button', { name: /Partidas/ }).click()
  await page.getByRole('button', { name: 'encerradas' }).click()
  await expect(page.locator('button', { hasText: 'Beach Tennis · Quartas' })).toHaveCount(1)
})

test('espectador não vê gestão; torneio privado só abre com o código certo', async ({ page }) => {
  await login(page, 'visitante@playoff.dev')
  await expect(page.getByRole('link', { name: /Meu painel/ })).toHaveCount(0)

  await page.getByText('Liga Corporativa Society').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Código de acesso').fill('errado')
  await dialog.getByRole('button', { name: 'Entrar' }).click()
  await expect(dialog.getByRole('alert')).toHaveText(/Código incorreto/)
  await dialog.getByLabel('Código de acesso').fill('PLAY2026')
  await dialog.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/torneios\/t3$/)
  await expect(page.getByRole('button', { name: /Gestão/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Times/ }).click()
  await expect(page.getByText('Atlético Dados')).toBeVisible()
})

test('nova conta de organizador cria um torneio', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Criar conta' }).click()
  await page.getByRole('button', { name: /Organizador/ }).click()
  await page.getByLabel('Seu nome').fill('Teste E2E')
  await page.getByLabel('Nome da organização').fill('Liga E2E')
  await page.getByLabel('E-mail').fill(`e2e-${Date.now()}@playoff.dev`)
  await page.getByLabel('Senha').fill('12345678')
  await page.getByRole('button', { name: /^Criar conta/ }).click()
  await expect(page.getByRole('link', { name: /Meu painel/ })).toBeVisible()

  await page.goto('/criar')
  await page.getByPlaceholder(/Copa da Primavera/).fill('Copa E2E')
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: /Futsal/ }).click()
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: /Preencher exemplo/ }).click()
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('main').getByRole('button', { name: /Criar torneio/ }).click()
  await expect(page).toHaveURL(/\/torneios\/t_/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Copa E2E' })).toBeVisible()
})
