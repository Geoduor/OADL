import { z } from 'zod';

// Dates are Nairobi calendar days (Kenya has no daylight saving, so the
// offset is always +03:00). Both are optional and inclusive.
export const paymentsSummaryQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '"from" must not be after "to"',
  });

export type PaymentsSummaryQuery = z.infer<typeof paymentsSummaryQuerySchema>;
