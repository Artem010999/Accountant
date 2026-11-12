// Слой данных админки «Страж» (user-flows F16). Бэкенда пока нет (G5).
// Пороги — синглтон app_settings: guard_threshold_block и guard_threshold_warn.
// Экран получает сервис пропом; демо-реализация ниже берёт значения из design/project/AdminGuard.dc.html.

export interface GuardThresholds {
  /** Порог блокировки: близость ниже — загрузка отклоняется. Диапазон 0–1. */
  block: number;
  /** Порог предупреждения: близость ниже — загрузка проходит с событием в журнале. Диапазон 0–1. */
  warn: number;
}

/** Решение Стража по событию: блокировка, предупреждение, пропуск. */
export type GuardDecision = 'blocked' | 'warn' | 'ok';

/** Проект, к которому относится загрузка. */
export interface GuardProject {
  /** Название проекта из данных. В журнале выводится как «Проект <название>». */
  name: string;
  /** Пользователь-владелец проекта. */
  owner: string;
}

export interface GuardEvent {
  id: string;
  /** Дата и время без часового пояса: YYYY-MM-DDTHH:mm. */
  createdAt: string;
  project: GuardProject;
  /** Близость к якорю проекта, 0–1. */
  similarity: number;
  model: string;
  /** Начало текста загрузки. */
  previewText: string;
}

export interface AdminGuardService {
  getThresholds(): Promise<GuardThresholds>;
  saveThresholds(thresholds: GuardThresholds): Promise<void>;
  listEvents(): Promise<GuardEvent[]>;
}

/** Проверка порогов перед сохранением. Возвращает текст ошибки или null, если значения допустимы. */
export function validateThresholds(thresholds: GuardThresholds): string | null {
  const inRange = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
  if (!inRange(thresholds.block) || !inRange(thresholds.warn)) {
    return 'Порог должен быть от 0 до 1.';
  }
  // Ошибка только когда блокировка строго выше предупреждения; равные пороги допустимы.
  if (thresholds.block > thresholds.warn) {
    return 'Порог блокировки не может быть выше порога предупреждения.';
  }
  return null;
}

/** Решение по близости при заданных порогах: как в эталоне, блокировка строго ниже block. */
export function classifySimilarity(similarity: number, thresholds: GuardThresholds): GuardDecision {
  if (similarity < thresholds.block) return 'blocked';
  if (similarity < thresholds.warn) return 'warn';
  return 'ok';
}

const DEMO_EVENTS: GuardEvent[] = [
  {
    id: 'guard-1',
    createdAt: '2026-11-08T14:02',
    project: { name: 'Startup X', owner: 'Олег Носов' },
    similarity: 0.38,
    model: 'gpt-4o-mini',
    previewText: 'Startup_X_pitch.pdf: платформа доставки еды для офисов…',
  },
  {
    id: 'guard-2',
    createdAt: '2026-11-08T11:40',
    project: { name: 'Monetrix', owner: 'Иван Иванов' },
    similarity: 0.62,
    model: 'gpt-4o-mini',
    previewText: 'Вопрос по проекту: какие функции… Ответ: голосовой помощник…',
  },
  {
    id: 'guard-3',
    createdAt: '2026-11-07T18:15',
    project: { name: 'Молодёжь рядом', owner: 'Анна Смирнова' },
    similarity: 0.91,
    model: 'gpt-4o-mini',
    previewText: 'Справочник мер поддержки для ветеранов и участников СВО…',
  },
  {
    id: 'guard-4',
    createdAt: '2026-11-07T09:03',
    project: { name: 'Startup X', owner: 'Олег Носов' },
    similarity: 0.44,
    model: 'gpt-4o-mini',
    previewText: 'Бизнес-план кофейни на 40 посадочных мест…',
  },
  {
    id: 'guard-5',
    createdAt: '2026-11-06T16:27',
    project: { name: 'Monetrix', owner: 'Иван Иванов' },
    similarity: 0.83,
    model: 'gpt-4o-mini',
    previewText: 'Monetrix — сервис единого финансового профиля…',
  },
];

/** Демо-реализация сервиса: значения в памяти, сохранение живёт до перезагрузки страницы. */
export function createDemoAdminGuardService(): AdminGuardService {
  let thresholds: GuardThresholds = { block: 0.5, warn: 0.75 };

  return {
    async getThresholds() {
      return { ...thresholds };
    },
    async saveThresholds(next) {
      thresholds = { ...next };
    },
    async listEvents() {
      return DEMO_EVENTS.map((e) => ({ ...e }));
    },
  };
}

export const demoAdminGuardService: AdminGuardService = createDemoAdminGuardService();
