import type { NotificationRow, Role } from './types.js';

// How often the bell asks the server for the unread count (N3 polls; the live
// pop-up over a WebSocket is N2).
// TODO(confirm): 20 seconds is the assistant's choice, not a client rule.
export const POLL_MS = 20_000;

// Fired after the user reads something, so the bell updates at once.
export const NOTIFICATIONS_CHANGED = 'oadl:notifications-changed';

export function announceNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

// Where tapping a notification goes. An agent cannot open an order that has
// been taken off them (the server answers 404), so those stay plain text.
export function orderPathFor(
  role: Role,
  notification: Pick<NotificationRow, 'orderId' | 'type'>,
): string | null {
  if (!notification.orderId) {
    return null;
  }
  if (role === 'AGENT') {
    return notification.type === 'ORDER_RELEASED'
      ? null
      : `/agent/orders/${notification.orderId}`;
  }
  return `/manager/orders/${notification.orderId}`;
}

export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
