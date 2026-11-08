import { sql } from 'drizzle-orm';
import { bigint, boolean, check, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['admin', 'member']);

export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('member'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('users_email_lowercase', sql`${table.email} = lower(${table.email})`)],
);