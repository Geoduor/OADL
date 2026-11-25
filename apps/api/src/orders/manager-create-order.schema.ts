import { z } from 'zod';
import { createOrderSchema } from './create-order.schema.js';

// An order the manager enters for a customer who reached him another way
// (phone, WhatsApp, in person). Same customer and item rules as the
// storefront, no bot check (the manager is signed in), no tracking fields.
// The idempotency key stops a double click creating two orders.
//
// The manager may set the total. The items still use the bundle prices, so
// the difference stays visible; a reason is then required (checked in the
// service) and goes into the order history.
// TODO(confirm): who may discount and by how much is not a client rule yet.
// The upper bound is a typo guard.
export const managerCreateOrderSchema = createOrderSchema
  .omit({
    turnstileToken: true,
    landingSlug: true,
    utmSource: true,
    utmMedium: true,
    utmCampaign: true,
    utmContent: true,
  })
  .extend({
    totalKes: z.number().int().min(1).max(1_000_000).optional(),
    reason: z.string().trim().min(1).max(300).optional(),
    notes: z.string().trim().min(1).max(1000).optional(),
  });

export type ManagerCreateOrderInput = z.infer<typeof managerCreateOrderSchema>;
