// Задача 1.5: «разморозка» связанных блоков. Меняем блок — помечаем его прямых зависимых на повторную проверку.
import { BUDGET_NODE, dependentsOf, type DependencyNode } from '@passport/passport-core';
import type { PassportStore } from '../db/store';

/**
 * Фиксирует изменение поля: считается изменением только переписывание УЖЕ заполненного значения.
 * Заполнение пустого поля зависимых не трогает — там ещё нечего пересматривать.
 */
export function noteFieldChange(prev: string | null, next: string, sectionId: number, changed: Set<DependencyNode>): void {
  const before = (prev ?? '').trim();
  if (before && before !== next.trim()) changed.add(sectionId);
}

/** Помечает прямых зависимых от изменённых узлов как needs_review (после всех записей в этом запросе). */
export async function invalidateDependents(
  store: PassportStore,
  projectId: string,
  changed: Iterable<DependencyNode>,
): Promise<void> {
  const targets = dependentsOf([...changed]);
  if (targets.length === 0) return;
  const sections = targets.filter((t): t is number => typeof t === 'number');
  await store.markSectionsNeedsReview(projectId, sections);
  if (targets.includes(BUDGET_NODE)) await store.markBudgetNeedsReview(projectId);
}
