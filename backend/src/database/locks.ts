import { sql } from 'drizzle-orm';
import type { Transaction } from './client.js';

// Número qualquer, fixo, que identifica a trava (o Postgres só compara números).
const RECIPE_GRAPH_LOCK_ID = 7_200_001;

/**
 * Trava as mudanças no "mapa" de fichas técnicas (quem usa quem) até o fim da transação.
 *
 * Sem isto, duas edições ao mesmo tempo poderiam criar um ciclo: "A passa a usar B" e
 * "B passa a usar A" conferem o mapa antes de a outra salvar, e as duas passam (decisão AN).
 * Com a trava, a segunda espera a primeira terminar e confere o mapa já atualizado.
 */
export async function lockRecipeGraph(tx: Transaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${RECIPE_GRAPH_LOCK_ID})`);
}
