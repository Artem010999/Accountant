import { describe, expect, it } from 'vitest';
import { auditClaims, calculateClaimSpans, evaluatePassportRules } from '../src/index';

describe('calculateClaimSpans (Баг №2)', () => {
  it('0-based индексы и длина подстроки', () => {
    const [c] = calculateClaimSpans('Привет мир', [{ claim_text: 'мир', claim_type: 'fact' }]);
    expect(c.span_start).toBe(7);
    expect(c.span_end).toBe(10);
    expect(c.verification_status).toBe('unverified');
  });

  it('ненайденная подстрока → orphaned, без спана', () => {
    const [c] = calculateClaimSpans('Привет мир', [{ claim_text: 'нет такого', claim_type: 'fact' }]);
    expect(c.span_start).toBeNull();
    expect(c.span_end).toBeNull();
    expect(c.verification_status).toBe('orphaned');
  });

  it('одинаковые подстроки занимают разные места', () => {
    const spans = calculateClaimSpans('100 000 и 100 000', [
      { claim_text: '100 000', claim_type: 'number' as const },
      { claim_text: '100 000', claim_type: 'number' as const },
    ]);
    expect(spans[0].span_start).toBe(0);
    expect(spans[1].span_start).toBe(10);
  });
});

describe('auditClaims (ШАГ 5)', () => {
  const base = { source_id: null, source_locator: null, verification_status: 'unverified' as const };

  it('факт с будущим годом становится планом', () => {
    const { auditedClaims } = auditClaims(
      [{ ...base, claim_text: 'Запуск пилота запланирован на 2027 год', claim_type: 'fact' as const }],
      {},
      2026,
    );
    expect(auditedClaims[0].claim_type).toBe('plan');
  });

  it('цитата из источника подтверждает claim', () => {
    const { auditedClaims } = auditClaims(
      [{ ...base, claim_text: 'Опрошено 50 студентов', claim_type: 'fact' as const, source_id: 's1', source_locator: { page: 2, quote: 'Опрошено 50 студентов в вузе' } }],
      { s1: { extracted_text: 'Страница 2. Опрошено 50 студентов в вузе.' } },
      2026,
    );
    expect(auditedClaims[0].verification_status).toBe('confirmed_by_source');
  });

  it('выдуманная цитата снимает источник', () => {
    const { auditedClaims, auditWarnings } = auditClaims(
      [{ ...base, claim_text: 'Выручка миллион', claim_type: 'fact' as const, source_id: 's1', source_locator: { page: 1, quote: 'Выручка миллион рублей' } }],
      { s1: { extracted_text: 'Другой текст документа' } },
      2026,
    );
    expect(auditedClaims[0].source_id).toBeNull();
    expect(auditWarnings.length).toBeGreaterThan(0);
  });
});

describe('evaluatePassportRules', () => {
  it('без обязательных блоков — NOT_ELIGIBLE', () => {
    const r = evaluatePassportRules({ name: 'Иван', status: 'student' }, [], []);
    expect(r.eligibility_status).toBe('NOT_ELIGIBLE');
    expect(r.stop_factors.length).toBeGreaterThan(0);
  });

  it('все блоки заполнены, студент — ELIGIBLE', () => {
    const records = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((section_id) => ({ section_id, value: 'текст блока' }));
    const r = evaluatePassportRules({ name: 'Иван', status: 'student' }, records, []);
    expect(r.eligibility_status).toBe('ELIGIBLE');
  });
});
