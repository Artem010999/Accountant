import type { AppConfig } from '../config';
import { OutboxMail } from './outbox';
import type { MailPort } from './port';
import { SmtpMail } from './smtp';

export type { MailMessage, MailPort } from './port';
export { OutboxMail } from './outbox';
export { SmtpMail, type MailTransport, type SmtpConfig } from './smtp';

/** SMTP, если задан SMTP_HOST; иначе письма пишутся в папку outbox. */
export function createMailFromConfig(cfg: AppConfig): MailPort {
  const { smtp } = cfg;
  if (!smtp.host) return new OutboxMail(cfg.outboxDir);
  if (!smtp.from) throw new Error('Задайте MAIL_FROM (адрес отправителя) вместе с SMTP_HOST');
  return new SmtpMail({ host: smtp.host, port: smtp.port, user: smtp.user, pass: smtp.pass, from: smtp.from });
}
