// Выгрузка 357 технологических вызовов из data/rag/TechLead8.xlsx в kb (список для выбора в паспорте).
// Запуск: npx tsx scripts/export-tech-challenges.ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTechLeadExcel } from '../src/rag/techLeadParser';
import { BACKEND_DIR, PIPELINE_API_DIR } from '../src/config';

const cards = parseTechLeadExcel(resolve(PIPELINE_API_DIR, 'data', 'rag', 'TechLead8.xlsx'));
const challenges = cards
  .map((c) => ({
    number: Number(c.metadata?.challenge_number),
    direction: c.direction,
    direction_full: String(c.metadata?.direction_full ?? ''),
    partner: String(c.metadata?.partner ?? ''),
    topic: String(c.metadata?.topic ?? ''),
  }))
  .sort((a, b) => a.number - b.number);

const out = resolve(BACKEND_DIR, 'kb', 'programs', 'student-startup', 'tech-challenges.json');
writeFileSync(out, JSON.stringify(challenges, null, 2) + '\n', 'utf8');
console.log(`Записано вызовов: ${challenges.length} → ${out}`);
