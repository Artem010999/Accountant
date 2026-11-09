// Единый справочник 10 секций Паспорта Проекта (ТЗ, Блок 3, раздел 3.1).
// Section 1 («Основатель») НЕ хранится в project_passport_records — она живёт в app_profiles.founder_data.
// Section 0 зарезервирована под служебную запись ИИ-Навигатора (Вопрос 2, вариант А).

export const FOUNDER_SECTION_ID = 1;
export const NAVIGATOR_SECTION_ID = 0;

export const FOUNDER_FIELD_KEYS = ['full_name', 'contacts', 'education_status', 'university', 'region'] as const;

export interface PassportSectionDef {
  id: number;
  title: string;
  fields: readonly string[];
}

export const PASSPORT_SECTIONS: readonly PassportSectionDef[] = [
  { id: 2, title: 'Команда, роли, компетенции и опыт', fields: ['team_members', 'competencies_and_experience'] },
  { id: 3, title: 'Проблема и целевые пользователи', fields: ['problem_description', 'target_audience'] },
  { id: 4, title: 'Продукт, функции и технология', fields: ['product_summary', 'core_features', 'tech_approach'] },
  { id: 5, title: 'Стадия разработки и существующий задел', fields: ['current_stage', 'existing_backlog_and_mvp', 'first_stage_result'] },
  { id: 6, title: 'Аналоги и предполагаемые отличия (Новизна)', fields: ['analogues_comparison', 'novelty_hypothesis', 'verification_protocol'] },
  { id: 7, title: 'Рынок, бизнес-модель, продажи и пилоты', fields: ['market_overview', 'business_model_and_pricing', 'traction_and_pilots'] },
  { id: 8, title: 'Юридические лица и их роли', fields: ['legal_entity_info', 'entity_roles'] },
  { id: 9, title: 'Авторы, правообладатели и РИД', fields: ['ip_rights_and_authors', 'rid_certificates'] },
  { id: 10, title: 'Полученная поддержка и обязательства', fields: ['previous_grants_and_statuses', 'active_obligations'] },
];

export const isValidPassportField = (sectionId: number, fieldKey: string): boolean =>
  PASSPORT_SECTIONS.some((s) => s.id === sectionId && s.fields.includes(fieldKey));
