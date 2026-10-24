# PlayOff

Plataforma web para **criar, administrar e acompanhar campeonatos esportivos**: do cadastro dos times ao campeão, com chaveamento automático, agenda sem conflitos, súmulas por tipo de esporte e identidade visual por organização.

Projeto acadêmico. **Equipe:** Amanda Lordello, Davi Braz, Saulo Sousa, Thales Sena e Victor Lopes · **Docente:** Claudia Simões.

> **Estado atual:**
> - **Frontend:** completo. Roda em dois modos:
>   - **ligado à API**, com login real por e-mail e senha;
>   - **demonstração**, sem servidor, com os dados no navegador, para apresentações.
> - **Backend (API):** pronto e testado com dados em memória, com permissões no servidor e as mesmas regras do frontend.
> - **Oracle:** esquema e repositório testados num Oracle 23ai Free de verdade a cada push, no CI ([backend/db](backend/db/README.md)).

## Funcionalidades

| Requisito | O que o protótipo faz |
|---|---|
| **RF01** Torneios personalizáveis | Assistente de criação; formatos **eliminação simples**, **dupla eliminação** (3 a 32 times, com byes), **fase de grupos + mata-mata**, **pontos corridos** (turno ou turno e returno) e **prova** (colocação); ciclo de vida *em criação → inscrições abertas → chaveamento definido → em andamento → finalizado / cancelado* |
| **RF02** Cadastro de times | Times com elenco (camisa, apelido), técnico, cor e sigla; árbitros; inscrição por modalidade; cabeças de chave |
| **RF03** Chaveamento e súmulas | Sorteio com cabeças de chave e byes; nº de grupos e classificados configuráveis; súmulas de **pontos** (com pênaltis e cartões), **sets** e **colocação/tempo**; o vencedor avança sozinho na chave |
| **RF04** Otimização da agenda | Agenda sem conflito de local, árbitro ou time, um jogo por time por dia, fases em dias seguidos; reagendamento manual com checagem de conflitos |
| **RF05** Painel visual | Chave interativa, tabelas de classificação, calendário em **lista** ou em **grade** (por dia ou por local), painel do organizador |
| **RF06** Identidade visual | Nome, sigla e cor da organização aplicados aos seus torneios |
| **RF07** Login | Cadastro e login com e-mail e senha (hash scrypt, token JWT) nos perfis **organizador** e **espectador**; no modo demonstração, login simulado |

**Permissões:** só o organizador dono do torneio cadastra, sorteia, registra súmulas e edita; o espectador só visualiza e favorita. Torneios privados pedem código de acesso (bloqueio temporário após 5 tentativas erradas).

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 20 ou mais recente.

### Com a API (login real)

Em um terminal, a API:

```bash
cd backend
npm install
npm run dev
```

Em outro, o frontend apontando para ela:

```bash
cd frontend
npm install
npm run dev:api
```

A documentação da API (Swagger) fica em http://127.0.0.1:3333/docs.

Abra http://localhost:5173 e entre com `organizador@playoff.dev` ou `visitante@playoff.dev`, senha `playoff123`, ou crie uma conta. Os dados ficam na API em memória e voltam ao início quando ela reinicia; para guardar de verdade, use o Oracle ([backend/db](backend/db/README.md)).

### Modo demonstração (sem servidor)

```bash
cd frontend
npm run dev
```

Entre como **Organizador** ou **Espectador**, sem senha.

Dados de demonstração:
- **Copa Interclasse Horizonte 2026**: futsal, vôlei e natação em andamento (os três tipos de súmula).
- **Liga Corporativa Society**: torneio **privado**, código `PLAY2026`, com conflitos de agenda para testar a otimização.
- **Circuito Beach Tennis Verão**: inscrições abertas, pronto para sortear.
- **Copa Bairro Basquete 3x3**: finalizado, de outro organizador (o organizador da demonstração só visualiza).

No modo demonstração, o menu do usuário tem **Restaurar demonstração** para voltar aos dados iniciais. Rotas da API, usuários e configuração do Oracle estão no [README do backend](backend/README.md).

## Testes e qualidade

Os mesmos comandos valem em `frontend/` e em `backend/`:

```bash
cd frontend
npm test          # testes + cobertura (falha abaixo de 95%)
npm run lint      # falha com qualquer aviso
npm run typecheck # checagem de tipos, incluindo os testes
npm run build     # build de produção
npm run e2e       # (só frontend) ponta a ponta: navegador + API reais
```

- **Motor** (`src/lib`): chaveamentos, classificação e desempate, agenda, regras de negócio e permissões, testados com funções puras.
- **Telas** (`src/test`): fluxos completos com Testing Library, simulando organizador e espectador.
- **Contra falso positivo:** qualquer `console.error`/`console.warn` durante um teste faz o teste falhar.
- **API** (`backend/src/test`): requisições HTTP de verdade contra a API em memória, incluindo um campeonato completo, a recusa de cada rota de gestão para quem não é o dono, e a conversão para as tabelas Oracle conferida contra o próprio DDL.
- **Modo API** (`frontend/src/test/api-mode.test.tsx`): as telas contra o **backend real** rodando dentro do teste (sem imitação), incluindo login, sessão expirada, código de torneio privado conferido no servidor e regras recusadas pela API aparecendo na tela.
- **Ponta a ponta** (`frontend/e2e`, Playwright): navegador de verdade, API e frontend compilado rodando como servidores. No Windows usa o Edge já instalado; no CI, o Chromium.
- **Oracle** (`npm run test:oracle` no backend): os mesmos testes da API gravando num Oracle de verdade. O teste de contrato do repositório confere que memória e Oracle se comportam igual.
- **CI:** o GitHub Actions roda lint, tipos, testes e build do frontend e do backend. Depois roda os testes contra um Oracle 23ai Free, que sobe só para isso, e os de ponta a ponta. Vale para todo push na `main` e no `devops` e para todo pull request.

## Estrutura

```
docs/                     documentação do projeto (requisitos, modelagem, relatório geral)
frontend/
  src/lib/                regras puras: engine (chave/agenda), tournament (ciclo de vida),
                          registry (cadastros), permissions, state (reducer), format
  src/components/         componentes de interface
  src/pages/              telas
  src/test/               testes de interface
backend/
  src/                    API (Fastify): rotas, autenticação, repositórios (memória e Oracle)
  db/                     scripts SQL do Oracle
.github/workflows/ci.yml  integração contínua
```

## Documentação

- [`docs/Relatorio Geral.md`](docs/Relatorio%20Geral.md): visão geral, regras de negócio, modelo de dados, arquitetura proposta e roadmap
- [`docs/Requisitos Funcionais_PlayOff.pdf`](docs/Requisitos%20Funcionais_PlayOff.pdf): RF01 a RF07
- [`docs/PlayOff.pdf`](docs/PlayOff.pdf): DER, modelo relacional e diagramas UML
