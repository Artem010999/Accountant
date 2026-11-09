// ШАГ 5 [Code: Аудит] (ТЗ 3.6, п. 3). Чистая функция: источники передаются снаружи.

import type { ClaimType, ClaimVerificationStatus } from '@passport/contracts';

export interface AuditableClaim {
  claim_text: string;
  claim_type: ClaimType;
  source_id: string | null;
  source_locator: { page: number; quote: string } | null;
  verification_status: ClaimVerificationStatus;
}

export interface SourceText {
  extracted_text: string | null;
}

export interface AuditWarning {
  claim_text: string;
  reason: string;
}

const normalize = (str: string | null | undefined): string =>
  (str ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Аудит не понижает уже подтверждённые claims и не трогает тип без причины.
export function auditClaims<T extends AuditableClaim>(
  claims: T[],
  sourcesById: Record<string, SourceText>,
  currentYear = new Date().getFullYear(),
): { auditedClaims: T[]; auditWarnings: AuditWarning[] } {
  const auditWarnings: AuditWarning[] = [];

  const auditedClaims = claims.map((claim) => {
    let claimType = claim.claim_type;
    let status = claim.verification_status;
    let sourceId = claim.source_id;

    // 1. Будущие даты: fact -> plan (ШАГ 5, п. 3 ТЗ). currentYear оставлен для расширения правил.
    const futureYear = claim.claim_text.match(/\b(202[7-9]|203\d)\b/);
    if (futureYear && claimType === 'fact' && Number(futureYear[1]) > currentYear) {
      claimType = 'plan';
      auditWarnings.push({
        claim_text: claim.claim_text,
        reason: `Утверждение содержит будущий год (${futureYear[1]}), тип изменен с fact на plan.`,
      });
    }

    // 2. Сверка цитаты с источником
    if (sourceId && claim.source_locator?.quote) {
      const quote = normalize(claim.source_locator.quote);
      const sourceText = normalize(sourcesById[sourceId]?.extracted_text);
      if (quote.length >= 10 && sourceText.includes(quote)) {
        status = 'confirmed_by_source';
      } else {
        sourceId = null;
        status = 'unverified';
        auditWarnings.push({
          claim_text: claim.claim_text,
          reason: 'Цитата не найдена в документе-источнике. Источник снят, статус unverified.',
        });
      }
    }

    // 3. Факт без документа
    if (claimType === 'fact' && !sourceId) {
      auditWarnings.push({
        claim_text: claim.claim_text,
        reason: 'Заявлен факт со слов клиента без подтверждающего документа.',
      });
    }

    return { ...claim, claim_type: claimType, source_id: sourceId, verification_status: status };
  });

  return { auditedClaims, auditWarnings };
}
