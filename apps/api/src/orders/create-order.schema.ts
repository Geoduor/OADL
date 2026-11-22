import { z } from 'zod';
import { normaliseKenyanMobile } from './phone.js';

// Public order request. The client never sends prices, totals, status or
// roles: those are decided on the server. Unknown keys are dropped.
// TODO(confirm): the length limits below are technical bounds, not client
// rules. The client has not given any.
const optionalText = z.string().trim().min(1).max(200).optional();

export const createOrderSchema = z.object({
  idempotencyKey: z.uuid(),
  // Cloudflare Turnstile token from the widget; max length 2048 per Cloudflare.
  turnstileToken: z.string().min(1).max(2048),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z
    .string()
    .trim()
    .max(20)
    .transform((value, ctx) => {
      const phone = normaliseKenyanMobile(value);
      if (phone === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter a valid Kenyan mobile number',
        });
        return z.NEVER;
      }
      return phone;
    }),
  countyId: z.uuid(),
  location: z.string().trim().min(3).max(300),
  // TODO(confirm): one line per product, and the quantity must be a defined
  // bundle (Q2). Several bundles of the same product are not allowed yet.
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10)
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      { message: 'Send one line per product' },
    ),
  landingSlug: optionalText,
  utmSource: optionalText,
  utmMedium: optionalText,
  utmCampaign: optionalText,
  utmContent: optionalText,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
