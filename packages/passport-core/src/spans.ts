// Span Calculator (ТЗ 3.6, п. 2). Баг №2 исправлен: 0-based индексы, без position()/strpos в JS.
// Тот же алгоритм в SQL-триггере claim_span_invalidation должен использовать strpos(...) - 1.

import type { ClaimType, ClaimVerificationStatus } from '@passport/contracts';

export interface RawClaim {
  claim_text: string;
  claim_type: ClaimType;
  claim_kind?: string;
  source_id?: string | null;
  source_locator?: { page: number; quote: string } | null;
  confidence?: number;
  verification_status?: ClaimVerificationStatus;
}

export interface ClaimWithSpan extends RawClaim {
  claim_text: string;
  span_start: number | null;
  span_end: number | null;
  order_index: number;
  verification_status: ClaimVerificationStatus;
}

export function calculateClaimSpans(recordValue: string, claims: RawClaim[]): ClaimWithSpan[] {
  if (!recordValue || typeof recordValue !== 'string' || !Array.isArray(claims)) return [];

  const usedRanges: { start: number; end: number }[] = [];

  return claims.map((claim, idx) => {
    const rawText = (claim.claim_text ?? '').trim();
    const base = { ...claim, claim_text: rawText, order_index: idx + 1 };

    if (!rawText) {
      return { ...base, span_start: null, span_end: null, verification_status: 'orphaned' as const };
    }

    let searchFrom = 0;
    let foundStart = -1;

    while (searchFrom < recordValue.length) {
      const pos = recordValue.indexOf(rawText, searchFrom);
      if (pos === -1) break;

      const posEnd = pos + rawText.length;
      const overlaps = usedRanges.some((r) => !(posEnd <= r.start || pos >= r.end));
      if (!overlaps) {
        foundStart = pos;
        usedRanges.push({ start: pos, end: posEnd });
        break;
      }
      searchFrom = pos + 1;
    }

    if (foundStart === -1) {
      return { ...base, span_start: null, span_end: null, verification_status: 'orphaned' as const };
    }

    return {
      ...base,
      span_start: foundStart,
      span_end: foundStart + rawText.length,
      verification_status: claim.verification_status ?? 'unverified',
    };
  });
}
