# Roteiro da demonstração: Teste de Sistema e Teste de Aceitação

Este roteiro cobre as duas demonstrações ao vivo do seminário:

- **Slide 8:** os 3 testes de sistema (ST01 a ST03).
- **Slide 12:** os testes de aceitação (CA01 a CA05).

Os tempos foram medidos no modo demonstração. O nome dos times nas partidas muda a cada execução, porque a chave é sorteada.

> **Pouco tempo?** Vá direto para a [versão rápida](#versão-rápida-pouco-tempo), logo abaixo.

---

## Versão rápida (pouco tempo)

Para apresentar no menor tempo, combine três coisas:

1. **Use o modo rápido.** `npm run e2e:demo:rapido` mostra a mesma legenda e os mesmos cliques, mas com menos câmera lenta e pausas mais curtas. Cada teste fica entre 40% e 55% mais curto.
2. **Mostre um teste por slide**, o mais curto e representativo de cada tipo. A opção `-g` escolhe o teste pelo código (ST02, CA03...).
3. **Esconda a espera inicial.** Os primeiros 15 a 20 segundos de cada comando são só o Playwright subindo a API e o site, com a tela parada no terminal. Aperte Enter **no slide anterior** (slide 7 e slide 11) enquanto ainda está falando. Quando você chegar no slide da demonstração, o navegador já está abrindo.

**Recomendado: cerca de 30 s por demonstração, contando a espera inicial.**

Slide 8, teste de sistema: é o caso do slide 6.
```bash
npm run e2e:demo:rapido -- -g ST02
```

Slide 12, teste de aceitação: é o mais curto.
```bash
npm run e2e:demo:rapido -- -g CA03
```

Para trocar por outro teste, troque só o código depois de `-g`. Para rodar mais de um no mesmo comando, use `-g "ST02|CA03"`. Nesse caso, o Playwright roda os de aceitação antes dos de sistema (ordem alfabética dos arquivos).

Tempo de cada teste, sem contar a espera inicial (medido):

| Teste | O que mostra | `e2e:demo:rapido` | `e2e:demo` |
|---|---|---|---|
| **ST02** | espectador; torneio privado só abre com o código certo | **11 s** | 24 s |
| ST01 | sorteia, registra súmula e o resultado continua depois de recarregar | 12 s | 21 s |
| ST03 | conta nova de organizador cria um torneio | 13 s | 22 s |
| **CA03** | torcedor vê chave, tabela e calendário, mas não edita nada | **11 s** | 24 s |
| CA02 | vencedor avança sozinho, com a chave acesa no fim (o mais visual) | 17 s | 28 s |
| CA04 | cabeças de chave folgam na 1ª rodada (BYE) | 18 s | 30 s |
| CA01 | agenda sem conflitos, dia por dia | 22 s | 37 s |
| CA05 | dupla eliminação: só sai com duas derrotas | 26 s | 40 s |

**Ainda mais rápido, sem esperar nada:** rode tudo antes da apresentação e, na hora, só abra o relatório. Ele abre na hora e mostra cada teste com ✓ e os passos Dado/Quando/Então; dá para clicar num passo e mostrar a tela daquele momento (veja o Plano B, seção 6).
```bash
npx playwright show-report relatorio-ensaio
```

---

## 1. Antes da apresentação (15 minutos antes)

1. **Abra um terminal na pasta `frontend` do projeto**:
   ```bash
   cd playoff/frontend
   ```
2. **Ensaie uma vez com tudo** (cerca de 5 minutos). Assim você vê os 8 testes passarem e já fica com o plano B pronto:
   ```bash
   npm run e2e:demo
   ```
   No fim, o terminal tem que mostrar **`8 passed`**.
3. **Guarde o relatório do ensaio para o plano B.** Cada execução nova apaga o relatório anterior.
   - Linux ou Mac:
     ```bash
     cp -r playwright-report relatorio-ensaio
     ```
   - Windows (PowerShell):
     ```bash
     Copy-Item -Recurse playwright-report relatorio-ensaio
     ```
4. **Prepare a tela:**
   - aumente a fonte do terminal (`Ctrl` + `Shift` + `+` no Linux, `Ctrl` + `+` no Windows);
   - ative o "Não perturbe" para esconder as notificações;
   - feche abas e janelas que não vão ser usadas.
5. **Deixe os comandos à mão.** Com a seta ↑ o terminal mostra o último comando de novo.

> **Não precisa de internet.** A API, o site e o navegador rodam todos no computador.
> **Navegador:** o teste escolhe sozinho. No Windows usa o Edge. No Linux e no Mac usa o Chromium do Playwright, se ele tiver sido baixado, ou senão o Google Chrome. Não precisa baixar nada.

---

## 2. O que vai aparecer na tela

Quando o comando roda, **uma janela do navegador abre sozinha** e um "robô" (o Playwright) usa o PlayOff como uma pessoa usaria, só que em câmera lenta.

**A legenda no canto inferior esquerdo** mostra o que o teste está fazendo:

- **Linha de cima:** o nome do teste (por exemplo, `CA02 · O VENCEDOR AVANÇA SOZINHO (RF03)`).
- **Linha de baixo:** o passo atual, com uma etiqueta colorida.

| Cor da etiqueta | Teste de sistema | Teste de aceitação | Significado |
|---|---|---|---|
| 🔵 Azul | Pré-condição | Dado | o contexto, o que já existe |
| 🟠 Laranja | Passo 1, 2, 3… | Quando | a ação do usuário |
| 🟢 Verde | Esperado | Então | a verificação, o que tem que ser verdade |

- O **✓** aparece na etiqueta quando o passo termina sem erro.
- Os passos que começam com **E** ou **Mas** continuam com a cor do passo anterior.
- **O círculo laranja** marca cada clique do robô.

**Quando cada teste termina**, a janela fecha e outra abre. Cada teste começa do zero, sem os dados do anterior: isso é isolamento.

**No fim, o terminal** mostra uma linha com ✓ para cada teste e o total, por exemplo **`3 passed`**.

---

## 3. Slide 8: demonstração do Teste de Sistema (cerca de 1 min 30 s)

**Comando** (digite antes e aperte Enter quando chegar no slide):
```bash
npm run e2e:demo -- playoff.spec.ts
```

**Enquanto prepara (cerca de 20 s, a tela ainda está só no terminal):**
> "Primeiro o Playwright monta o ambiente, que é o passo 2 do slide 5. Ele sobe a API e o site compilado, igual em produção. Em uns segundos abre um navegador de verdade, e daí em diante eu não clico em nada."

**Antes do primeiro teste aparecer:**
> "Repare na legenda. Cada caso de teste segue o modelo da aula: pré-condição em azul, passos em laranja e resultado esperado em verde."

### ST01: o resultado continua depois de recarregar (cerca de 20 s)

| Na tela | O que dizer |
|---|---|
| 🔵 **Pré-condição**: tela de login preenchida sozinha, depois abre o torneio *Circuito Beach Tennis Verão* | "Ele entra como organizador e abre um torneio que ainda não tem chave." |
| 🟠 **Passo 1**: clica em *Sortear e gerar jogos*; aparece o aviso **"Chave sorteada!"** | "Sorteia a chave." |
| 🟠 **Passo 2**: aba *Partidas*, abre uma partida das quartas, digita **6** e **3** e encerra; aviso **"Súmula registrada"** | "Registra o placar, como o organizador faria." |
| 🟠 **Passo 3**: a página recarrega (pisca) e volta em *Partidas › Encerradas* | "Recarregar obriga o site a buscar tudo de novo no servidor." |
| 🟢 **Esperado**: a partida aparece na lista de encerradas | "O resultado continua lá. Isso prova que frontend, API e dados estão conversando, e esse tipo de falha só aparece com o sistema inteiro montado." |

### ST02: espectador e torneio privado (cerca de 25 s). É o caso do slide 6

| Na tela | O que dizer |
|---|---|
| 🔵 **Pré-condição**: tela em branco com a legenda por 2 s | "Este é o caso que está no slide: existe um torneio privado." |
| 🟠 **Passo 1**: login com `visitante@playoff.dev` | "Entra como espectador." |
| 🟢 **Esperado**: o menu não tem *Meu painel* | "Espectador não tem acesso à gestão." |
| 🟠 **Passo 2**: abre a *Liga Corporativa Society*; aparece a janela **Torneio privado** e o robô digita **ERRADO** | "Tenta um código errado…" |
| 🟢 **Esperado**: mensagem vermelha **"Código incorreto. Tente novamente."** | "…e o sistema nega." |
| 🟠 **Passo 3**: digita **PLAY2026** | "Agora o código certo." |
| 🟢 **Esperado**: o torneio abre sem as abas *Gestão* e *Cadastros*; a aba *Times* mostra *Atlético Dados* | "Abre, mas só para ver. Pré-condição, passos e resultado esperado, exatamente como está no slide." |

### ST03: nova conta de organizador cria um torneio (cerca de 20 s)

| Na tela | O que dizer |
|---|---|
| 🟠 **Passo 1**: aba *Criar conta*, escolhe *Organizador*, preenche nome, organização, e-mail e senha | "Cria uma conta nova." |
| 🟢 **Esperado**: aparece *Meu painel* no menu | "A conta já entra como organizadora." |
| 🟠 **Passo 2**: o assistente passa pelas 5 etapas (Dados, Modalidades, Equipes, Premiação, Revisão), com Futsal e *Preencher exemplo*; animação **"Torneio criado!"** | "Cria um torneio pelo assistente…" |
| 🟢 **Esperado**: abre a página da **Copa E2E** | "…e o torneio existe." |

**Quando o terminal mostrar `3 passed`:**
> "Três cenários, um navegador de verdade, nenhum clique meu. E esses mesmos testes rodam sozinhos a cada push no GitHub Actions, no job *e2e*."

---

## 4. Slide 12: demonstração do Teste de Aceitação

Escolha a versão pelo tempo que sobrar:

| Versão | Comando | Tempo |
|---|---|---|
| **Curta (recomendada)** | `npm run e2e:demo -- aceitacao.spec.ts -g "CA02\|CA03"` | cerca de 1 min 15 s |
| Critérios do slide | `npm run e2e:demo -- aceitacao.spec.ts -g "CA01\|CA02\|CA03"` | cerca de 1 min 50 s |
| Completa, com dupla eliminação | `npm run e2e:demo -- aceitacao.spec.ts` | cerca de 3 min |

> No terminal, separe os testes só com a barra vertical, sem barra invertida: `-g "CA02|CA03"`.

**Antes de apertar Enter:**
> "Agora a mesma ferramenta, mas o teste está escrito na língua do cliente: Dado, Quando, Então. Azul é o Dado, laranja o Quando e verde o Então. Cada critério que combinamos com o organizador virou um teste que roda sozinho."

### CA02: o vencedor avança sozinho (RF03) (cerca de 30 s)

| Na tela | O que dizer |
|---|---|
| 🔵 **Dado** um mata-mata em andamento: login, o assistente cria *CA02 Mata-mata* com 8 times, e na aba *Gestão* clica **Iniciar torneio** | "Dado um campeonato em andamento…" |
| 🟠 **Quando** o organizador registra a súmula: aba *Partidas*, abre uma partida das quartas, clica **+** uma vez (1 × 0) e encerra | "…quando o organizador registra um resultado…" |
| 🟢 **Então** o vencedor aparece sozinho na próxima fase: na lista, a semifinal mostra o vencedor contra *Venc. QF2* | "…então o vencedor já está na semifinal, sem ninguém mexer na chave." |
| 🟢 **E** a chave já mostra o vencedor: aba *Chaveamento*, com a **linha roxa acesa** ligando as quartas à semifinal | "Na chave visual também. É isso que o organizador quer: não ter que atualizar nada na mão." |

### CA03: torcedor acompanha sem bagunçar (RF05) (cerca de 25 s)

| Na tela | O que dizer |
|---|---|
| 🔵 **Dado** um espectador logado: login como visitante | "Agora quem usa é o torcedor." |
| 🟠 **Quando** ele abre um torneio: abre a *Copa Interclasse Horizonte 2026* | |
| 🟢 **Então** vê a chave: o mata-mata do futsal, com uma semifinal **AO VIVO** | "Ele vê a chave…" |
| 🟢 **E** vê a tabela: clica em *Vôlei* e aparecem as tabelas dos grupos (J, V, E, D, SG, Pts) | "…a classificação…" |
| 🟢 **E** vê o calendário: aba *Partidas* em lista e depois em *Grade* (horário × quadra) | "…e o calendário, nos dois formatos." |
| 🟢 **Mas** não edita nada: abre o jogo ao vivo; a súmula aparece só para leitura, com **"Somente o organizador pode alterar a súmula."** e sem os botões + e − | "Mas não consegue mudar nem o placar ao vivo." |

### CA01: agenda sem conflitos (RF04) (cerca de 35 s), se usar a versão com os critérios do slide

| Na tela | O que dizer |
|---|---|
| 🔵 **Dado** 8 times, 2 quadras, 2 árbitros e 16 dias: o assistente cria *CA01 Agenda* em pontos corridos | "Exatamente o critério do slide." |
| 🟠 **Quando** o organizador gera a agenda: *Sortear e gerar jogos*, aviso **"Chave sorteada!"** | |
| 🟢 **Então** ninguém joga em dois lugares…: aba *Partidas › Grade*; **o seletor de dia vai passando sozinho**, 7 dias com 4 jogos cada, e cada jogo mostra os times (ex.: *GUE x TIT*) e o árbitro | "O robô confere dia por dia: nenhum time, árbitro ou quadra repetido no mesmo horário, e nenhum time jogando duas vezes no mesmo dia." |
| 🟢 **E** o painel não aponta conflito: aba *Gestão* com **"Nenhum conflito"** | |

### CA04 e CA05: dupla eliminação (só na versão completa)

- **CA04, cerca de 30 s.** No assistente, o robô remove 2 times e toca em *Águias* e *Titãs* (aparecem as coroas 1 e 2). Depois do sorteio, a 1ª rodada tem só 2 jogos. Na aba *Chaveamento*, Águias e Titãs aparecem **contra um BYE** (folga).
  > "Cabeça de chave não joga a primeira rodada."
- **CA05, cerca de 40 s.** Um time perde e cai para a **chave dos perdedores** (continua vivo). O robô registra mais 3 jogos sozinho. O time perde de novo e, no filtro **Próximas**, não tem mais nenhum jogo dele.
  > "Na dupla eliminação, só duas derrotas tiram um time."

---

## 5. Gancho para o slide 14 (sistema × aceitação)

Vale citar na comparação, depois das demonstrações:

> "Repare na diferença entre os dois testes: o de sistema fala a língua da especificação (pré-condição, passos, resultado esperado); o de aceitação fala a língua do cliente (Dado, Quando, Então).
>
> E achamos um exemplo real de 'passa no de sistema e reprova no de aceitação'. A especificação da agenda diz que a regra de um jogo por dia é relaxada se o período não couber. Com 8 times em 4 dias em vez de 16, a agenda coloca times jogando duas vezes no mesmo dia: ela cumpre a especificação, mas quebra o critério do cliente. Por isso o CA01 precisa dizer o período: 'Dado 8 times, 2 quadras, 2 árbitros **e 16 dias**'. É um defeito de requisito."

---

## 6. Plano B (se algo der errado ao vivo)

1. **Relatório do ensaio.** Abre no navegador, sem subir nada:
   ```bash
   npx playwright show-report relatorio-ensaio
   ```
   Para o relatório da última execução, use `npm run e2e:relatorio`.
   - **O que aparece:** a lista dos 8 testes com ✓ verde e a duração de cada um.
   - **Clique num teste:** aparecem os passos com os nomes Dado/Quando/Então ou Pré-condição/Passo/Esperado. Clique num passo para ver as ações de dentro dele.
   - **Na seção *Traces*, clique na imagem:** abre o *Trace Viewer*, com uma filmagem quadro a quadro. Em cima fica a linha do tempo, à esquerda cada ação e no centro a tela, com o ponto vermelho onde o robô clicou. Dá para avançar ação por ação e narrar como se fosse ao vivo.
2. **Vídeo gravado.** Grave a tela durante o ensaio:
   - Ubuntu: tecla `Print Screen` → ícone de vídeo → selecionar a tela;
   - Windows 11: `Win` + `Shift` + `S` → *Gravar*.
3. **GitHub Actions.** A aba *Actions* do repositório mostra o job **e2e** verde no último push.

**Problemas comuns:**

| Mensagem | O que fazer |
|---|---|
| `Executable doesn't exist` ou `Chromium distribution 'chrome' is not found` | Nenhum navegador foi encontrado. Instale o Google Chrome ou baixe o do Playwright: `npx playwright install chromium` |
| `port 3333` / `4173` *already in use* | Ficou uma execução anterior aberta: feche o outro terminal ou aperte `Ctrl` + `C` nele e rode de novo. |
| Um teste falhou ao vivo | "Isso é o teste fazendo o trabalho dele: achou uma diferença." Abra `npm run e2e:relatorio`: ele mostra o passo que falhou com a imagem da tela. Depois siga com o relatório do ensaio. |

---

## 7. Perguntas que podem aparecer

- **"Se é automatizado, é mesmo teste de aceitação?"**
  > "Sim. O critério é do cliente, a gente só automatizou a execução (isso tem nome: ATDD). A parte manual é o UAT com os colegas de fora do grupo."
- **"Por que não Cucumber?"**
  > "A ideia é a mesma. Os passos do Playwright têm os nomes Dado, Quando e Então e aparecem assim no relatório, sem precisar de outra ferramenta. Com Cucumber, o critério ficaria num arquivo `.feature` separado do código."
- **"Os testes mexem em dados reais?"**
  > "Não. Cada execução sobe uma API nova em memória com os dados de demonstração. Os testes de aceitação criam os próprios torneios, então não dependem uns dos outros."
- **"Quanto tempo leva sem câmera lenta?"**
  > "Os 8 juntos levam cerca de 1 minuto e meio com `npm run e2e`, que é o que roda no CI, sem janela."
