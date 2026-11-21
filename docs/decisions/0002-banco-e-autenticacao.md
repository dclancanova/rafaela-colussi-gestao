# 0002 — Banco de dados e autenticação

Data: 16/11/2026 · Status: aceitas

Continua a sequência de [0001](0001-decisoes-iniciais.md). Reconstruídas a partir
do código já escrito; R e U já eram citadas nos comentários do código.

| #   | Decisão                                                                                                                  | Motivo                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| N   | IDs `bigint` gerados pelo banco (`generated always as identity`) e datas `timestamptz` em todas as tabelas               | Padrão único; sem ambiguidade de fuso horário                                                                   |
| O   | E-mail sempre minúsculo, normalizado na aplicação e garantido por `CHECK` no banco                                       | Evita contas duplicadas por diferença de maiúsculas                                                             |
| P   | Perfis `admin` e `member`; usuário é desativado (`is_active`), nunca excluído                                            | Permissões simples; histórico e auditoria preservados                                                           |
| Q   | Senhas com Argon2id (19 MiB, 2 iterações — mínimo da OWASP) e mínimo de 10 caracteres                                    | Algoritmo recomendado atualmente, resistente a GPU                                                              |
| R   | O banco guarda só o hash SHA-256 do token de sessão; o token em si vai apenas no cookie                                  | Se o banco vazar, os hashes não servem para entrar. SHA-256 basta porque o token é aleatório (256 bits)         |
| S   | No login com e-mail inexistente, verifica-se a senha contra um hash falso                                                | O tempo de resposta não revela quais e-mails têm conta                                                          |
| T   | Usuárias iniciais (Daniela e Rafaela, admins) criadas por seed idempotente lendo e-mail e senha do `.env`                | Nenhuma senha no Git; rodar o seed de novo não altera contas existentes                                         |
| U   | Sessão expira em 14 dias                                                                                                 | Equilíbrio entre comodidade (uso diário) e segurança                                                            |
| V   | Tabela genérica `audit_log` (usuário, entidade, ação, mudanças em JSON)                                                  | Um só lugar para rastrear quem alterou o quê, em qualquer módulo                                                |
| W   | Login e logout gravam em `audit_log` na mesma transação da ação; login com falha não é auditado                          | Sessão e registro nunca ficam inconsistentes; tentativas falhas já são tratadas pelo limite de tentativas (Y)   |
| X   | Sessões vencidas são apagadas ao iniciar o servidor e a cada 6 horas, sem registro na auditoria                          | Evita que `sessions` cresça para sempre; a auditoria é para ações de pessoas, não manutenção do sistema         |
| Y   | Login limitado a 10 tentativas falhas por IP a cada 15 minutos (HTTP 429); logins certos não contam; contagem em memória | Dificulta adivinhar senhas sem bloquear o uso diário; um único servidor dispensa banco ou Redis para a contagem |

W a Y adicionadas em 21/11/2026.

## Pendências

- **`trust proxy` em produção:** se a API ficar atrás de um proxy (Nginx ou a plataforma de hospedagem),
  configurar `app.set('trust proxy', ...)`. Sem isso, o limite de tentativas (Y) enxerga o IP do proxy e
  bloquearia todas as usuárias juntas.
