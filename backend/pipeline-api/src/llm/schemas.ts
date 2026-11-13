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

export const fatalStopFactorSchema = z.object({
  code: z
    .enum(['MILITARY_OR_DUAL_USE', 'NO_TECH_BASIS'])
    .or(
      z.string().transform((c) => {
        if (c.toUpperCase().includes('MILITARY') || c.toUpperCase().includes('DUAL')) {
          return 'MILITARY_OR_DUAL_USE' as const;
        }
        return 'NO_TECH_BASIS' as const;
      }),
    ),
  reason: z.string().nullish().transform((v) => v || 'Обнаружен стоп-фактор проекта.'),
  how_to_fix: z.string().nullish().transform((v) => v || 'Переформулируйте проект в гражданскую и научно-техническую плоскость.'),
  affected_sections: z.array(z.number().int().min(2).max(10)).default([3, 4]),
});

export const blockAuditItemSchema = z.object({
  section_id: z.number().int().min(2).max(10),
  status: z.enum(['approved', 'needs_revision']).or(z.string().transform((s) => (s === 'approved' ? 'approved' : 'needs_revision'))),
  remark: z.string().nullish(),
  how_to_fix: z.string().nullish(),
  failed_fields: z.array(z.string()).default([]),
});

export const chatGuardSchema = z.object({
  verdict: z.enum(['ok', 'solve_task']),
  reason: z.string().default(''),
});

// Ответ ИИ-Консультанта по промпту 'consultant': поле reply; предупреждения — опционально.
export const consultantSchema = z.object({
  reply: z.string().min(1),
  warnings: z.array(z.string()).default([]),
});

export const auditOutputSchema = z.object({
  fatal_stop_factors: z.array(fatalStopFactorSchema).default([]),
  block_audits: z.array(blockAuditItemSchema).default([]),
  novelty_audit: z
    .object({
      analogues_count: z.number().int().min(0).default(0),
      analogues_list: z.array(z.string()).default([]),
      has_measurable_comparison: z.boolean().default(false),
      passed: z.boolean().default(false),
      remark: z.string().nullish(),
      how_to_fix: z.string().nullish(),
    })
    .nullish(),
  budget_audit: z
    .object({
      status: z
        .enum(['approved', 'needs_revision', 'not_provided'])
        .or(
          z.string().transform((s) => {
            if (s === 'approved') return 'approved' as const;
            if (s === 'not_provided') return 'not_provided' as const;
            return 'needs_revision' as const;
          }),
        )
        .default('not_provided'),
      remark: z.string().nullish(),
      how_to_fix: z.string().nullish(),
    })
    .nullish(),
});

export type LlmClaim = z.output<typeof claimSchema>;
export type ExtractOutput = z.output<typeof extractSchema>;
export type ValidateOutput = z.output<typeof validateSchema>;
export type NoveltyOutput = z.output<typeof noveltySchema>;
export type NavigatorOutput = z.output<typeof navigatorSchema>;
export type FatalStopFactor = z.output<typeof fatalStopFactorSchema>;
export type BlockAuditItem = z.output<typeof blockAuditItemSchema>;
export type AuditOutput = z.output<typeof auditOutputSchema>;

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
