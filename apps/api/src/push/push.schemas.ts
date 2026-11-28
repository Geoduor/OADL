import { z } from 'zod';
import { isAcceptablePushEndpoint } from './push-endpoint.js';

const base64Url = /^[A-Za-z0-9_-]+$/;

// Shape of PushSubscription.toJSON() from the browser (MDN, Push API).
export const subscribeSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(isAcceptablePushEndpoint, 'Not a valid push endpoint'),
  keys: z.object({
    p256dh: z.string().max(200).regex(base64Url),
    auth: z.string().max(100).regex(base64Url),
  }),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const unsubscribeSchema = z.object({
  endpoint: z.string().max(2048),
});
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
