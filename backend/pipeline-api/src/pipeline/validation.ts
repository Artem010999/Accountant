import { z } from 'zod';

// Входной контракт POST /pipeline (валидация на границе сервиса).
export const pipelineRequestSchema = z
  .object({
    user_id: z.string().uuid(),
    action: z.enum(['init_or_upload', 'submit_answer']),
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
  })
  .strict();

export type ValidPipelineRequest = z.output<typeof pipelineRequestSchema>;
