# Rafaela Colussi — Sistema de Gestão Interna

Sistema web interno para gestão da confeitaria artesanal Rafaela Colussi:
produtos, custos, pedidos, produção, estoque, compras, financeiro, clientes,
marketing, metas, projetos e tarefas.

> Status: Fase 1 — Fundação concluída (autenticação completa). Próxima: Fase 2 — Catálogo e custos.

## Stack

- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM, Zod
- **Banco:** PostgreSQL (via Docker no desenvolvimento)
- **Testes:** Vitest e Supertest (unitários e de integração com banco próprio)
- **Arquitetura:** monólito modular com API REST

## Estrutura

- `backend/` — API (`src/modules/<módulo>` para cada área do sistema)
- `frontend/` — interface web (`src/features/<área>` para cada área do sistema)
- `docs/decisions/` — decisões arquiteturais, com o motivo de cada uma
- `docker-compose.yml` — PostgreSQL do ambiente de desenvolvimento

## Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) 24 ou mais novo
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) aberto (para o PostgreSQL)

### Primeira vez

1. **Configuração do backend:** copie `backend/.env.example` para `backend/.env` e preencha com valores
   reais (senha do banco, e-mails e senhas das usuárias iniciais).

2. **Dependências** — em cada projeto:

   ```powershell
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

3. **Banco de dados** — dentro de `backend/`:

   ```powershell
   npm run db:up       # sobe o PostgreSQL no Docker
   npm run db:migrate  # cria as tabelas
   npm run db:seed     # cria as usuárias iniciais (Daniela e Rafaela)
   ```

   Depois do seed, apague as senhas (`SEED_*_PASSWORD`) do `.env`: elas já estão no banco, guardadas como hash.

### Dia a dia

São dois terminais, um para cada parte:

```powershell
# Terminal 1 — backend (API em http://localhost:3000)
cd backend
npm run db:up
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

Abra **http://localhost:5173**. Em desenvolvimento, o frontend repassa as chamadas `/api` para o backend.

### Senha esquecida

- **Pelo site:** "Esqueci minha senha" na tela de login. Em desenvolvimento não há envio de e-mail:
  o link de redefinição aparece **no terminal do backend**.
- **Pelo terminal** (plano B), dentro de `backend/`:

  ```powershell
  npm run user:set-password -- email@exemplo.com
  ```

### Comandos úteis

| Onde        | Comando                | O que faz                                                            |
| ----------- | ---------------------- | -------------------------------------------------------------------- |
| `backend/`  | `npm test`             | Testes (os de integração usam o banco `<nome>_test`, criado sozinho) |
| `backend/`  | `npm run typecheck`    | Verifica os tipos do TypeScript                                      |
| `backend/`  | `npm run db:generate`  | Gera uma migration depois de alterar `src/database/schema`           |
| `backend/`  | `npm run db:down`      | Desliga o PostgreSQL (os dados continuam guardados)                  |
| `frontend/` | `npm run build`        | Verifica os tipos e gera a versão de produção                        |
| `frontend/` | `npm run lint`         | Procura problemas comuns no código                                   |
| os dois     | `npm run format`       | Formata o código com o Prettier                                      |
| os dois     | `npm run format:check` | Só confere a formatação, sem alterar                                 |

A cada push na `main`, o GitHub roda testes, tipos, lint, formatação e build dos dois projetos
(`.github/workflows/ci.yml`). O resultado aparece na aba **Actions** do repositório.

## Documentação

- [Decisões arquiteturais](docs/decisions/)
