// Проверка значений полей, у которых есть допустимый набор (задача 1.2): направление Н1–Н7 и номер вызова 1–357.
// Остальные поля принимаются как текст. Вызывается при ручном вводе и при извлечении LLM (невалидное — пропускается).
import type { TechChallenge } from '../kb/manifest';

export const DIRECTION_CODES = ['Н1', 'Н2', 'Н3', 'Н4', 'Н5', 'Н6', 'Н7'] as const;

export type FieldCheck = { ok: true; value: string } | { ok: false; reason: string };

export function checkFieldValue(
  sectionId: number,
  fieldKey: string,
  raw: string,
  challenges: readonly TechChallenge[],
): FieldCheck {
  const value = raw.trim();

  if (sectionId === 4 && fieldKey === 'direction') {
    if ((DIRECTION_CODES as readonly string[]).includes(value)) return { ok: true, value };
    return { ok: false, reason: `Направление должно быть одним из: ${DIRECTION_CODES.join(', ')}.` };
  }

  if (sectionId === 4 && fieldKey === 'tech_challenge') {
    if (!/^\d{1,3}$/.test(value)) {
      return { ok: false, reason: 'Укажите номер технологического вызова от 1 до 357.' };
    }
    const number = Number(value);
    if (!challenges.some((c) => c.number === number)) {
      return { ok: false, reason: `Технологического вызова № ${number} нет в перечне (допустимо от 1 до 357).` };
    }
    return { ok: true, value: String(number) };
  }

  return { ok: true, value };
}

/**
 * Согласованность направления и вызова: вызов должен относиться к выбранному направлению.
 * Возвращает текст ошибки или null. Используется на финализации (стоп-фактор).
 */
export function challengeDirectionMismatch(
  direction: string | null,
  challengeNumber: string | null,
  challenges: readonly TechChallenge[],
): string | null {
  if (!direction || !challengeNumber) return null;
  const challenge = challenges.find((c) => String(c.number) === challengeNumber.trim());
  if (!challenge) return `Технологический вызов № ${challengeNumber} не найден в перечне.`;
  if (challenge.direction !== direction.trim()) {
    return `Технологический вызов № ${challengeNumber} относится к направлению ${challenge.direction}, а выбрано ${direction.trim()}.`;
  }
  return null;
}
