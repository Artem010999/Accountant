// Человеческие названия полей, групп статей сметы и этапов для выгрузки DOCX.
import type { BudgetCategory } from '@passport/contracts';

/** Названия полей паспорта. Ключ — field_key из реестра секций (contracts/sections.ts). */
export const FIELD_TITLES: Record<string, string> = {
  team_members: 'Состав команды',
  competencies_and_experience: 'Компетенции и опыт команды',
  problem_description: 'Описание проблемы',
  target_audience: 'Целевая аудитория',
  product_summary: 'Кратко о продукте',
  core_features: 'Ключевые функции',
  tech_approach: 'Технологический подход',
  direction: 'Направление (Н1–Н7)',
  tech_challenge: 'Технологический вызов (№)',
  current_stage: 'Текущая стадия',
  existing_backlog_and_mvp: 'Задел и MVP',
  first_stage_result: 'Результат первого этапа',
  calendar_plan_stage_1: 'Календарный план: 1 этап',
  calendar_plan_stage_2: 'Календарный план: 2 этап',
  analogues_comparison: 'Аналоги и сравнение',
  novelty_hypothesis: 'Гипотеза отличия',
  verification_protocol: 'Протокол проверки',
  market_overview: 'Рынок',
  business_model_and_pricing: 'Бизнес-модель и цены',
  traction_and_pilots: 'Продажи и пилоты',
  legal_entity_info: 'Юридическое лицо',
  entity_roles: 'Роли организаций',
  ip_rights_and_authors: 'Авторы и права',
  rid_certificates: 'Свидетельства РИД',
  previous_grants_and_statuses: 'Предыдущие гранты и статусы',
  active_obligations: 'Действующие обязательства',
};

export const CATEGORY_TITLES: Record<BudgetCategory, string> = {
  salary: 'Оплата труда',
  equipment: 'Оборудование',
  ip_and_premises: 'ИС и помещения',
  contractor: 'Сторонние исполнители',
  other: 'Иные расходы',
};

export const STAGE_TITLES: Record<1 | 2, string> = {
  1: 'Этап 1',
  2: 'Этап 2',
};
