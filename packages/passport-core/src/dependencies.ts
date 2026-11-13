// Карта связанных блоков (v1.1, задача 1.5, «разморозка» шага 6.1).
// Узлы: номер блока паспорта (2–10) или 'budget' (Смета — отдельная таблица, не блок).
// Правило: изменение узла помечает ПРЯМЫХ зависимых; каскад дальше не идёт.
// Узлы, изменённые в том же запросе, не помечаются повторно (их пользователь уже правит).

export const BUDGET_NODE = 'budget' as const;
export type DependencyNode = number | typeof BUDGET_NODE;

export const DEPENDENCY_MAP: Readonly<Record<string, readonly DependencyNode[]>> = {
  '2': [5, BUDGET_NODE, 9], // состав команды → КП, смета, права на разработку
  '3': [4, 7], // проблема и ЦА → продукт, рынок
  '4': [6, 5, 9], // продукт и технология → новизна, КП, права
  '5': [BUDGET_NODE, 2], // КП → смета, команда
  '6': [4, 7], // новизна → продукт, рынок
  '7': [3, 5], // рынок и модель → проблема и ЦА, КП
  '8': [9, BUDGET_NODE], // юрлицо → права, смета (расходы на регистрацию ООО)
  '9': [5, 8], // права и РИД → КП, юрлицо
  '10': [4, 7], // доказательная база → продукт, рынок
  [BUDGET_NODE]: [5, 2], // смета → КП, команда
};

/** Прямые зависимые для списка изменённых узлов (без самих изменённых, без дублей). */
export function dependentsOf(changed: readonly DependencyNode[]): DependencyNode[] {
  const changedKeys = new Set(changed.map(String));
  const out = new Map<string, DependencyNode>();
  for (const node of changed) {
    for (const dep of DEPENDENCY_MAP[String(node)] ?? []) {
      if (changedKeys.has(String(dep))) continue;
      out.set(String(dep), dep);
    }
  }
  return [...out.values()];
}
