import { and, eq, gt, lte } from 'drizzle-orm';
import { db, type Transaction } from '../../database/client.js';
import { sessions, users } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { verifyAgainstDummy, verifyPassword } from './password.js';
import { calculateExpiry, generateSessionToken, hashSessionToken } from './session-token.js';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
};

export type AuthContext = {
  user: AuthUser;
  sessionId: number;
};

// Mesma mensagem para e-mail inexistente, senha errada e conta desativada (decisão S).
const INVALID_CREDENTIALS = 'E-mail ou senha incorretos';

const authUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
};

export async function login(email: string, password: string, now: Date = new Date()) {
  const [user] = await db
    .select({
      ...authUserColumns,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    await verifyAgainstDummy(password);
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  // A senha é verificada mesmo para conta desativada, para o tempo de resposta ser igual.
  const passwordMatches = await verifyPassword(user.passwordHash, password);
  if (!passwordMatches || !user.isActive) {
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  const token = generateSessionToken();
  const expiresAt = calculateExpiry(now);

  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });
    // Login não é edição do cadastro: mantém updated_at como estava.
    await tx.update(users).set({ lastLoginAt: now, updatedAt: user.updatedAt }).where(eq(users.id, user.id));
    await recordAudit(tx, {
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'login',
    });
  });

  const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return { token, expiresAt, user: authUser };
}

/** Sessão válida = existe, não expirou e a usuária continua ativa. */
export async function findSession(token: string, now: Date = new Date()): Promise<AuthContext | null> {
  const [row] = await db
    .select({ sessionId: sessions.id, ...authUserColumns })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, now),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;

  const { sessionId, ...user } = row;
  return { sessionId, user };
}

export async function logout(token: string): Promise<void> {
  await db.transaction(async (tx) => {
    // .returning() faz o DELETE devolver as linhas apagadas: assim sabemos de quem era a sessão.
    const [deleted] = await tx
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)))
      .returning({ userId: sessions.userId });

    // Token desconhecido ou sessão já apagada: não houve logout de ninguém.
    if (!deleted) return;

    await recordAudit(tx, {
      userId: deleted.userId,
      entityType: 'user',
      entityId: deleted.userId,
      action: 'logout',
    });
  });
}

/** Apaga as sessões vencidas (o oposto exato da regra de validade do findSession). */
export async function deleteExpiredSessions(now: Date = new Date()): Promise<number> {
  const result = await db.delete(sessions).where(lte(sessions.expiresAt, now));
  return result.rowCount ?? 0;
}

export type NewPasswordInput = {
  userId: number;
  /** Já com hash: o Argon2 é lento, então é calculado antes de abrir a transação. */
  passwordHash: string;
  /** Quem fez a troca; null quando foi pelo terminal (script), sem usuária logada. */
  actorUserId: number | null;
  via: 'cli' | 'reset_link';
};

/**
 * Troca a senha, encerra todas as sessões da usuária e registra na auditoria.
 * Recebe a transação de quem chama para ficar junto de outras mudanças (ex.: marcar o link como usado).
 */
export async function applyNewPassword(tx: Transaction, input: NewPasswordInput): Promise<void> {
  await tx.update(users).set({ passwordHash: input.passwordHash }).where(eq(users.id, input.userId));
  // Quem tinha a senha antiga (inclusive um invasor) perde o acesso na hora.
  await tx.delete(sessions).where(eq(sessions.userId, input.userId));
  await recordAudit(tx, {
    userId: input.actorUserId,
    entityType: 'user',
    entityId: input.userId,
    action: 'password_reset',
    changes: { via: input.via },
  });
}
