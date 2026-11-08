import { bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    entityType: text('entity_type').notNull(),
    entityId: bigint('entity_id', { mode: 'number' }),
    action: text('action').notNull(),
    changes: jsonb('changes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_entity_idx').on(table.entityType, table.entityId)],
);