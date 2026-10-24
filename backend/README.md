# PlayOff: backend (API)

Node.js + TypeScript + [Fastify](https://fastify.dev). Login com senha (hash scrypt) e token JWT, permissões no servidor e persistência em **memória** (desenvolvimento e testes) ou **Oracle**.

As regras de negócio (chaveamento, agenda, súmulas, ciclo de vida, permissões) **não são reimplementadas aqui**: o servidor importa as mesmas funções do frontend (`frontend/src/lib`, via `src/domain.ts`) e as aplica antes de gravar. A regra é a mesma nos dois lados.

## Como rodar

```bash
cd backend
npm install
npm run dev
```

A API sobe em http://127.0.0.1:3333 com os dados de demonstração em memória (somem ao reiniciar).

Usuários de demonstração, todos com a senha `playoff123`:

| E-mail | Perfil |
|---|---|
| `organizador@playoff.dev` | Organizador da Liga Horizonte (dono de 3 torneios) |
| `visitante@playoff.dev` | Espectador |
| `arena@playoff.dev` | Organizador da Arena Litoral (dono do torneio de basquete) |

Para usar o Oracle, veja [db/README.md](db/README.md).

## Comandos

```bash
npm test          # testes + cobertura (falha abaixo de 95%)
npm run lint      # falha com qualquer aviso
npm run typecheck
npm run build     # gera dist/server.js
npm start         # roda o build
npm run db:seed   # carrega a demonstração no Oracle
```

## API (`/api/v1`)

Autenticação: cabeçalho `Authorization: Bearer <token>`. Erros sempre como `{ code, message }`.

| Status | Quando |
|---|---|
| 400 `validacao` | Formato inválido (campo faltando, tipo errado) |
| 401 | Sem login ou token inválido/expirado |
| 403 | Sem permissão (não é o dono) ou torneio privado sem código |
| 404 | Não encontrado |
| 409 | E-mail já cadastrado |
| 422 `regra` | Regra de negócio violada (ex.: "Set 1 empatado: todo set tem um vencedor.") |
| 429 | Muitas tentativas de código de acesso |

### Conta e organização

| Método | Rota | Quem |
|---|---|---|
| POST | `/auth/registro` `{ name, email, password, role, orgName? }` | Público. Organizador cria a própria organização |
| POST | `/auth/login` `{ email, password }` → `{ token, user }` | Público |
| GET | `/me` → `{ user, unlocked }` | Logado |
| GET | `/organizacoes` | Público |
| PUT | `/organizacoes/:id` `{ name, short, hue }` | Organizador da própria organização |

### Torneios

| Método | Rota | Quem |
|---|---|---|
| GET | `/torneios` | Público. Privados vêm com `locked: true` e sem times, partidas e prêmios |
| GET | `/torneios/:id` | Público, ou com acesso liberado se for privado |
| POST | `/torneios` (rascunho do assistente) | Organizador |
| PATCH | `/torneios/:id` (dados, período, espaços, visibilidade) | Dono |
| DELETE | `/torneios/:id` | Dono |
| POST | `/torneios/:id/acesso` `{ code }` | Logado (bloqueio após 5 erros) |
| PUT / DELETE | `/torneios/:id/favorito` | Logado e com acesso |

### Gestão (só o organizador dono)

| Método | Rota |
|---|---|
| POST | `/torneios/:id/transicoes` `{ status }` |
| POST | `/torneios/:id/modalidades/:mid/sorteio` `{ groupCount?, advance?, returno? }` |
| POST | `/torneios/:id/agenda/otimizar` |
| PUT / DELETE | `/torneios/:id/partidas/:pid/agendamento` `{ date, time, venue, referee }` (fixar / liberar) |
| POST | `/torneios/:id/modalidades/:mid/partidas/:pid/sumula` `{ sumula, aoVivo? }` |
| PUT / DELETE | `/torneios/:id/times/:tid` `{ team, modalityIds }` |
| POST | `/torneios/:id/modalidades/:mid/cabecas/:tid` (alterna cabeça de chave) |
| POST / DELETE | `/torneios/:id/arbitros` `{ name }` · `/torneios/:id/arbitros/:nome` |
| PUT / DELETE | `/torneios/:id/premios/:pzid` |

Ao ler um torneio, o código de acesso só aparece para o dono, e `favoritedBy` só mostra se **você** favoritou (nunca a lista de quem favoritou).

## Estrutura

```
src/
  domain.ts        regras de negócio (as mesmas do frontend)
  app.ts           montagem da API, identificação do usuário, tratamento de erros
  http.ts          erros HTTP e checagens de permissão (canView/canManage)
  schemas.ts       formato dos dados de entrada (zod)
  routes/          auth, torneios, gestão
  auth/            senha (scrypt) e token (JWT)
  repo/            contrato, memória, Oracle (+ conversor testado)
db/                scripts SQL do Oracle
```
