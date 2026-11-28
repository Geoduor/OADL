import { Injectable } from '@nestjs/common';
import { sendNotification, WebPushError } from 'web-push';
import { pushConfig } from './push.config.js';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// ok: delivered to the push service. gone: the subscription is dead and
// should be deleted. retry: a temporary problem, try again later.
export type PushResult = 'ok' | 'gone' | 'retry';

// TODO(confirm): how long a push service should keep an undelivered alert.
// The library default is four weeks, far too long for "new order"; one day is
// a technical placeholder, not a client rule.
const TTL_SECONDS = 24 * 60 * 60;

// The only place that talks to the push services. Kept behind a class so tests
// can replace it and never send anything real.
@Injectable()
export class PushSender {
  isEnabled(): boolean {
    return pushConfig() !== null;
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    const config = pushConfig();
    if (!config) return 'retry';
    try {
      await sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        JSON.stringify(payload),
        {
          TTL: TTL_SECONDS,
          urgency: 'high',
          vapidDetails: {
            subject: config.subject,
            publicKey: config.publicKey,
            privateKey: config.privateKey,
          },
        },
      );
      return 'ok';
    } catch (caught) {
      // 410 Gone: expired or unsubscribed (Pushpad guide, citing push service
      // behaviour). 404 treated the same.
      // TODO(confirm): check 404 against a push service's documentation.
      if (
        caught instanceof WebPushError &&
        (caught.statusCode === 410 || caught.statusCode === 404)
      ) {
        return 'gone';
      }
      return 'retry';
    }
  }
}
