# 0001 — Decisões arquiteturais iniciais

Data: 08/11/2026 · Status: aceitas

| # | Decisão | Motivo |
|---|---------|--------|
| A | Ingredientes e embalagens em uma tabela `supplies` (campo `kind`) | Estoque, compras e ficha técnica usam uma só chave estrangeira |
| B | Pagamento de pedido = entrada em `transactions`; não existe tabela `payments` | Evita duplicar a mesma informação |
| C | Snapshot de preço e custo em `order_items` | Lucro histórico não muda quando insumos sobem |
| D | Agenda de produção derivada dos pedidos; baixa de estoque ao entrar em "Em produção" | Mais simples; sem tabela própria por enquanto |
| E | Sessões no servidor com cookie httpOnly, em vez de JWT | Revogável e mais seguro para o caso de uso |
| F | Unidades-base (g, ml, un), sem conversões específicas por insumo no início | Começar simples |
| G | Metodologia: faturamento por data de retirada; entradas por data de pagamento; lucro exclui compras de insumo (já estão no custo); caixa separado | Evita dupla contagem de custos |
| H | Drizzle ORM, Zod, TanStack Query, Tailwind, Vitest | Próximo do SQL, tipagem ponta a ponta |
| I | `backend/` e `frontend/` independentes, sem monorepo | Simplicidade e deploy separado |
| J | npm como gerenciador de pacotes | Já vem com o Node |
| K | Tailwind CSS v4 com tokens da marca | Identidade visual em um só lugar |
| L | Migrations versionadas com drizzle-kit | Mudanças do banco rastreadas no Git |
| M | Variáveis de ambiente validadas com Zod na inicialização | Falha cedo e com mensagem clara |