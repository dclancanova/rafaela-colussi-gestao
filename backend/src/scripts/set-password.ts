/**
 * Define uma senha nova para uma usuária, pelo terminal.
 * Uso: npm run user:set-password -- email@exemplo.com
 */
import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, pool } from '../database/client.js';
import { users } from '../database/schema/index.js';
import { applyNewPassword } from '../modules/auth/auth.service.js';
import { hashPassword, newPasswordSchema } from '../modules/auth/password.js';

// Leitor único das linhas da entrada, usado quando não há terminal interativo.
let pipedLines: AsyncIterator<string> | undefined;

/** Lê uma linha do terminal sem mostrar o que é digitado. */
async function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;

  // Sem terminal interativo (ex.: entrada redirecionada), lê a próxima linha normalmente.
  if (!stdin.isTTY) {
    stdout.write(question);
    pipedLines ??= createInterface({ input: stdin, terminal: false })[Symbol.asyncIterator]();
    const { value } = await pipedLines.next();
    stdout.write('\n');
    return typeof value === 'string' ? value : '';
  }

  stdout.write(question);
  stdin.setRawMode(true); // recebe cada tecla, sem o terminal ecoar na tela
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    let value = '';

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C
          stdin.setRawMode(false);
          stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1); // Backspace
        } else {
          value += char;
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function main(): Promise<number> {
  const parsedEmail = z
    .email()
    .transform((value) => value.toLowerCase())
    .safeParse(process.argv[2]?.trim());

  if (!parsedEmail.success) {
    console.error('Uso: npm run user:set-password -- email@exemplo.com');
    return 1;
  }
  const email = parsedEmail.data;

  const [user] = await db
    .select({ id: users.id, name: users.name, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`Nenhuma usuária com o e-mail ${email}.`);
    return 1;
  }

  console.log(`Definindo senha nova para ${user.name} <${email}>.`);
  if (!user.isActive) {
    console.warn('Atenção: esta conta está desativada e continuará sem conseguir entrar.');
  }

  const password = await promptHidden('Senha nova: ');
  const check = newPasswordSchema.safeParse(password);
  if (!check.success) {
    console.error(check.error.issues[0]?.message ?? 'Senha inválida.');
    return 1;
  }

  const confirmation = await promptHidden('Repita a senha: ');
  if (confirmation !== password) {
    console.error('As senhas não conferem. Nada foi alterado.');
    return 1;
  }

  const passwordHash = await hashPassword(password);
  await db.transaction((tx) =>
    applyNewPassword(tx, { userId: user.id, passwordHash, actorUserId: null, via: 'cli' }),
  );

  console.log('Senha alterada. Todas as sessões abertas dessa usuária foram encerradas.');
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error('Falha ao alterar a senha:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
