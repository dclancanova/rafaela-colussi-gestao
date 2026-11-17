import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { sessions, users } from '../../database/schema/index.js';
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
    await tx
      .update(users)
      .set({ lastLoginAt: now, updatedAt: user.updatedAt })
      .where(eq(users.id, user.id));
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
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}
