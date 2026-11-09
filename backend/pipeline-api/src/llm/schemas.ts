// Проверка JSON-ответов LLM. Всё, что не проходит схему, превращается в INTERNAL (а не в мусор в БД).
import { z } from 'zod';
import { PipelineFailure } from '../errors';
import type { LlmClient, LlmTask } from './types';

const claimSchema = z.object({
  claim_text: z.string().min(1),
  claim_type: z.enum(['fact', 'plan', 'hypothesis', 'client_statement']),
  claim_kind: z.enum(['number', 'money', 'date', 'sentence', 'list_item', 'paragraph']).nullish(),
  source_id: z.string().nullish(),
  source_locator: z.object({ page: z.number().int(), quote: z.string() }).nullish(),
  confidence: z.number().nullish(),
});

export const anchorSchema = z.object({ anchor_summary: z.string().min(1) });

export const extractSchema = z.object({
  fields: z.array(
    z.object({
      section_id: z.number().int(),
      field_key: z.string(),
      value: z.string().nullable(),
      claims: z.array(claimSchema).default([]),
    }),
  ),
});

export const validateSchema = z.object({
  is_valid: z.boolean(),
  rejection_reason: z.string().nullish(),
  formatted_value: z.string().nullish(),
  claims: z.array(claimSchema).default([]),
});

export const noveltySchema = z.object({
  analogues_count: z.number().int().min(0),
  analogues_list: z.array(z.string()).default([]),
  has_measurable_comparison: z.boolean(),
  missing_details_question: z.string().nullish(),
});

export const navigatorSchema = z.object({
  summary: z.string(),
  checklist: z.array(z.string()).default([]),
});

export type LlmClaim = z.output<typeof claimSchema>;
export type ExtractOutput = z.output<typeof extractSchema>;
export type ValidateOutput = z.output<typeof validateSchema>;
export type NoveltyOutput = z.output<typeof noveltySchema>;
export type NavigatorOutput = z.output<typeof navigatorSchema>;

/** Вызов LLM + проверка формы ответа. */
export async function callLlm<S extends z.ZodTypeAny>(
  llm: LlmClient,
  task: LlmTask,
  input: unknown,
  schema: S,
): Promise<z.output<S>> {
  const raw = await llm.complete(task, input);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new PipelineFailure('INTERNAL', `LLM (${task}) вернул неверный формат: ${parsed.error.message}`);
  }
  return parsed.data;
}
