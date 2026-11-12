import type { MailMessage } from '../mail/port';
import type { SupportRequest } from './schema';

// Письмо оператору поддержки. Тема фиксирована; e-mail отправителя идёт в reply-to, а не в тему.
export function buildSupportMail(request: SupportRequest, to: string): MailMessage {
  return {
    to,
    subject: 'Буха: обращение в поддержку',
    replyTo: request.email,
    text: [`Имя: ${request.name}`, `E-mail: ${request.email}`, '', 'Проблема:', request.message, ''].join('\n'),
  };
}
