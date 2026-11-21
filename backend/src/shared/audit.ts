import type { Database, Transaction } from '../database/client.js';
import { auditLog } from '../database/schema/index.js';

export type AuditEntry = {
  userId: number | null;
  entityType: string;
  entityId: number | null;
  action: string;
  changes?: unknown;
};

/**
 * Grava um registro na auditoria.
 * Recebe "executor" (db ou tx) para que, dentro de uma transação,
 * o registro seja desfeito junto se algo falhar.
 */
export async function recordAudit(executor: Database | Transaction, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLog).values(entry);
}
