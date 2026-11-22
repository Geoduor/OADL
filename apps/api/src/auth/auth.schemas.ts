import { z } from 'zod';
import { normaliseKenyanMobile } from '../orders/phone.js';

const phone = z
  .string()
  .trim()
  .max(20)
  .transform((value, ctx) => {
    const normalised = normaliseKenyanMobile(value);
    if (normalised === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid Kenyan mobile number',
      });
      return z.NEVER;
    }
    return normalised;
  });

// TODO(confirm): the length rules are technical defaults, not client rules.
// The hasher itself refuses empty passwords and anything over 4 KiB.
const password = z.string().min(10).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone,
  password,
  turnstileToken: z.string().min(1).max(2048),
});

export const loginSchema = z.object({
  phone,
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
