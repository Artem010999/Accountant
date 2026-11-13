// Контракт ИИ-Консультанта (задача 4.1). Отдельный вход POST /consultant, не часть пайплайна.
// Консультант только советует: поля паспорта он не редактирует.

export interface ConsultantRequest {
  user_id: string;
  message: string;
}

export interface ConsultantAnswer {
  status: 'ANSWER';
  answer: string;
  /** Предупреждения, например: лимит не подтверждён положением. */
  warnings: string[];
  /** Карточки базы знаний, на которые опирался ответ. */
  sources: { card_id: string; title: string }[];
}

export interface ConsultantBlocked {
  status: 'BLOCKED';
  message: string;
}

export type ConsultantResponse = ConsultantAnswer | ConsultantBlocked;
