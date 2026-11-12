// Порт почты: сервис не знает, как доставляется письмо (файл в outbox или SMTP).
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Адрес, на который ответит получатель (e-mail отправителя обращения). */
  replyTo?: string;
}

export interface MailPort {
  send(message: MailMessage): Promise<void>;
}
