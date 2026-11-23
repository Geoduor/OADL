import { z } from 'zod';

const orderStatuses = [
  'PLACED',
  'CONFIRMED',
  'ASSIGNED',
  'DISPATCHED',
  'DELIVERED',
  'UNRESPONSIVE',
  'RESCHEDULED',
  'CANCELLED',
] as const;

// The body of a status change. What each target status needs (reason, agent,
// date) comes from order-transitions.ts and is checked in the service.
export const changeStatusSchema = z.object({
  to: z.enum(orderStatuses),
  reason: z.string().trim().min(1).max(500).optional(),
  agentUserId: z.string().min(1).max(64).optional(),
  scheduledDate: z.iso.date().optional(),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const listOrdersSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  countyId: z.string().min(1).max(64).optional(),
  agentUserId: z.string().min(1).max(64).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
