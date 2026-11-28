import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../database/client.js';
import { passwordResetTokens, users } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { sendMail } from '../../shared/mailer.js';
import { applyNewPassword } from './auth.service.js';
import { hashPassword } from './password.js';
// Mesmo formato do token de sessão: 256 bits aleatórios, e o banco guarda só o hash SHA-256.
import { generateSessionToken as generateToken, hashSessionToken as hashToken } from './session-token.js';

export const RESET_TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 hora

export const INVALID_RESET_TOKEN_MESSAGE = 'Este link é inválido ou expirou. Peça um novo.';

/**
 * Pede um link de redefinição. Nunca revela se o e-mail tem conta:
 * quem chama responde sempre igual, exista a usuária ou não.
 */
export async function requestPasswordReset(email: string, now: Date = new Date()): Promise<void> {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);

  // E-mail inexistente ou conta desativada: não há o que enviar.
  if (!user) return;

  const token = generateToken();

  await db.transaction(async (tx) => {
    // Um pedido novo invalida os links anteriores ainda não usados: só o mais recente vale.
    await tx
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_DURATION_MS),
    });
    await recordAudit(tx, {
      userId: null,
      entityType: 'user',
      entityId: user.id,
      action: 'password_reset_requested',
    });
  });

  const link = `${env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;

  try {
    await sendMail({
      to: user.email,
      subject: 'Redefinição de senha — Rafaela Colussi Gestão',
      text: [
        `Olá, ${user.name}!`,
        '',
        'Recebemos um pedido para redefinir a sua senha. Para criar uma senha nova, abra o link abaixo:',
        '',
        link,
        '',
        'O link vale por 1 hora e só pode ser usado uma vez.',
        'Se não foi você quem pediu, ignore este e-mail: a sua senha continua a mesma.',
      ].join('\n'),
    });
  } catch (err) {
    // A resposta continua igual (não revela que a conta existe); a falha fica registrada para nós.
    logger.error({ err, userId: user.id }, 'Falha ao enviar e-mail de redefinição de senha');
  }
}

/** Usa o link: troca a senha, encerra as sessões e invalida o link. */
export async function resetPassword(
  token: string,
  newPassword: string,
  now: Date = new Date(),
): Promise<void> {
  const tokenHash = hashToken(token);
  const isUsable = and(
    eq(passwordResetTokens.tokenHash, tokenHash),
    isNull(passwordResetTokens.usedAt),
    gt(passwordResetTokens.expiresAt, now),
  );

  // Conferência rápida antes do Argon2 (lento): link inválido não gasta CPU com hash.
  const [usable] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(isUsable)
    .limit(1);
  if (!usable) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
  }

  // Calculado antes de abrir a transação, para não segurar o banco esperando.
  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    // Marca como usado SÓ se continua válido, numa única operação: dois envios simultâneos
    // do mesmo link não conseguem usá-lo duas vezes (a conferência acima não basta para isso).
    const [claimed] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(isUsable)
      .returning({ userId: passwordResetTokens.userId });

    if (!claimed) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
    }

    await applyNewPassword(tx, {
      userId: claimed.userId,
      passwordHash,
      actorUserId: claimed.userId,
      via: 'reset_link',
    });
  });
}
