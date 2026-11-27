import { z } from 'zod';

export const listNotificationsSchema = z.object({
  // "true" shows only unread ones.
  unread: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
