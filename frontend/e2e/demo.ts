import { test, type Page } from '@playwright/test'

/*
 * Modo demonstração (npm run e2e:demo): navegador visível, em câmera lenta, com uma
 * legenda no canto da tela dizendo qual passo do teste está rodando e um círculo
 * laranja em cada clique. Fora dele, passo() é só um test.step e pausa() não faz nada.
 *
 * A legenda fica num shadow DOM fechado: os seletores do Playwright não a enxergam,
 * então ela nunca interfere nas verificações dos testes.
 */

export const DEMO = process.env.DEMO === '1' || process.env.DEMO === 'rapido'
// npm run e2e:demo:rapido: mesma legenda, pausas mais curtas
const RAPIDO = process.env.DEMO === 'rapido'
const tempo = (ms: number) => (RAPIDO ? Math.round(ms * 0.4) : ms)

type Tipo = 'contexto' | 'acao' | 'verificacao'
interface Legenda {
  teste: string
  chave: string
  texto: string
  tipo: Tipo
  ok: boolean
}

const CHAVES: [RegExp, Tipo | null][] = [
  [/^(Pré-condição|Dado)$/, 'contexto'],
  [/^(Passo \d+|Quando)$/, 'acao'],
  [/^(Esperado|Então)$/, 'verificacao'],
  [/^(E|Mas)$/, null], // continua o tipo do passo anterior
]

const atual = new WeakMap<Page, Legenda>()

/** Desenha (ou atualiza) a legenda. Roda dentro da página: não pode usar nada de fora. */
function desenhar(l: Legenda | null) {
  const w = window as unknown as { __legendaRaiz?: ShadowRoot }
  if (!document.body) return
  let raiz = w.__legendaRaiz
  if (!raiz) {
    const host = document.createElement('playoff-legenda')
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647'
    document.body.appendChild(host)
    raiz = host.attachShadow({ mode: 'closed' })
    raiz.innerHTML = `<style>
      .card{position:fixed;left:24px;bottom:24px;max-width:min(640px,calc(100vw - 48px));box-sizing:border-box;
        background:#13213c;color:#f7f5f0;border-radius:16px;border-left:8px solid var(--cor,#3b6fd8);
        padding:14px 20px 16px;box-shadow:0 18px 40px -12px rgba(0,0,0,.6);
        font:500 15px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
      .card[hidden]{display:none}
      .teste{margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#aab6cf}
      .passo{margin:0;font-size:22px;line-height:1.3}
      .chave{display:inline-block;margin-right:8px;padding:2px 10px;border-radius:8px;background:var(--cor);
        color:#fff;font-size:15px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;vertical-align:2px}
      .ok .chave::after{content:" ✓"}
      .contexto{--cor:#3b6fd8}.acao{--cor:#f28c28}.verificacao{--cor:#1f9d55}
      .toque{position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;
        border:3px solid #f28c28;background:rgba(242,140,40,.3);animation:toque .7s ease-out forwards}
      @keyframes toque{from{transform:scale(.4);opacity:1}to{transform:scale(1.9);opacity:0}}
    </style>
    <div class="card" hidden><p class="teste"></p><p class="passo"><b class="chave"></b><span class="texto"></span></p></div>`
    const r = raiz
    addEventListener(
      'pointerdown',
      (e) => {
        const toque = document.createElement('i')
        toque.className = 'toque'
        toque.style.left = `${e.clientX}px`
        toque.style.top = `${e.clientY}px`
        r.appendChild(toque)
        setTimeout(() => toque.remove(), 700)
      },
      true,
    )
    w.__legendaRaiz = raiz
  }
  const card = raiz.querySelector<HTMLElement>('.card')!
  card.hidden = !l
  if (!l) return
  card.className = `card ${l.tipo}${l.ok ? ' ok' : ''}`
  raiz.querySelector('.teste')!.textContent = l.teste
  raiz.querySelector('.chave')!.textContent = l.chave
  raiz.querySelector('.texto')!.textContent = l.texto
}

async function mostrar(page: Page, l: Legenda) {
  if (!atual.has(page)) {
    // a cada página nova (login, recarregar) a legenda é redesenhada com o passo atual
    await page.exposeFunction('__legendaAtual', () => atual.get(page) ?? null)
    await page.addInitScript({
      content: `addEventListener('DOMContentLoaded', async () => (${desenhar.toString()})(await window.__legendaAtual()))`,
    })
  }
  atual.set(page, l)
  await page.evaluate(desenhar, l).catch(() => undefined) // página no meio de uma navegação: o script acima redesenha
}

/** Pausa para a plateia ver a tela (só no modo demonstração). */
export async function pausa(page: Page, ms = 800) {
  if (DEMO) await page.waitForTimeout(tempo(ms))
}

/**
 * Um passo do teste, como test.step: aparece com esse nome no relatório. O título
 * começa pela palavra-chave (Dado, Quando, Então, E, Mas; ou Pré-condição, Passo N,
 * Esperado), que vira a etiqueta colorida da legenda.
 */
export async function passo<T>(page: Page, titulo: string, corpo: () => Promise<T>): Promise<T> {
  return test.step(titulo, async () => {
    if (!DEMO) return corpo()
    const m = /^(Pré-condição|Passo \d+|Esperado|Dado|Quando|Então|E|Mas)\b:?\s*(.*)$/s.exec(titulo)
    const chave = m?.[1] ?? ''
    const anterior = atual.get(page)
    const tipo = CHAVES.find(([re]) => re.test(chave))?.[1] ?? anterior?.tipo ?? 'acao'
    const legenda: Legenda = { teste: test.info().title, chave, texto: m?.[2] ?? titulo, tipo, ok: false }
    await mostrar(page, legenda)
    await page.waitForTimeout(tempo(1200)) // tempo de ler antes de a ação começar
    const resultado = await corpo()
    await mostrar(page, { ...legenda, ok: true })
    await page.waitForTimeout(tempo(tipo === 'verificacao' ? 1800 : 900))
    return resultado
  })
}
