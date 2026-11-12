// Почтовые адаптеры: OutboxMail пишет файлы, SmtpMail отдаёт письмо транспорту (мок, без сети).
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxMail } from '../src/mail/outbox';
import { SmtpMail } from '../src/mail/smtp';
import { createMailFromConfig } from '../src/mail';
import { loadConfig } from '../src/config';

const message = {
  to: 'test@test.com',
  subject: 'Буха: обращение в поддержку',
  text: 'Имя: Иван\nE-mail: ivan@university.ru\n\nПроблема:\nТекст',
  replyTo: 'ivan@university.ru',
};

describe('OutboxMail', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'support-outbox-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('пишет один JSON-файл с полями письма, создавая папку при необходимости', async () => {
    const outbox = join(dir, 'nested', 'outbox');
    await new OutboxMail(outbox).send(message);

    const files = await readdir(outbox);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);

    const record = JSON.parse(await readFile(join(outbox, files[0]), 'utf8')) as Record<string, unknown>;
    expect(record).toMatchObject({
      to: 'test@test.com',
      subject: 'Буха: обращение в поддержку',
      text: message.text,
      replyTo: 'ivan@university.ru',
    });
    expect(typeof record.id).toBe('string');
    expect(typeof record.createdAt).toBe('string');
  });

  it('без reply-to пишет null', async () => {
    await new OutboxMail(dir).send({ to: 'test@test.com', subject: 's', text: 't' });
    const [file] = await readdir(dir);
    const record = JSON.parse(await readFile(join(dir, file), 'utf8')) as { replyTo: unknown };
    expect(record.replyTo).toBeNull();
  });
});

describe('SmtpMail', () => {
  it('передаёт письмо в транспорт с from, to, subject, text и reply-to', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-1' });
    const mail = new SmtpMail({ host: 'smtp.test', port: 587, user: 'u', pass: 'p', from: 'Буха <noreply@test.com>' }, { sendMail });

    await mail.send(message);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Буха <noreply@test.com>',
      to: 'test@test.com',
      subject: 'Буха: обращение в поддержку',
      text: message.text,
      replyTo: 'ivan@university.ru',
    });
  });

  it('ошибка транспорта пробрасывается наружу', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('connection refused'));
    const mail = new SmtpMail({ host: 'smtp.test', port: 587, from: 'noreply@test.com' }, { sendMail });
    await expect(mail.send(message)).rejects.toThrow('connection refused');
  });
});

describe('createMailFromConfig', () => {
  it('без SMTP_HOST выбирает OutboxMail', () => {
    expect(createMailFromConfig(loadConfig({ OUTBOX_DIR: join(tmpdir(), 'outbox-test') }))).toBeInstanceOf(OutboxMail);
  });

  it('с SMTP_HOST выбирает SmtpMail', () => {
    const cfg = loadConfig({ SMTP_HOST: 'smtp.test', MAIL_FROM: 'noreply@test.com' });
    expect(createMailFromConfig(cfg)).toBeInstanceOf(SmtpMail);
  });

  it('с SMTP_HOST без адреса отправителя — понятная ошибка', () => {
    expect(() => createMailFromConfig(loadConfig({ SMTP_HOST: 'smtp.test' }))).toThrow('MAIL_FROM');
  });
});
