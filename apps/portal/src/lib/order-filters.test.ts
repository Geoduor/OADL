import { describe, expect, it } from 'vitest';
import {
  countByStatus,
  filterAgentOrders,
  NO_FILTERS,
} from './order-filters.js';
import type { AgentOrder, OrderStatus } from './types.js';

function order(
  id: string,
  status: OrderStatus,
  scheduledDate: string | null = null,
): AgentOrder {
  return {
    id,
    orderNo: id,
    status,
    customerName: 'Test Customer',
    customerPhone: '+254700000000',
    location: 'Test street',
    totalKes: 1000,
    scheduledDate,
    attemptCount: 0,
    createdAt: '2026-11-27T08:00:00.000Z',
    county: { name: 'Nairobi' },
    items: [],
  };
}

const orders = [
  order('a', 'ASSIGNED'),
  order('b', 'DISPATCHED'),
  order('c', 'RESCHEDULED', '2026-11-30'),
  order('d', 'RESCHEDULED', '2026-12-01'),
];

describe('filterAgentOrders', () => {
  it('returns everything with no filters', () => {
    expect(filterAgentOrders(orders, NO_FILTERS)).toHaveLength(4);
  });

  it('filters by status', () => {
    const result = filterAgentOrders(orders, {
      ...NO_FILTERS,
      status: 'RESCHEDULED',
    });
    expect(result.map((o) => o.id)).toEqual(['c', 'd']);
  });

  it('filters by exact scheduled date', () => {
    const result = filterAgentOrders(orders, {
      ...NO_FILTERS,
      scheduledDate: '2026-11-30',
    });
    expect(result.map((o) => o.id)).toEqual(['c']);
  });

  it('combines status and date', () => {
    const result = filterAgentOrders(orders, {
      status: 'DISPATCHED',
      scheduledDate: '2026-11-30',
    });
    expect(result).toEqual([]);
  });

  it('does not change the input', () => {
    const copy = [...orders];
    filterAgentOrders(orders, { ...NO_FILTERS, status: 'ASSIGNED' });
    expect(orders).toEqual(copy);
  });
});

describe('countByStatus', () => {
  it('counts per status and in total', () => {
    expect(countByStatus(orders)).toEqual({
      ALL: 4,
      ASSIGNED: 1,
      DISPATCHED: 1,
      RESCHEDULED: 2,
    });
  });
});
