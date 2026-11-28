// Helpers for phone alerts (Web Push). Sources: MDN PushManager.subscribe and
// the WebKit post on Web Push for web apps (docs/INTEGRATIONS.md section 5).

export type PushSupport =
  | 'ok'
  | 'unsupported'
  // iPhone and iPad (16.4 or newer) only allow push for a web app added to the
  // Home Screen, not for a Safari tab.
  | 'needs-install';

export interface PushEnvironment {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isApple: boolean;
  isStandalone: boolean;
}

export function pushSupport(env: PushEnvironment): PushSupport {
  if (env.isApple && !env.isStandalone) {
    return 'needs-install';
  }
  return env.hasServiceWorker && env.hasPushManager && env.hasNotification
    ? 'ok'
    : 'unsupported';
}

export function readEnvironment(): PushEnvironment {
  const agent = navigator.userAgent;
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isApple: /iPhone|iPad|iPod/.test(agent),
    isStandalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      nav.standalone === true,
  };
}

// The server's VAPID public key arrives as URL-safe base64; subscribe() wants
// the raw bytes.
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export interface SubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// What the API's POST /push/subscribe expects, from PushSubscription.toJSON().
export function subscriptionBody(
  json: PushSubscriptionJSON,
): SubscriptionBody | null {
  const { endpoint, keys } = json;
  if (!endpoint || !keys?.['p256dh'] || !keys['auth']) {
    return null;
  }
  return { endpoint, keys: { p256dh: keys['p256dh'], auth: keys['auth'] } };
}
