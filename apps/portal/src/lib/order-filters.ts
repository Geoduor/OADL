import type { AgentOrder, OrderStatus } from './types.js';

// Filters for the agent's open-orders list (manager's reference screens, Q32).
// Client-side only: the server already returns just this agent's open orders.

export type StatusFilter = 'ALL' | OrderStatus;

export interface OrderFilters {
  status: StatusFilter;
  // YYYY-MM-DD in Nairobi, or '' for any date. Matches the order's scheduled
  // date exactly.
  scheduledDate: string;
}

export const NO_FILTERS: OrderFilters = { status: 'ALL', scheduledDate: '' };

export function filterAgentOrders(
  orders: AgentOrder[],
  filters: OrderFilters,
): AgentOrder[] {
  return orders.filter(
    (order) =>
      (filters.status === 'ALL' || order.status === filters.status) &&
      (filters.scheduledDate === '' ||
        order.scheduledDate === filters.scheduledDate),
  );
}

// How many orders each status chip would show, so a chip never leads to an
// empty list by surprise.
export function countByStatus(orders: AgentOrder[]): Record<string, number> {
  const counts: Record<string, number> = { ALL: orders.length };
  for (const order of orders) {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
  }
  return counts;
}
