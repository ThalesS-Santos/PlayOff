# Banco de dados Oracle

> **Estado:** os scripts e o repositório Oracle (`src/repo/oracle-repo.ts`) foram escritos, mas **ainda não rodaram num Oracle real**. A conversão entre o domínio e as linhas está testada (`src/test/oracle-mapper.test.ts`), inclusive contra as colunas deste DDL. Ao instalar o banco, siga os passos abaixo e rode `npm run db:seed` para validar.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `001_schema.sql` | Cria as 22 tabelas, chaves, `CHECK`s e índices |
| `000_drop.sql` | Apaga todas as tabelas do PlayOff (para recriar do zero) |

## 1. Subir o Oracle 23ai Free (Docker)

Com o Docker Desktop aberto:

```bash
docker run -d --name playoff-oracle -p 1521:1521 -e ORACLE_PASSWORD=SenhaDoAdmin123 -e APP_USER=playoff -e APP_USER_PASSWORD=playoff123 gvenzl/oracle-free:23-slim
```

O primeiro início leva alguns minutos. Acompanhe até aparecer `DATABASE IS READY TO USE!`:

```bash
docker logs -f playoff-oracle
```

A imagem já cria o usuário da aplicação (`playoff` / `playoff123`) no banco `FREEPDB1`.

## 2. Conectar pelo SQL Developer

Nova conexão:
- **Usuário:** `playoff` · **Senha:** `playoff123`
- **Host:** `localhost` · **Porta:** `1521`
- **Nome do serviço:** `FREEPDB1`

Abra `001_schema.sql` e execute como script (F5).

## 3. Apontar a API para o Oracle

Em `backend/.env` (copie de `.env.example`):

```
PLAYOFF_REPO=oracle
ORACLE_USER=playoff
ORACLE_PASSWORD=playoff123
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1
JWT_SECRET=troque-por-um-valor-longo-e-aleatorio
```

Carregue os dados de demonstração e suba a API:

```bash
npm run db:seed
```

```bash
npm run dev
```

## Modelo

Baseado no modelo relacional de `docs/PlayOff.pdf`, com os ajustes propostos na seção 7.3 do relatório:

- **USUARIO**, **ORGANIZACAO**, **FAVORITO** e **ACESSO_TORNEIO**: login (RF07), identidade por organização (RF06), favoritos e torneios privados liberados por código.
- **TORNEIO** separa `VISIBILIDADE` (público/privado) de `STATUS` (ciclo de vida).
- **MODALIDADE** pertence ao torneio (no lugar de `TORNEIO_MODALIDADE`); **PARTICIPACAO** liga o time à modalidade e guarda a ordem de cabeça de chave.
- **SUMULA** é a generalização; **SUMULA_PONTOS**, **SUMULA_SET** e **SUMULA_COLOCACAO** são as especializações.
- **PARTIDA** guarda o caminho na chave (`PROX_PARTIDA`, `PROX_PERDEDOR` da dupla eliminação), com chaves estrangeiras `DEFERRABLE INITIALLY DEFERRED`: são verificadas no fim da transação, o que permite inserir as partidas em qualquer ordem.
- **CARTAO** guarda o time e o jogador sem chave estrangeira, para o histórico da súmula sobreviver a mudanças no elenco.

Gravar um torneio é uma única transação (RN12): atualiza `TORNEIO`, apaga as tabelas filhas (em cascata) e insere tudo de novo. Se algo falhar, nada é gravado.
