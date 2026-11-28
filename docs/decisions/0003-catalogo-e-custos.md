# 0003 — Catálogo e custos (Fase 2)

Data: 28/11/2026 · Status: aceitas

A Fase 2 é feita em três etapas: **insumos** → **fichas técnicas** (com sub-receitas) → **produtos e preço de venda**.
Estas decisões continuam a numeração da [0002](0002-banco-e-autenticacao.md).

| #   | Decisão                                                                                                                                                                                | Motivo                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| AD  | Dinheiro guardado em **centavos inteiros** (`integer`, colunas terminadas em `_cents`); a API também troca centavos, e só a tela converte para reais                                    | Contas com `number` decimal acumulam erro (`0.1 + 0.2 ≠ 0.3`); inteiros são exatos                                             |
| AE  | O insumo guarda a **embalagem de compra**: quantidade na unidade-base (decisão F) e preço pago. O custo por unidade-base (`preço ÷ quantidade`) é calculado, nunca guardado            | A usuária digita o que está na nota ("1.000 g por R$ 6,50"); o custo por grama não fica desatualizado em relação ao preço      |
| AF  | Custos fracionários (ex.: 0,65 centavo por grama) são calculados com precisão total; o arredondamento para centavos acontece **uma vez, no total** (da receita, do produto)            | Arredondar cada linha da ficha técnica somaria erros pequenos                                                                  |
| AG  | Insumos são **arquivados** (`is_active`), nunca excluídos                                                                                                                              | Fichas técnicas e o histórico de custos continuam apontando para eles (mesma lógica da decisão P)                              |
| AH  | Nome do insumo único sem diferenciar maiúsculas (índice único em `lower(name)`); o conflito responde 409                                                                               | Evita "Farinha" e "farinha" como dois insumos; o banco garante mesmo com dois cadastros ao mesmo tempo                         |
| AI  | Criar e alterar insumo grava em `audit_log` na mesma transação; na alteração, só os campos que mudaram (`{ campo: { from, to } }`)                                                      | Responde "quem mudou o preço do leite condensado e quando?" sem guardar ruído                                                   |
| AJ  | Fichas técnicas aceitam **sub-receitas** (ex.: "Recheio de brigadeiro" usado em vários produtos)                                                                                       | Cadastrar o preparo uma vez; quando um insumo sobe, o custo de todos os produtos que o usam se atualiza. Detalhes na etapa 2   |

## Pendências

- **Trocar a unidade de um insumo já usado em fichas técnicas** quebraria as quantidades (300 g viraria 300 un).
  Quando as fichas existirem (etapa 2), a API deve recusar essa troca para insumos em uso.
- **Permissões:** por enquanto qualquer usuária logada cadastra e altera insumos. Rever se o perfil `member` passar a ser usado.
