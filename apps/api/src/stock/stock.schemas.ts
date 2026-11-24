import { z } from 'zod';

// TODO(confirm): the upper bounds are typo guards, not client rules.
const units = z.number().int().min(1).max(100_000);
const ids = {
  agentUserId: z.string().min(1).max(64),
  productId: z.string().min(1).max(64),
};

export const issueStockSchema = z.object({
  ...ids,
  quantity: units,
  note: z.string().trim().min(1).max(500).optional(),
});
export type IssueStockInput = z.infer<typeof issueStockSchema>;

export const returnStockSchema = issueStockSchema;
export type ReturnStockInput = IssueStockInput;

// A count correction or damage. Positive or negative, never zero, and a
// reason is required (docs/DATA_MODEL.md).
export const adjustStockSchema = z.object({
  ...ids,
  quantity: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0, 'Quantity cannot be zero'),
  reason: z.string().trim().min(1).max(500),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const stockQuerySchema = z.object({
  agentUserId: z.string().min(1).max(64).optional(),
});
export type StockQueryInput = z.infer<typeof stockQuerySchema>;

export const movementsQuerySchema = z.object({
  agentUserId: z.string().min(1).max(64).optional(),
  productId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type MovementsQueryInput = z.infer<typeof movementsQuerySchema>;
