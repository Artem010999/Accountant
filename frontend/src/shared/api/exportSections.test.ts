import { describe, expect, it } from 'vitest';
import type { PipelineCompleted } from '@passport/contracts';
import { buildExportSections } from './exportSections';

describe('buildExportSections (10 секций для выгрузки)', () => {
  const founder = { full_name: 'Иванов Иван Иванович', contacts: '+7 900', university: 'СамГТУ' };

  it('секция 1 — основатель, затем блоки 2–10 в порядке номеров', () => {
    const passport: PipelineCompleted['passport'] = [
      { section_id: 3, field_key: 'problem_description', value: 'Проблема.', review_status: 'approved', claims: [] },
      { section_id: 2, field_key: 'team_members', value: 'Команда.', review_status: 'approved', claims: [] },
      { section_id: 2, field_key: 'competencies_and_experience', value: null, review_status: 'approved', claims: [] },
    ];
    const sections = buildExportSections(founder, passport);
    expect(sections.map((s) => s.section_id)).toEqual([1, 2, 3]);
    expect(sections[0]!.fields.find((f) => f.field_key === 'full_name')?.value).toBe('Иванов Иван Иванович');
    expect(sections[1]!.fields).toEqual([
      { field_key: 'team_members', value: 'Команда.' },
      { field_key: 'competencies_and_experience', value: '' },
    ]);
  });

  it('пустой профиль даёт пустые значения, а не падение', () => {
    const sections = buildExportSections({ full_name: '' }, []);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.fields.every((f) => f.value === '')).toBe(true);
  });
});
