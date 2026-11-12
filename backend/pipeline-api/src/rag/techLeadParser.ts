import xlsx from 'xlsx';
import type { RawKnowledgeCard } from './types';

export function parseTechLeadExcel(filePath: string): RawKnowledgeCard[] {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['AllPages'] || wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    throw new Error(`Sheet 'AllPages' not found in ${filePath}`);
  }

  const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let lastDir = '';
  let lastPartner = '';
  let lastTopic = '';

  const cards: RawKnowledgeCard[] = [];

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;

    const numRaw = row[0];
    const num = parseInt(String(numRaw ?? '').trim(), 10);
    if (isNaN(num) || num < 1 || num > 357) {
      continue; // Skip header and page-divider rows
    }

    const dirCell = row[1] != null && String(row[1]).trim() ? String(row[1]).trim() : '';
    const partnerCell = row[2] != null && String(row[2]).trim() ? String(row[2]).trim() : '';
    const topicCell = row[3] != null && String(row[3]).trim() ? String(row[3]).trim() : '';
    let challengeCell = row[4] != null && String(row[4]).trim() ? String(row[4]).trim() : '';
    const expectedCell = row[5] != null && String(row[5]).trim() ? String(row[5]).trim() : '';

    if (dirCell) lastDir = dirCell;
    if (partnerCell) lastPartner = partnerCell;
    if (topicCell) lastTopic = topicCell;

    const directionFullRaw = dirCell || lastDir;
    const partnerRaw = partnerCell || lastPartner;
    const topicRaw = topicCell || lastTopic;

    // Handle rows 317 and 322 (or any where challenge is empty)
    if (!challengeCell && topicRaw) {
      challengeCell = topicRaw;
    }

    // Normalization of text
    const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    let direction_full = clean(directionFullRaw);
    direction_full = direction_full.replace(/^Н4\.\s+Новые/, 'Н4.Новые');

    const partner = clean(partnerRaw);
    const topic = clean(topicRaw);
    const challenge = clean(challengeCell);
    const expected_result = clean(expectedCell);

    const dirMatch = direction_full.match(/^(Н\d)/);
    const directionCode = (dirMatch ? dirMatch[1] : 'all') as RawKnowledgeCard['direction'];

    const card_id = `techlead_8_${String(num).padStart(3, '0')}`;
    const source_doc = 'TechLead8' as const;
    const source_page = `Вызов №${num}`;
    const title = `Технологический вызов №${num}: ${challenge.slice(0, 110)} (${partner})`;
    const authority_status = 'verified_8' as const;
    const retrieval_mode = 'search' as const;
    const pipeline_steps: ('assembly' | 'audit' | 'novelty' | 'chat')[] = ['assembly', 'audit', 'novelty', 'chat'];
    const target_blocks = ['4', '6'];

    const content = `Технологический вызов № ${num} (Очередь 8 «Студенческий стартап» ФСИ)
Направление: ${direction_full}
Индустриальный партнёр: ${partner}
Тематика: ${topic}
Вызов / Задача: ${challenge}
${expected_result ? `Ожидаемый результат и требования: ${expected_result}\n` : ''}Правило применения: Ссылка на вызов № ${num} обосновывает актуальность задачи для индустриального партнёра (${partner}), но сама по себе НЕ подтверждает наличие договора, пилота или обещания закупки.`;

    cards.push({
      card_id,
      source_doc,
      source_page,
      title,
      authority_status,
      retrieval_mode,
      pipeline_steps,
      target_blocks,
      direction: directionCode,
      content,
      metadata: {
        challenge_number: num,
        direction_full,
        partner,
        topic,
      },
    });
  }

  if (cards.length !== 357) {
    throw new Error(`Expected exactly 357 cards from TechLead8, got ${cards.length}`);
  }

  return cards;
}
