import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { EligibilityQuestion } from '@passport/passport-core';

export interface FieldKb {
  question: string;
  example: string;
  criteria: string;
}

/** Технологический вызов из TechLead8 (357 шт.). Выгрузка: scripts/export-tech-challenges.ts. */
export interface TechChallenge {
  number: number;
  direction: string;
  direction_full: string;
  partner: string;
  topic: string;
}

export interface KbManifest {
  program: string;
  manifest_version: string;
  initial_brief: { question: string; example: string };
  novelty_criteria: string;
  rules: {
    requires_student_status: boolean;
    required_sections: number[];
    min_analogues: number;
    max_novelty_retries: number;
  };
  eligibility: { questions: EligibilityQuestion[] };
  sections: Record<string, Record<string, FieldKb>>;
  /** Из tech-challenges.json в той же папке. Лимиты сметы — в БД (budget_limit_sets), не здесь. */
  tech_challenges: TechChallenge[];
}

/** Читает манифест программы и список технологических вызовов из той же папки. */
export function loadKbManifest(path: string): KbManifest {
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Omit<KbManifest, 'tech_challenges'>;
  const challenges = JSON.parse(readFileSync(join(dirname(path), 'tech-challenges.json'), 'utf8')) as TechChallenge[];
  return { ...manifest, tech_challenges: challenges };
}

const FALLBACK = (fieldKey: string): FieldKb => ({
  question: `Опишите: ${fieldKey}`,
  example: '',
  criteria: 'Ответ должен быть конкретным и подтверждённым.',
});

export function fieldKb(kb: KbManifest, sectionId: number, fieldKey: string): FieldKb {
  return kb.sections[String(sectionId)]?.[fieldKey] ?? FALLBACK(fieldKey);
}
