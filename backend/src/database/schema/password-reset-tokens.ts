import { bigint, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** Links de "esqueci minha senha": uso único, vencem em pouco tempo. */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Como nas sessões (decisão R): o banco guarda só o hash; o token vai apenas no link do e-mail.
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Preenchido quando o link é usado: impede usar o mesmo link duas vezes.
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('password_reset_tokens_user_id_idx').on(table.userId)],
);
