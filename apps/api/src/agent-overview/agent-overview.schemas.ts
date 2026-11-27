import { z } from 'zod';
import { HISTORY_RANGES } from './history-range.js';

export const historyQuerySchema = z.object({
  range: z.enum(HISTORY_RANGES).default('week'),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
