import { z } from 'zod';

// Входной контракт POST /pipeline (валидация на границе сервиса).
export const pipelineRequestSchema = z
  .object({
    user_id: z.string().uuid(),
    action: z.enum(['init_or_upload', 'submit_answer', 'submit_form', 'skip_gap']),
    program: z.string().min(1).default('Студенческий стартап'),
    text_input: z.string().max(50_000).optional(),
    target_field: z
      .object({
        section_id: z.number().int().min(2).max(10),
        field_key: z.string().min(1).max(100),
      })
      .optional(),
    previous_question: z.string().max(2_000).optional(),
    skipped_fields: z
      .array(
        z.object({
          section_id: z.number().int().min(2).max(10),
          field_key: z.string().min(1).max(100),
        }),
      )
      .max(200)
      .optional(),
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

// Данные основателя (блок 1): POST /profile. Поля совпадают с FOUNDER_FIELD_KEYS из contracts.
export const profileRequestSchema = z
  .object({
    user_id: z.string().uuid(),
    founder: z
      .object({
        full_name: z.string().trim().min(1).max(200),
        contacts: z.string().trim().max(500).optional(),
        education_status: z.enum(['student', 'postgraduate']).optional(),
        university: z.string().trim().max(300).optional(),
        region: z.string().trim().max(200).optional(),
      })
      .strict(),
  })
  .strict();

// Вход выгрузки (POST /export): 10 секций паспорта с экрана. Сервер сверяет их с одобренными значениями.
export const exportRequestSchema = z
  .object({
    user_id: z.string().uuid(),
    sections: z
      .array(
        z.object({
          section_id: z.number().int().min(1).max(10),
          fields: z.array(z.object({ field_key: z.string().min(1).max(100), value: z.string().max(50_000) })).max(60),
        }),
      )
      .length(10),
  })
  .strict();

