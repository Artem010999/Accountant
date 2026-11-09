import { readFileSync } from 'node:fs';

export interface FieldKb {
  question: string;
  example: string;
  criteria: string;
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
  sections: Record<string, Record<string, FieldKb>>;
}

export function loadKbManifest(path: string): KbManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as KbManifest;
}

const FALLBACK = (fieldKey: string): FieldKb => ({
  question: `Опишите: ${fieldKey}`,
  example: '',
  criteria: 'Ответ должен быть конкретным и подтверждённым.',
});

export function fieldKb(kb: KbManifest, sectionId: number, fieldKey: string): FieldKb {
  return kb.sections[String(sectionId)]?.[fieldKey] ?? FALLBACK(fieldKey);
}
