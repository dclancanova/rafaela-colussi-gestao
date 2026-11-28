import { env } from '../config/env.js';
import { logger } from './logger.js';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

/** E-mails "enviados" nos testes, para conferir o conteúdo. Só é preenchida com NODE_ENV=test. */
export const testOutbox: MailMessage[] = [];

/**
 * Envia um e-mail.
 * Ainda sem serviço real (será escolhido no deploy): em desenvolvimento a mensagem vai para o log,
 * para copiar o link no terminal. Em produção, falha alto até o serviço ser configurado.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(message);
    return;
  }

  if (env.NODE_ENV === 'development') {
    logger.info(
      { to: message.to, subject: message.subject },
      `E-mail (não enviado; modo desenvolvimento):\n\n${message.text}\n`,
    );
    return;
  }

  throw new Error('Envio de e-mail ainda não configurado para produção');
}
