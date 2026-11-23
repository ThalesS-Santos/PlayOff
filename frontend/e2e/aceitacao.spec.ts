import { expect, test } from '@playwright/test'
import { passo, pausa } from './demo'
import { criarTorneio, login, partidas, registrarVitoria, sortear, TIMES_EXEMPLO, timesDa } from './helpers'

/*
 * Testes de aceitação: os critérios combinados com o cliente (o organizador do
 * campeonato), escritos em Dado / Quando / Então e executados no navegador como ele
 * usaria o PlayOff. Cada passo aparece com esse nome no relatório do Playwright.
 *
 * CA01 a CA03 são os critérios do seminário (slide 12); CA04 e CA05 cobrem a dupla
 * eliminação. Cada cenário cria o próprio torneio, então eles não dependem uns dos outros.
 */

const ORGANIZADOR = 'organizador@playoff.dev'
const ESPECTADOR = 'visitante@playoff.dev'

test('CA01 · agenda sem conflitos (RF04)', async ({ page }) => {
  const arbitros = ['Ana Prado', 'Caio Nunes']
  // a grade mostra a sigla do time (3 primeiras letras): ÁGU x TIT
  const siglas = TIMES_EXEMPLO.map((n) => n.slice(0, 3).toUpperCase())

  await passo(page, 'Dado 8 times, 2 quadras, 2 árbitros e 16 dias de torneio', async () => {
    await login(page, ORGANIZADOR)
    // pontos corridos: todo time joga em toda rodada, então a regra de um jogo por dia é posta à prova.
    // O período (padrão do assistente, 14 a 29/11) faz parte do critério: se as rodadas não
    // couberem nos dias, a agenda relaxa a regra e um time pode jogar duas vezes no mesmo dia.
    await criarTorneio(page, { nome: 'CA01 Agenda', quadras: 'Quadra 1, Quadra 2', arbitros: arbitros.join(', '), formato: 'pontos_corridos', sortearNaCriacao: false })
  })

  await passo(page, 'Quando o organizador gera a agenda', () => sortear(page))

  await passo(page, 'Então ninguém joga em dois lugares ao mesmo tempo e cada time joga no máximo uma vez por dia', async () => {
    await page.getByRole('button', { name: /Partidas/ }).click()
    await page.getByRole('button', { name: 'Grade' }).click()
    await expect(page.getByRole('columnheader', { name: 'Quadra 1' })).toBeVisible()
    await expect(page.getByText(/sem horário/)).toHaveCount(0)
    // grade no alto da tela (abaixo do menu fixo), longe da legenda da demonstração
    await page.locator('table').evaluate((t) => window.scrollBy(0, t.getBoundingClientRect().top - 190))

    const seletorDia = page.getByLabel('Dia', { exact: true })
    const dias = await seletorDia.locator('option').evaluateAll((os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, rotulo: o.textContent ?? '' })))
    let jogos = 0
    for (const dia of dias) {
      const nesteDia = Number(/(\d+) jogos/.exec(dia.rotulo)?.[1] ?? 0)
      if (!nesteDia) continue
      await seletorDia.selectOption(dia.valor)
      await expect(page.locator('tbody').getByRole('button')).toHaveCount(nesteDia)
      await pausa(page, 700) // na demonstração, dá para ver a grade de cada dia

      // uma coluna por quadra; cada linha é um horário
      const quadras = await page.getByRole('columnheader').allTextContents()
      const jogaramHoje = new Set<string>()
      for (const linha of await page.locator('tbody').getByRole('row').all()) {
        const hora = await linha.getByRole('rowheader').textContent()
        const ocupados = new Set<string>()
        for (const [i, celula] of (await linha.getByRole('cell').all()).entries()) {
          const naQuadra = await celula.getByRole('button').allTextContents()
          expect(naQuadra.length, `${quadras[i]} com dois jogos às ${hora} (${dia.rotulo})`).toBeLessThanOrEqual(1)
          for (const jogo of naQuadra) {
            jogos++
            const times = siglas.filter((s) => jogo.includes(s))
            const arbitro = arbitros.find((a) => jogo.includes(a))
            expect(times, `jogo sem os dois times: ${jogo}`).toHaveLength(2)
            expect(arbitro, `jogo sem árbitro: ${jogo}`).toBeDefined()
            for (const quem of [...times, arbitro!]) {
              expect(ocupados.has(quem), `${quem} em dois lugares às ${hora} (${dia.rotulo})`).toBe(false)
              ocupados.add(quem)
            }
            for (const time of times) {
              expect(jogaramHoje.has(time), `${time} joga duas vezes no mesmo dia (${dia.rotulo})`).toBe(false)
              jogaramHoje.add(time)
            }
          }
        }
      }
    }
    // 8 times em turno único: 8 × 7 / 2 jogos, todos com dia, hora, quadra e árbitro
    expect(jogos).toBe(28)
  })

  await passo(page, 'E o painel do organizador não aponta nenhum conflito', async () => {
    await page.getByRole('button', { name: /Gestão/ }).click()
    await expect(page.getByText('Nenhum conflito')).toBeVisible()
  })
})

test('CA02 · o vencedor avança sozinho (RF03)', async ({ page }) => {
  let resultado = { vencedor: '', perdedor: '' }

  await passo(page, 'Dado um mata-mata em andamento', async () => {
    await login(page, ORGANIZADOR)
    await criarTorneio(page, { nome: 'CA02 Mata-mata' })
    await page.getByRole('button', { name: /Gestão/ }).click()
    await page.getByRole('button', { name: 'Iniciar torneio' }).click()
    await expect(page.getByRole('button', { name: 'Concluir torneio' })).toBeVisible()
  })

  await passo(page, 'Quando o organizador registra a súmula', async () => {
    await page.getByRole('button', { name: /Partidas/ }).click()
    const jogo = partidas(page, 'Quartas').first()
    const [mandante] = await timesDa(jogo)
    resultado = await registrarVitoria(page, jogo, mandante)
  })

  await passo(page, 'Então o vencedor aparece sozinho na próxima fase', async () => {
    const semifinais = partidas(page, 'Semifinal')
    await expect(semifinais.filter({ hasText: resultado.vencedor })).toHaveCount(1)
    await expect(semifinais.filter({ hasText: resultado.perdedor })).toHaveCount(0)
    await semifinais.filter({ hasText: resultado.vencedor }).scrollIntoViewIfNeeded()
  })

  await passo(page, 'E a chave já mostra o vencedor na semifinal', async () => {
    await page.getByRole('button', { name: /Chaveamento/ }).click()
    // na chave, o vencedor está em dois jogos (quartas e semifinal); o perdedor, só nas quartas
    await expect(page.locator('button').filter({ hasText: resultado.vencedor })).toHaveCount(2)
    await expect(page.locator('button').filter({ hasText: resultado.perdedor })).toHaveCount(1)
  })
})

test('CA03 · torcedor acompanha sem bagunçar (RF05)', async ({ page }) => {
  await passo(page, 'Dado um espectador logado', () => login(page, ESPECTADOR))

  await passo(page, 'Quando ele abre um torneio', async () => {
    await page.getByText('Copa Interclasse Horizonte 2026').click()
    await expect(page.getByRole('heading', { name: 'Copa Interclasse Horizonte 2026' })).toBeVisible()
  })

  await passo(page, 'Então vê a chave', async () => {
    await expect(page.getByRole('heading', { name: /Mata-mata/ })).toBeVisible()
  })

  await passo(page, 'E vê a tabela de classificação', async () => {
    await page.getByRole('button', { name: /Vôlei/ }).click()
    await expect(page.getByRole('heading', { name: /Fase de grupos/ })).toBeVisible()
    await expect(page.getByRole('table').first()).toContainText('Pts')
  })

  await passo(page, 'E vê o calendário, em lista e em grade', async () => {
    await page.getByRole('button', { name: /Partidas/ }).click()
    await expect(partidas(page, 'Quartas').first()).toBeVisible()
    await page.getByRole('button', { name: 'Grade' }).click()
    await expect(page.getByRole('columnheader', { name: 'Quadra 1' })).toBeVisible()
  })

  await passo(page, 'Mas não edita nada, nem o placar ao vivo', async () => {
    await expect(page.getByRole('button', { name: /Gestão/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Cadastros/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Lista' }).click()
    await partidas(page, 'Semifinal').filter({ hasText: 'AO VIVO' }).click()
    const sumula = page.getByRole('dialog')
    await expect(sumula.getByText('Somente o organizador pode alterar a súmula.')).toBeVisible()
    for (const acao of ['Aumentar', 'Diminuir', 'Salvar ao vivo', 'Encerrar partida'])
      await expect(sumula.getByRole('button', { name: acao }), `espectador não deveria ver "${acao}"`).toHaveCount(0)
  })
})

test.describe('dupla eliminação', () => {
  // 6 times numa chave de 8: sobram 2 vagas, que viram folga (bye) para os cabeças de chave
  const cabecas = ['Águias', 'Titãs']
  const seis = { formato: 'dupla_eliminacao', remover: ['Tempestade', 'Relâmpago'], cabecas }

  test('CA04 · cabeças de chave folgam na 1ª rodada (RF01, RF03)', async ({ page }) => {
    await passo(page, 'Dado 6 times em dupla eliminação, com Águias e Titãs como cabeças de chave', async () => {
      await login(page, ORGANIZADOR)
      await criarTorneio(page, { nome: 'CA04 Dupla eliminação', ...seis, sortearNaCriacao: false })
    })

    await passo(page, 'Quando o organizador sorteia a chave', () => sortear(page))

    await passo(page, 'Então os cabeças de chave não jogam a 1ª rodada e já esperam na 2ª', async () => {
      await page.getByRole('button', { name: /Partidas/ }).click()
      const primeira = partidas(page, 'Vencedores · R1')
      await expect(primeira).toHaveCount(2)
      for (const cabeca of cabecas) {
        await expect(primeira.filter({ hasText: cabeca })).toHaveCount(0)
        await expect(partidas(page, 'Vencedores · R2').filter({ hasText: cabeca })).toHaveCount(1)
      }
    })

    await passo(page, 'E os outros 4 times jogam a 1ª rodada', async () => {
      for (const time of ['Cometas', 'Lobos', 'Vikings', 'Guerreiros']) await expect(partidas(page, 'Vencedores · R1').filter({ hasText: time })).toHaveCount(1)
    })

    await passo(page, 'E na chave os cabeças de chave aparecem contra um BYE (folga)', async () => {
      await page.getByRole('button', { name: /Chaveamento/ }).click()
      const folgas = page.locator('button', { hasText: 'BYE' })
      await expect(folgas).toHaveCount(2)
      for (const cabeca of cabecas) await expect(folgas.filter({ hasText: cabeca })).toHaveCount(1)
    })
  })

  test('CA05 · um time só sai depois de perder duas vezes (RF03)', async ({ page }) => {
    let time = ''

    await passo(page, 'Dado uma chave de dupla eliminação sorteada', async () => {
      await login(page, ORGANIZADOR)
      await criarTorneio(page, { nome: 'CA05 Dupla eliminação', ...seis })
      await page.getByRole('button', { name: /Partidas/ }).click()
    })

    await passo(page, 'Quando um time perde pela primeira vez', async () => {
      const jogo = partidas(page, 'Vencedores · R1').first()
      const [mandante] = await timesDa(jogo)
      ;({ perdedor: time } = await registrarVitoria(page, jogo, mandante))
    })

    await passo(page, 'Então ele cai para a chave dos perdedores e continua no torneio', async () => {
      await expect(partidas(page, 'Perdedores').filter({ hasText: time })).toHaveCount(1)
      await expect(partidas(page, 'Vencedores · R2').filter({ hasText: time })).toHaveCount(0)
    })

    await passo(page, 'E a chave dos vencedores anda até o adversário dele ser definido', async () => {
      for (const fase of ['Vencedores · R1', 'Vencedores · R2']) {
        const abertas = partidas(page, fase).filter({ hasNotText: 'Encerrada' })
        for (let n = await abertas.count(); n > 0; n--) {
          const [mandante] = await timesDa(abertas.first())
          await registrarVitoria(page, abertas.first(), mandante)
          await expect(abertas).toHaveCount(n - 1)
        }
      }
    })

    await passo(page, 'Quando ele perde de novo, na chave dos perdedores', async () => {
      const jogo = partidas(page, 'Perdedores').filter({ hasText: time })
      const adversario = (await timesDa(jogo)).find((n) => n !== time)!
      await registrarVitoria(page, jogo, adversario)
    })

    await passo(page, 'Então ele está fora: não tem mais nenhum jogo pela frente', async () => {
      await page.getByRole('button', { name: 'Próximas' }).click()
      await expect(page.locator('button', { hasText: 'Futsal ·' }).first()).toBeVisible()
      await expect(page.locator('button', { hasText: 'Futsal ·' }).filter({ hasText: time })).toHaveCount(0)
    })
  })
})
