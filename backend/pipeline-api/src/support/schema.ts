import { z } from 'zod';

// Тело POST /support. Ограничения совпадают с формой на фронтенде (features/support/Support.tsx).
export const supportRequestSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    name: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
  })
  .strict();

export type SupportRequest = z.output<typeof supportRequestSchema>;
