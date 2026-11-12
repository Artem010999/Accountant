import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MailMessage, MailPort } from './port';

// Адаптер по умолчанию (SMTP_HOST не задан): каждое письмо — отдельный JSON-файл в папке outbox.
export class OutboxMail implements MailPort {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async send(message: MailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const file = join(this.dir, `${createdAt.replace(/[:.]/g, '-')}-${id}.json`);
    const record = {
      id,
      createdAt,
      to: message.to,
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo ?? null,
    };
    await writeFile(file, JSON.stringify(record, null, 2), 'utf8');
  }
}
