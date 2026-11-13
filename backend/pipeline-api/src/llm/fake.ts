// Детерминированная заглушка LLM для тестов и локальной отладки без ключа API.
import { EMBEDDING_DIM, type LlmClient, type LlmTask } from './types';

type Override = (input: any) => unknown;

/** Снимает защитную обёртку для работы тестовой заглушки */
function unwrapUntrusted(text: string): string {
  if (!text) return '';
  return text.replace(/<student_untrusted_data[^>]*>([\s\S]*?)<\/student_untrusted_data>/gi, '$1').trim();
}

/** Эмбеддинг по словам (hashing trick): тексты с общими словами дают близкие векторы. */
export function hashEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []) {
    let h = 0;
    for (const ch of word) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
    v[h % dim] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export class FakeLlm implements LlmClient {
  readonly model = 'fake-llm';
  readonly calls: { task: LlmTask; input: any }[] = [];

  /** Переопределения ответов по задаче (для сценариев тестов). */
  constructor(private readonly overrides: Partial<Record<LlmTask, Override>> = {}) {}

  async complete(task: LlmTask, input: any): Promise<unknown> {
    this.calls.push({ task, input });
    const override = this.overrides[task];
    if (override) {
      const res = (await override(input)) as any;
      if (task === 'extract' && input?.form_inputs && Array.isArray(input.form_inputs) && res?.fields) {
        const formMap = new Map<string, any>(
          input.form_inputs.map((fi: any) => [`${fi.section_id}/${fi.field_key}`, fi]),
        );
        for (const item of res.fields) {
          const fi = formMap.get(`${item.section_id}/${item.field_key}`);
          if (fi && (item.value?.startsWith('Значение поля ') || item.field_key === 'direction' || item.field_key === 'tech_challenge')) {
            const raw = unwrapUntrusted(fi.value ?? '').trim();
            item.value = raw;
            const isCode = item.field_key === 'direction' || item.field_key === 'tech_challenge';
            item.claims = raw && !isCode ? [
              {
                claim_text: raw,
                claim_type: 'client_statement',
                claim_kind: 'paragraph',
                source_id: null,
                source_locator: null,
                confidence: 0.9,
              },
            ] : [];
          }
        }
      }
      return res;
    }
    return defaultResponse(task, input);
  }

  async embed(text: string): Promise<number[]> {
    return hashEmbedding(text);
  }
}

function firstSentence(text: string): string {
  const s = text.split(/[.!?]/)[0]?.trim() ?? '';
  return s.length >= 15 ? s : text.trim().slice(0, 200);
}

function defaultResponse(task: LlmTask, input: any): unknown {
  switch (task) {
    case 'anchor':
      return { anchor_summary: unwrapUntrusted(String(input.brief)).slice(0, 1200) };

    case 'extract': {
      if (input.form_inputs && Array.isArray(input.form_inputs) && input.form_inputs.length > 0) {
        return {
          fields: input.form_inputs.map((fi: any) => {
            const val = unwrapUntrusted(fi.value ?? '').trim();
            const isCode = fi.field_key === 'direction' || fi.field_key === 'tech_challenge';
            return {
              section_id: Number(fi.section_id),
              field_key: String(fi.field_key),
              value: val || null,
              claims: val && !isCode
                ? [
                    {
                      claim_text: val,
                      claim_type: 'client_statement',
                      claim_kind: 'paragraph',
                      source_id: null,
                      source_locator: null,
                      confidence: 0.9,
                    },
                  ]
                : [],
            };
          }),
        };
      }
      // По умолчанию заполняем только problem_description первым предложением брифа.
      const userInput = unwrapUntrusted(input.user_input ?? '');
      const sourceTexts = (input.sources ?? []).map((s: any) =>
        s.pages?.map((p: any) => unwrapUntrusted(p.text ?? '')).join(' ')
      );
      const text = [userInput, ...sourceTexts].filter(Boolean).join(' ');
      const sentence = firstSentence(text);
      if (!sentence) return { fields: [] };
      return {
        fields: [
          {
            section_id: 3,
            field_key: 'problem_description',
            value: sentence,
            claims: [
              {
                claim_text: sentence,
                claim_type: 'hypothesis',
                claim_kind: 'sentence',
                source_id: null,
                source_locator: null,
                confidence: 0.8,
              },
            ],
          },
        ],
      };
    }

    case 'validate_answer': {
      const answer = unwrapUntrusted(String(input.answer ?? '')).trim();
      if (answer.length < 20) {
        return { is_valid: false, rejection_reason: 'Ответ слишком короткий. Опишите подробнее.', formatted_value: null, claims: [] };
      }
      return {
        is_valid: true,
        rejection_reason: null,
        formatted_value: answer,
        claims: [
          { claim_text: answer, claim_type: 'client_statement', claim_kind: 'sentence', source_id: null, source_locator: null, confidence: 0.9 },
        ],
      };
    }

    case 'novelty':
      return {
        analogues_count: 0,
        analogues_list: [],
        has_measurable_comparison: false,
        missing_details_question: 'Укажите минимум 2 аналога и измеримое отличие по каждому.',
      };

    case 'navigator':
      return { summary: 'Паспорт сформирован автоматически (тестовая заглушка).', checklist: ['Проверьте данные перед подачей.'] };
  }
}
