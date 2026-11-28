# 0004 — Financeiro (Fase 3)

Data: 28/11/2026 · Status: aceitas

A Fase 3 é feita em duas etapas: **lançamentos** (entradas, saídas, transferências, ajustes e saldos) → **resumo do mês** (por categoria).
Estas decisões continuam a numeração da [0003](0003-catalogo-e-custos.md) e seguem as decisões B e G da [0001](0001-decisoes-iniciais.md).

| #   | Decisão                                                                                                                                                                                            | Motivo                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AX  | O Financeiro vem antes dos pedidos; até os pedidos existirem, as vendas são lançadas à mão como entradas na categoria "Vendas"                                                                     | Escolha de vocês. Quando os pedidos chegarem, o pagamento de cada pedido vira uma entrada automaticamente (decisão B)                                                |
| AY  | Duas contas fixas: **Caixa** (dinheiro físico) e **Conta** (Pix/banco), como enum `finance_account`, com saldo separado                                                                            | Os clientes pagam em dinheiro ou Pix; separar permite conferir quanto deveria haver na gaveta. Enum em vez de tabela: são só duas, e mais contas viram uma migration |
| AZ  | Só o que **já aconteceu** (sem contas a pagar nem vencimentos): a data do lançamento não pode ser futura                                                                                           | Escolha de vocês; mantém o módulo simples                                                                                                                            |
| BA  | Datas sem hora (`date`, lidas como texto `AAAA-MM-DD`), e "hoje" calculado no fuso **America/Sao_Paulo** no servidor                                                                               | "Dia 28" é o mesmo dia em qualquer fuso; o servidor em UTC já estaria no dia 29 às 21h de São Paulo                                                                  |
| BB  | Categorias com tipo (entrada ou saída) que não muda depois de criada; uma **chave estrangeira composta** (`categoria`, `tipo`) garante no banco que uma saída nunca fica numa categoria de entrada | O banco garante, não só a API (mesma linha da decisão AL)                                                                                                            |
| BC  | **Transferências** (entre Caixa e Conta) e **ajustes de saldo** (saldo inicial, conferência do caixa) ficam em tabelas próprias: mudam o saldo, mas **não** entram nos totais de entradas e saídas | Depositar o caixa no banco não é faturamento nem despesa; misturar distorceria os relatórios. Saldo = entradas − saídas ± transferências + ajustes                   |
| BD  | A migration cria categorias iniciais (Vendas, Insumos, Gás, Aluguel, Pró-labore…), editáveis e arquiváveis                                                                                         | Ponto de partida útil sem impor nada; categorias usadas são arquivadas, nunca excluídas                                                                              |
| BE  | Lançamentos, transferências e ajustes errados são **excluídos de verdade**; a auditoria guarda o registro inteiro (e as mudanças, na edição)                                                       | Um lançamento errado não deve continuar somando no saldo; nada se perde porque a auditoria tem tudo                                                                  |

## Para a fase de pedidos (respostas já dadas)

- **Pagamento:** depende do cliente. Alguns pagam um sinal antes, outros pagam tudo na retirada. Sempre em **dinheiro ou Pix**.
  O pedido precisa aceitar zero, um ou vários pagamentos e mostrar quanto falta; cada pagamento vira uma entrada no Caixa (dinheiro) ou na Conta (Pix).
- **Entrega:** cada pedido é **retirada** ou **entrega**; na entrega, endereço e taxa de entrega somada ao total.
- **Sem orçamento:** o pedido já nasce **confirmado**.

## Pendências

- **Resumo do mês por categoria** (etapa 2 desta fase).
- **Custos indiretos reais:** com alguns meses de lançamentos, comparar as saídas de gás, energia e taxas com o percentual de indiretos da configuração de preços (pendência da 0003).
