import { formatKes } from './format.js';
import type { ManagerOrderDetail } from './types.js';

// Plain text the manager can paste into WhatsApp (manager's reference screens,
// Q32). Payment is always "on delivery" for now (D41). Nothing is added that
// the order does not hold: no invented fields.
export function orderCopyText(order: ManagerOrderDetail): string {
  const lines = [
    `Order ${order.orderNo}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Address: ${order.location}, ${order.county.name}`,
    'Items:',
    ...order.items.map(
      (item) =>
        `- ${item.quantity} x ${item.product.name} (${formatKes(item.lineTotalKes)})`,
    ),
    `Total: ${formatKes(order.totalKes)}`,
    'Payment: on delivery',
  ];
  if (order.scheduledDate) lines.push(`Scheduled: ${order.scheduledDate}`);
  if (order.notes) lines.push(`Note: ${order.notes}`);
  if (order.assignedAgent)
    lines.push(`Agent: ${order.assignedAgent.displayName}`);
  return lines.join('\n');
}
