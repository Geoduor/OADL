// Where tapping a push should open. Same rules as the in-app list: an agent
// is not linked to an order taken off them (they may no longer read it).
export function pushUrl(
  role: 'MANAGER' | 'AGENT',
  type: string,
  orderId: string | null,
): string {
  if (!orderId || type === 'ORDER_RELEASED') return '/notifications';
  return role === 'MANAGER'
    ? `/manager/orders/${orderId}`
    : `/agent/orders/${orderId}`;
}
