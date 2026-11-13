import { z } from 'zod';

// Входной контракт POST /pipeline (валидация на границе сервиса).
export const pipelineRequestSchema = z
  .object({
    user_id: z.string().uuid(),
    action: z.enum(['init_or_upload', 'submit_answer', 'submit_form']),
    program: z.string().min(1).default('Студенческий стартап'),
    text_input: z.string().max(50_000).optional(),
    target_field: z
      .object({
        section_id: z.number().int().min(2).max(10),
        field_key: z.string().min(1).max(100),
      })
      .optional(),
    previous_question: z.string().max(2_000).optional(),
    files: z
      .array(
        z.object({
          file_name: z.string().min(1).max(255),
          file_url: z.string().min(1).max(2_048),
          sha256_hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
        }),
      )
      .max(20)
      .optional(),
    eligibility: z.record(z.string().min(1).max(100), z.boolean()).optional(),
    form: z
      .array(
        z.object({
          section_id: z.number().int().min(2).max(10),
          field_key: z.string().min(1).max(100),
          value: z.string().max(50_000),
        }),
      )
      .max(200)
      .optional(),
    budget_items: z
      .array(
        z.object({
          stage: z.union([z.literal(1), z.literal(2)]),
          category: z.enum(['salary', 'equipment', 'ip_and_premises', 'contractor', 'other']),
          title: z.string().trim().min(1).max(300),
          quantity: z.number().positive().max(1_000_000_000),
          unit_price: z.number().nonnegative().max(1_000_000_000),
          amount: z.number().nonnegative().max(1_000_000_000),
          justification: z.string().max(5_000).optional(),
        }),
      )
      .max(200)
      .optional(),
  })
  .strict();

export type ValidPipelineRequest = z.output<typeof pipelineRequestSchema>;
