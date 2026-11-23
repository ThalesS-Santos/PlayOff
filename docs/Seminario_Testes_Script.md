# Seminário: Teste de Sistema e Teste de Aceitação no PlayOff

**Foco:** avaliação do sistema completo e atendimento às necessidades do cliente
**Equipe:** Amanda Lordello, Davi Braz, Saulo Sousa, Thales Sena e Victor Lopes
**Duração sugerida:** 15 a 20 minutos + 5 minutos de exercício

**Estrutura:** primeiro tudo do Teste de Sistema, depois tudo do Teste de Aceitação, e no fim a comparação entre os dois.

> A divisão de falas é só uma sugestão. Troquem os nomes como preferirem.
>
> | Fala | Slides |
> |---|---|
> | Fala 1 | 1, 2 (abertura) e 14, 15 (comparação e conclusão) |
> | Fala 2 | 3, 4, 5 (Teste de Sistema: conceito e como funciona) |
> | Fala 3 | 6, 7, 8 (Teste de Sistema: exemplo, ferramentas e demo) |
> | Fala 4 | 9, 10, 11 (Teste de Aceitação: conceito e como funciona) |
> | Fala 5 | 12, 13 (Teste de Aceitação: exemplo e ferramentas) |
> | Todos | 16, 17, 18 (exercício, referências e encerramento) |

---

# Abertura

## Slide 1: Capa (Fala 1, ~1 min)

> "Boa tarde! Somos o grupo do **PlayOff**, uma plataforma para criar, administrar e acompanhar campeonatos esportivos: do cadastro dos times até o campeão.
> Nosso tema são dois testes que trabalham **no topo da pirâmide**: o **Teste de Sistema** e o **Teste de Aceitação**. Os dois respondem a uma mesma pergunta: *o sistema inteiro funciona e entrega o que o cliente precisa?*
> Vamos primeiro explicar tudo do teste de sistema, depois tudo do teste de aceitação, e no fim comparar os dois."

## Slide 2: Onde esses testes ficam (Fala 1, ~1 min)

> "Na aula vimos a espiral do Pressman: primeiro unidade, depois integração, depois validação e sistema. Os testes unitários olham uma peça; os de integração olham as peças conversando. Os nossos dois olham **o sistema montado, do jeito que o usuário vai usar**."

| Nível | Pergunta que responde |
|---|---|
| Unidade | A função está certa? |
| Integração | As partes conversam? |
| **Sistema** | **O sistema completo funciona conforme a especificação?** |
| **Aceitação** | **O sistema resolve o problema do cliente?** |

---

# Parte 1: Teste de Sistema

## Slide 3: Abertura da Parte 1 (Fala 2, ~15 s)

> "Começamos pela primeira parte: tudo sobre o Teste de Sistema. Conceito, como funciona, exemplo no PlayOff, ferramentas e uma demonstração."

## Slide 4: Conceito (Fala 2, ~2 min)

> "**Teste de sistema** é testar o software **completo e integrado**, num ambiente parecido com o de produção, comparando o comportamento com os requisitos.
> O objetivo é achar falhas que só aparecem quando tudo está junto: frontend, API, banco, permissões, navegação."

- **Caixa-preta:** quem testa olha entrada e saída, não o código.
- **Funcional e não funcional:** o que o sistema faz, e também desempenho, segurança, usabilidade.
- **Quem executa:** equipe de QA, o grupo independente de teste (ITG) que vimos em aula.
- **Pergunta-chave:** *"Construímos certo do jeito certo?"* (verificação)

## Slide 5: Quando, quem e passo a passo (Fala 2, ~1 min 30)

> "O teste de sistema entra **depois do teste de integração**, quando o sistema está todo montado, e é feito pela **equipe de QA**, de preferência gente que não programou aquela parte."

1. Ler os requisitos (no PlayOff, RF01 a RF07).
2. Montar o ambiente de teste (frontend + API rodando).
3. Escrever os casos de teste (ID, pré-condição, passos, dados, resultado esperado).
4. Executar (manual ou automatizado).
5. Registrar defeitos, corrigir e testar de novo (regressão).

## Slide 6: Exemplo no PlayOff (Fala 3, ~3 min)

> "No PlayOff, a gente já tem testes de sistema automatizados de ponta a ponta, com o **Playwright**. Ele abre um navegador de verdade e usa o sistema como um usuário. Eles rodam a cada push no GitHub Actions."

| ID | Cenário (`frontend/e2e/playoff.spec.ts`) | Requisitos |
|---|---|---|
| ST01 | Organizador sorteia e registra súmula; o resultado continua lá depois de recarregar | RF03, RF05 |
| ST02 | Espectador não vê gestão; torneio privado só abre com o código certo | RF07, permissões |
| ST03 | Nova conta de organizador cria um torneio | RF07, RF01 |

**Caso de teste ST02 (modelo da aula):**
- **Pré-condição:** existe um torneio privado cadastrado.
- **Passos:** entrar como espectador (`visitante@playoff.dev` / `playoff123`) → abrir o torneio privado → digitar código errado → digitar código certo.
- **Resultado esperado:** nenhum botão de gestão aparece; código errado nega o acesso; o código certo abre o torneio.

## Slide 7: Ferramentas do Teste de Sistema (Fala 3, ~1 min)

| Ferramenta | Uso | No PlayOff |
|---|---|---|
| Playwright | Automatiza o navegador de ponta a ponta | Sim |
| GitHub Actions | Roda os testes a cada push (CI) | Sim |
| Swagger / Postman | Testar a API do sistema completo | Sim (`/docs`) |
| Selenium / Cypress | Alternativas ao Playwright | Não |
| JMeter / k6 | Desempenho e carga do sistema | Não |

> "No PlayOff a gente já usa os três primeiros. Selenium e Cypress são alternativas ao Playwright, e JMeter ou k6 servem para a parte não funcional, como desempenho."

## Slide 8: Demonstração (Fala 3, ~2 min)

```bash
cd frontend
npm run e2e
```

Para ver o navegador clicando sozinho: `npx playwright test --headed`.

> "Aqui estão os três testes passando: o Playwright fez login, sorteou a chave, registrou súmula e testou as permissões, tudo sozinho."

**Plano B:** vídeo gravado antes, ou a aba Actions do GitHub com o job `e2e` verde.

---

# Parte 2: Teste de Aceitação

## Slide 9: Abertura da Parte 2 (Fala 4, ~15 s)

> "Agora a segunda parte: tudo sobre o Teste de Aceitação. Saímos do *'funciona?'* e vamos para o *'é isso que o cliente precisa?'*."

## Slide 10: Conceito (Fala 4, ~2 min)

> "**Teste de aceitação** é a última etapa antes da entrega. Quem decide se passou é o **cliente ou usuário final**. Não basta funcionar: tem que atender à necessidade de negócio."

- **UAT (User Acceptance Testing):** usuários reais testam cenários do dia a dia.
- **Alfa e Beta:** alfa no ambiente do desenvolvedor; beta no ambiente do usuário, antes do lançamento.
- **Critérios de aceite:** escritos no formato **Dado / Quando / Então** (BDD).
- **Pergunta-chave:** *"Construímos o sistema certo?"* (validação)

## Slide 11: Quando, quem e passo a passo (Fala 4, ~1 min 30)

> "O teste de aceitação vem **no fim**, depois do teste de sistema e antes da entrega. Quem decide é o **cliente, os usuários finais ou o Product Owner**, com apoio da equipe."

1. Definir os critérios de aceitação com o cliente.
2. Escrever cenários Dado / Quando / Então.
3. O cliente executa ou acompanha os cenários.
4. Registrar o resultado: **aceito**, **aceito com ressalvas** ou **recusado**.

## Slide 12: Exemplo no PlayOff (Fala 5, ~3 min)

> "Para a aceitação, a gente se coloca no lugar do **cliente**: um organizador de campeonato, por exemplo a coordenação de jogos internos de uma faculdade. Ele não quer saber de API; quer organizar o campeonato sem dor de cabeça."

**CA01: Agenda sem conflitos (RF04)**
- **Dado** 8 times, 2 quadras e 2 árbitros,
- **Quando** o organizador gera a agenda,
- **Então** ninguém joga em dois lugares ao mesmo tempo e cada time joga no máximo uma vez por dia.

**CA02: O vencedor avança sozinho (RF03)**
- **Dado** um mata-mata em andamento,
- **Quando** o organizador registra a súmula,
- **Então** o vencedor aparece sozinho na próxima fase.

**CA03: Torcedor acompanha sem bagunçar (RF05)**
- **Dado** um espectador logado,
- **Quando** ele abre um torneio,
- **Então** vê chave, tabela e calendário, mas não edita nada.

**UAT:** 2 ou 3 colegas de fora do grupo recebem uma tarefa ("crie um campeonato de vôlei com 6 times e veja quem joga amanhã"), e a gente observa sem ajudar.

> Façam esse teste antes do seminário e contem na fala o que aconteceu de verdade (onde os colegas travaram, se cada critério foi aceito).

## Slide 13: Ferramentas do Teste de Aceitação (Fala 5, ~1 min)

| Ferramenta | Uso |
|---|---|
| Cucumber / Gherkin | Critérios Dado / Quando / Então que viram testes executáveis |
| Jira / TestRail | Registrar critérios, execuções e resultados do UAT |
| Planilha de UAT | Cenário, usuário, resultado e observações |
| Formulário de feedback | Coletar a opinião dos usuários depois do teste |

> "A ferramenta mais conhecida é o Cucumber, que transforma os cenários Dado/Quando/Então em testes automáticos. Para organizar o UAT, serve Jira, TestRail ou até uma planilha simples."

---

# Fechamento

## Slide 14: Sistema × Aceitação (Fala 1, ~1 min 30)

| | Teste de Sistema | Teste de Aceitação |
|---|---|---|
| Objetivo | Verificar se cumpre a especificação | Validar se atende ao cliente |
| Quem executa | Equipe de QA / testadores | Cliente, usuários, Product Owner |
| Quando | Depois da integração | Antes da entrega |
| Base | Requisitos e especificação | Necessidades de negócio |
| Resultado | Lista de defeitos | Aceite ou recusa do produto |

> "Agora que vimos os dois, dá para comparar: o teste de sistema diz *'está funcionando como especificado'*; o de aceitação diz *'é isso que eu queria'*. Um sistema pode passar no primeiro e reprovar no segundo, se o requisito foi mal entendido. É o **defeito de requisito** que vimos em aula."

## Slide 15: Conclusão (Fala 1, ~1 min)

**Vantagens:**
- Testam o sistema como o usuário realmente usa.
- Pegam falhas de integração, permissões e navegação que testes de unidade não pegam.
- Garantem que o produto resolve o problema certo.

**Limitações:**
- Mais lentos e caros de escrever e manter.
- Quando falham, é mais difícil achar onde está o defeito.
- Dependem da disponibilidade do cliente e não substituem os testes de unidade.

> "Lembrando o princípio da aula: teste mostra a presença de defeitos, não sua ausência."

## Slide 16: Exercício para a turma (todos, ~5 min)

**Antes do slide: quiz no Kahoot ou Quizizz (5 perguntas):**

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

**No slide: "erro proposital".**
> *"O sistema deve ser rápido e fácil de usar."*
> Pergunta à turma: por que esse critério não serve? Como reescrever?
> Resposta (aparece com um clique): não dá para medir. Melhor: *"Dado um torneio com 16 times, quando o organizador gerar a chave, então ela aparece em menos de 2 segundos."*

## Slide 17: Referências (todos, ~15 s)

- PRESSMAN, Roger S.; MAXIM, Bruce R. *Engenharia de software: uma abordagem profissional*. 9. ed. Porto Alegre: AMGH, 2021.
- SOMMERVILLE, Ian. *Engenharia de software*. 10. ed. São Paulo: Pearson, 2018.
- MORAIS, Izabelly S.; ZANIN, Aline. *Engenharia de software*. Porto Alegre: SAGAH, 2020.
- DELAMARO, Márcio E.; MALDONADO, José C.; JINO, Mario. *Introdução ao teste de software*. 2. ed. Rio de Janeiro: Elsevier, 2016.
- MYERS, Glenford J.; SANDLER, Corey; BADGETT, Tom. *The art of software testing*. 3. ed. Hoboken: Wiley, 2011.
- ISTQB. *Certified Tester Foundation Level Syllabus*, v4.0. 2023. Disponível em: https://www.istqb.org.
- ISO/IEC/IEEE. *29119-1: Software and systems engineering — Software testing — Part 1: Concepts and definitions*. 2022.
- PLAYWRIGHT. *Documentação oficial*. Microsoft. Disponível em: https://playwright.dev.

> Confiram edição e ano nas versões que vocês consultaram, e citem só o que usaram.

## Slide 18: Encerramento

> "Obrigado! Perguntas?"

**Lembrete:** postar o arquivo da apresentação no **Canvas no dia** e incluir esse conteúdo no documento final do projeto.
