# Seminário: Teste de Sistema e Teste de Aceitação no PlayOff

**Foco:** avaliação do sistema completo e atendimento às necessidades do cliente
**Equipe:** Amanda Lordello, Davi Braz, Saulo Sousa, Thales Sena e Victor Lopes
**Duração sugerida:** 15 a 20 minutos + 5 minutos de exercício

> A divisão de falas abaixo é só uma sugestão. Troquem os nomes como preferirem.

---

## Slide 1: Abertura (Fala 1, ~1 min)

> "Boa tarde! Somos o grupo do **PlayOff**, uma plataforma para criar, administrar e acompanhar campeonatos esportivos: do cadastro dos times até o campeão.
> Nosso tema são dois testes que trabalham **no topo da pirâmide**: o **Teste de Sistema** e o **Teste de Aceitação**. Os dois respondem a uma mesma pergunta: *o sistema inteiro funciona e entrega o que o cliente precisa?*"

**No slide:** logo do PlayOff, título, nomes, a pirâmide de testes com os dois níveis destacados.

---

## Slide 2: Onde esses testes ficam (Fala 1, ~1 min)

> "Na aula vimos a espiral do Pressman: primeiro unidade, depois integração, depois validação e sistema. Os testes unitários olham uma peça; os de integração olham as peças conversando. Os nossos dois olham **o sistema montado, do jeito que o usuário vai usar**."

**No slide:** espiral/pirâmide da aula com a seta "direção do teste" subindo até *Requisitos*.

| Nível | Pergunta que responde |
|---|---|
| Unidade | A função está certa? |
| Integração | As partes conversam? |
| **Sistema** | **O sistema completo funciona conforme a especificação?** |
| **Aceitação** | **O sistema resolve o problema do cliente?** |

---

## Slide 3: Teste de Sistema, conceito (Fala 2, ~2 min)

> "**Teste de sistema** é testar o software **completo e integrado**, num ambiente parecido com o de produção, comparando o comportamento com os requisitos.
> O objetivo é achar falhas que só aparecem quando tudo está junto: frontend, API, banco, permissões, navegação."

**Características:**
- Caixa-preta: quem testa olha entrada e saída, não o código.
- Testa **requisitos funcionais** (o que o sistema faz) e **não funcionais** (desempenho, segurança, usabilidade, compatibilidade).
- Ambiente o mais próximo possível do real.
- Normalmente feito pela equipe de testes / QA (o ITG da aula), não por quem escreveu o código.

**Pergunta-chave:** *"Construímos o sistema **certo do jeito certo**?"* (verificação)

---

## Slide 4: Teste de Aceitação, conceito (Fala 3, ~2 min)

> "**Teste de aceitação** é a última etapa antes da entrega. Quem decide se passou é o **cliente ou usuário final**. Não basta funcionar: tem que atender à necessidade de negócio."

**Tipos:**
- **UAT (User Acceptance Testing):** usuários reais testam cenários do dia a dia.
- **Alfa:** usuários testam no ambiente do desenvolvedor.
- **Beta:** usuários testam no próprio ambiente, antes do lançamento.
- **Aceitação contratual/regulatória:** confere se cumpre contrato ou norma.

**Critérios de aceitação** costumam ser escritos no formato **Dado / Quando / Então** (BDD).

**Pergunta-chave:** *"Construímos o **sistema certo**?"* (validação)

---

## Slide 5: Sistema x Aceitação (Fala 3, ~1 min)

| | Teste de Sistema | Teste de Aceitação |
|---|---|---|
| Objetivo | Verificar se cumpre a especificação | Validar se atende ao cliente |
| Quem executa | Equipe de QA / testadores | Cliente, usuários, Product Owner |
| Quando | Depois da integração | Antes da entrega / implantação |
| Base | Requisitos e especificação | Necessidades de negócio, critérios de aceite |
| Resultado | Lista de defeitos | Aceite ou recusa do produto |

> "Resumindo: o teste de sistema diz *'está funcionando como especificado'*; o de aceitação diz *'é isso que eu queria'*. Um sistema pode passar no primeiro e reprovar no segundo, se o requisito foi mal entendido. É o **defeito de requisito** que vimos em aula."

---

## Slide 6: Quando e como funcionam (Fala 2, ~2 min)

**Passo a passo do Teste de Sistema:**
1. Ler os requisitos (no nosso caso, RF01 a RF07).
2. Montar o ambiente de teste (frontend + API rodando).
3. Escrever os casos de teste (ID, pré-condição, passos, dados, resultado esperado).
4. Executar (manual ou automatizado).
5. Registrar defeitos, corrigir, testar de novo (regressão).

**Passo a passo do Teste de Aceitação:**
1. Definir com o cliente os **critérios de aceitação** de cada requisito.
2. Escrever cenários reais do usuário (Dado / Quando / Então).
3. O cliente executa ou acompanha.
4. Registrar o resultado: **aceito**, **aceito com ressalvas** ou **recusado**.

---

## Slide 7: Exemplo no PlayOff, Teste de Sistema (Fala 4, ~3 min)

> "No PlayOff, a gente já tem testes de sistema automatizados de ponta a ponta, com o **Playwright**. Ele abre um navegador de verdade e usa o sistema como um usuário."

Testes que existem no projeto (`frontend/e2e/playoff.spec.ts`), rodando a cada push no GitHub Actions:

| ID | Cenário | Requisitos cobertos |
|---|---|---|
| ST01 | Organizador sorteia o chaveamento e registra a súmula; o resultado continua lá depois de recarregar a página | RF03, RF05, persistência |
| ST02 | Espectador não vê as opções de gestão; torneio privado só abre com o código certo | RF07, permissões, segurança |
| ST03 | Uma nova conta de organizador cria um torneio | RF07, RF01 |

**Caso de teste detalhado (modelo da aula):**

- **ID:** ST02
- **Descrição:** Verificar que o espectador não acessa funções de organizador e que torneio privado exige código.
- **Pré-condição:** Existe um torneio privado cadastrado.
- **Passos:** Entrar como espectador → abrir a lista de torneios → abrir o torneio privado → digitar código errado → digitar código certo.
- **Dados de entrada:** `visitante@playoff.dev` / `playoff123`, código errado e código correto.
- **Resultado esperado:** Nenhum botão de gestão aparece; com código errado o acesso é negado; com o código certo o torneio abre.

---

## Slide 8: Exemplo no PlayOff, Teste de Aceitação (Fala 5, ~3 min)

> "Para a aceitação, a gente se coloca no lugar do **cliente**: um organizador de campeonato, por exemplo a coordenação de jogos internos de uma faculdade. Ele não quer saber de API; quer organizar o campeonato sem dor de cabeça."

**Critérios de aceitação (Dado / Quando / Então):**

**CA01: Agenda sem conflitos (RF04)**
- **Dado** um torneio com 8 times, 2 quadras e 2 árbitros,
- **Quando** o organizador gera a agenda,
- **Então** nenhum time, quadra ou árbitro aparece em dois jogos ao mesmo tempo, e cada time joga no máximo uma vez por dia.

**CA02: O vencedor avança sozinho (RF03)**
- **Dado** um torneio de eliminação simples em andamento,
- **Quando** o organizador registra a súmula de um jogo,
- **Então** o vencedor aparece automaticamente na próxima fase da chave.

**CA03: Torcedor acompanha sem bagunçar (RF05 + permissões)**
- **Dado** um espectador logado,
- **Quando** ele abre um torneio,
- **Então** vê chave, tabela e calendário, mas não consegue editar nada.

**Roteiro de UAT:** chamar 2 ou 3 colegas de fora do grupo, dar uma tarefa ("crie um campeonato de vôlei com 6 times e veja quem joga amanhã") e observar sem ajudar. Anotar onde travaram.

| Critério | Resultado | Observação do usuário |
|---|---|---|
| CA01 | ✅ Aceito | |
| CA02 | ✅ Aceito | |
| CA03 | ✅ Aceito | |

> (Preencham essa tabela com o que acontecer de verdade nos testes com os colegas.)

---

## Slide 9: Ferramentas (Fala 4, ~1 min)

| Ferramenta | Uso | No PlayOff? |
|---|---|---|
| **Playwright** | Teste de sistema automatizado no navegador | ✅ Sim |
| Selenium / Cypress | Alternativas ao Playwright | |
| **GitHub Actions** | Roda os testes a cada push (CI) | ✅ Sim |
| Cucumber / Gherkin | Critérios de aceitação em Dado/Quando/Então executáveis | |
| TestRail / Jira / planilha | Gestão de casos de teste e resultados de UAT | |
| Postman / Swagger | Testar a API do sistema completo | ✅ Swagger em `/docs` |

---

## Slide 10: Demonstração (Fala 4, ~2 min)

**Opção A, ao vivo:**
```bash
cd frontend
npm run e2e
```
Mostrar os 3 testes passando. Se quiserem ver o navegador clicando: `npx playwright test --headed`.

**Opção B, segura:** gravar um vídeo curto antes (ou mostrar o relatório do Playwright / a aba Actions do GitHub com o job `e2e` verde).

> Dica: tenham o vídeo pronto mesmo se forem fazer ao vivo, caso a rede ou o computador falhem.

---

## Slide 11: Conclusão (Fala 5, ~1 min)

**Vantagens:**
- Testam o sistema como o usuário realmente usa.
- Encontram falhas que testes de unidade não pegam (integração, permissões, navegação).
- O de aceitação garante que o produto resolve o problema certo e dá confiança para a entrega.

**Limitações:**
- Mais lentos e caros de escrever e manter.
- Quando falham, é mais difícil achar onde está o defeito (aí entra a depuração).
- Aceitação depende da disponibilidade do cliente/usuário.
- Não substituem os testes de unidade e integração: "teste mostra a presença de defeitos, não sua ausência".

**Referências:**
- PRESSMAN, R. S.; MAXIM, B. R. *Engenharia de Software*. 9. ed. AMGH, 2021.
- MORAIS, I. S.; ZANIN, A. *Engenharia de Software*. SAGAH, 2020.
- SOMMERVILLE, I. *Engenharia de Software*. 10. ed. Pearson, 2018.
- Documentação do Playwright: https://playwright.dev

---

## Slide 12: Exercício para a turma (todos, ~5 min)

**Quiz no Kahoot ou Quizizz (5 perguntas):**

1. Quem decide se um teste de aceitação passou?
   a) O desenvolvedor · **b) O cliente/usuário** · c) O compilador · d) O banco de dados
2. Teste de sistema responde a qual pergunta?
   **a) O sistema completo cumpre a especificação?** · b) A função soma está certa? · c) O cliente gostou da cor? · d) O código compila?
3. "Dado / Quando / Então" é usado para escrever:
   a) Testes unitários · **b) Critérios de aceitação** · c) Consultas SQL · d) Commits
4. Verdadeiro ou falso: se passou no teste de sistema, com certeza passa no de aceitação.
   **Falso**: o requisito pode ter sido mal entendido.
5. Qual ferramenta o PlayOff usa para testes de sistema?
   a) Excel · b) Kahoot · **c) Playwright** · d) Photoshop

**"Erro proposital" (alternativa):** mostrar um critério de aceitação mal escrito e pedir para a turma corrigir.
> *"O sistema deve ser rápido e fácil de usar."*
> Resposta esperada: não dá para testar. Melhor: *"Dado um torneio com 16 times, quando o organizador gerar a chave, então ela aparece em menos de 2 segundos."*

---

## Slide 13: Encerramento

> "Obrigado! Perguntas?"

**Lembrete:** postar o arquivo da apresentação no **Canvas no dia** e incluir esse conteúdo no documento final do projeto.
