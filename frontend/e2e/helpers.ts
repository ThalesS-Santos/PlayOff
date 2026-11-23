import { expect, type Locator, type Page } from '@playwright/test'

/* Ações de usuário compartilhadas pelos testes de sistema e de aceitação. */

/** Times que o botão "Preencher exemplo" do assistente inscreve, nesta ordem. */
export const TIMES_EXEMPLO = ['Águias', 'Titãs', 'Cometas', 'Lobos', 'Vikings', 'Guerreiros', 'Tempestade', 'Relâmpago']

export async function login(page: Page, email: string, password = 'playoff123') {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /^Entrar/ }).click()
  await expect(page.getByText('Explore torneios')).toBeVisible()
}

interface NovoTorneio {
  nome: string
  quadras?: string
  arbitros?: string
  /** valor do campo Formato: eliminacao, dupla_eliminacao, grupos_mata, pontos_corridos */
  formato?: string
  /** times do exemplo que saem da inscrição */
  remover?: string[]
  /** cabeças de chave, na ordem (1, 2, ...) */
  cabecas?: string[]
  /** false: só cria (inscrições abertas); a chave é sorteada depois com sortear() */
  sortearNaCriacao?: boolean
}

/** Cria um torneio de futsal pelo assistente; por padrão já sorteia a chave e monta a agenda. */
export async function criarTorneio(page: Page, t: NovoTorneio) {
  await page.goto('/criar')
  await page.getByPlaceholder(/Copa da Primavera/).fill(t.nome)
  if (t.quadras) await page.getByLabel('Quadras / espaços').fill(t.quadras)
  if (t.arbitros) await page.getByLabel('Árbitros').fill(t.arbitros)
  await page.getByRole('button', { name: /Continuar/ }).click()

  await page.getByRole('button', { name: /Futsal/ }).click()
  if (t.formato) await page.getByLabel('Formato').selectOption(t.formato)
  await page.getByRole('button', { name: /Continuar/ }).click()

  await page.getByRole('button', { name: /Preencher exemplo/ }).click()
  for (const nome of t.remover ?? []) await page.getByRole('button', { name: `Remover ${nome}` }).click()
  for (const nome of t.cabecas ?? []) await page.getByTitle('Alternar cabeça de chave').filter({ hasText: nome }).click()
  await page.getByRole('button', { name: /Continuar/ }).click()
  await page.getByRole('button', { name: /Continuar/ }).click()

  if (t.sortearNaCriacao === false) await page.getByRole('checkbox', { name: /Sortear chave e montar agenda agora/ }).uncheck()
  await page.getByRole('main').getByRole('button', { name: /Criar torneio/ }).click()
  await expect(page).toHaveURL(/\/torneios\/t_/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: t.nome })).toBeVisible()
}

/** Organizador sorteia a chave na aba Chaveamento (gera os jogos e monta a agenda). */
export async function sortear(page: Page) {
  await page.getByRole('button', { name: /Sortear e gerar jogos/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Sortear e gerar jogos/ }).click()
  await expect(page.getByText('Chave sorteada!')).toBeVisible()
}

/** Linhas da aba Partidas de uma fase (ex.: "Quartas", "Vencedores · R1"). */
export const partidas = (page: Page, fase: string) => page.locator('button', { hasText: `Futsal · ${fase}` })

/** Times da partida na ordem em que aparecem (lado A, lado B). */
export async function timesDa(linha: Locator) {
  const texto = (await linha.textContent()) ?? ''
  return TIMES_EXEMPLO.filter((n) => texto.includes(n)).sort((x, y) => texto.indexOf(x) - texto.indexOf(y))
}

/** Abre a súmula da partida e encerra com 1 x 0 para o vencedor indicado. */
export async function registrarVitoria(page: Page, linha: Locator, vencedor: string) {
  const lados = await timesDa(linha)
  expect(lados, 'a partida precisa ter os dois times definidos').toHaveLength(2)
  await linha.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Aumentar' }).nth(lados.indexOf(vencedor)).click()
  await dialog.getByRole('button', { name: 'Encerrar partida' }).click()
  await expect(dialog).toBeHidden()
  return { vencedor, perdedor: lados.find((n) => n !== vencedor)! }
}
