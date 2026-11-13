import { z } from 'zod';

export const chatPostRequestSchema = z
  .object({
    user_id: z.string().uuid(),
    message: z.string().trim().min(1).max(4000),
    active_section_id: z.number().int().min(1).max(10).nullish(),
    program: z.string().min(1).max(100).default('Студенческий стартап'),
  })
  .strict();

export const chatGetQuerySchema = z.object({
  user_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});
