import nodemailer from 'nodemailer';
import type { MailMessage, MailPort } from './port';

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  /** Адрес отправителя (MAIL_FROM). */
  from: string;
}

/** Минимальный интерфейс транспорта nodemailer: в тестах подменяется моком, без сети. */
export interface MailTransport {
  sendMail(mail: { from: string; to: string; subject: string; text: string; replyTo?: string }): Promise<unknown>;
}

// Адаптер через nodemailer. Порт 465 — TLS с первого байта, иначе STARTTLS по умолчанию.
export class SmtpMail implements MailPort {
  private readonly cfg: SmtpConfig;
  private readonly transport: MailTransport;

  constructor(cfg: SmtpConfig, transport?: MailTransport) {
    this.cfg = cfg;
    this.transport =
      transport ??
      nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
      });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.cfg.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo,
    });
  }
}
