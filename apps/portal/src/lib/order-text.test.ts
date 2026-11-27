import { describe, expect, it } from 'vitest';
import { orderCopyText } from './order-text.js';
import type { ManagerOrderDetail } from './types.js';

const base: ManagerOrderDetail = {
  id: 'o1',
  orderNo: 'OADL-261127-0001',
  status: 'PLACED',
  customerName: 'Test Customer',
  customerPhone: '+254700000000',
  location: 'Test Estate, House 4',
  totalKes: 5500,
  scheduledDate: null,
  attemptCount: 0,
  createdAt: '2026-11-27T08:00:00.000Z',
  county: { id: 'c1', name: 'Nairobi' },
  assignedAgent: null,
  paidKes: 0,
  paymentMismatch: null,
  source: 'STOREFRONT',
  notes: null,
  deliveredAt: null,
  items: [
    { quantity: 2, lineTotalKes: 5500, product: { name: 'Test Product' } },
  ],
  payments: [],
  history: [],
};

describe('orderCopyText', () => {
  it('writes the order for WhatsApp', () => {
    expect(orderCopyText(base)).toBe(
      [
        'Order OADL-261127-0001',
        'Customer: Test Customer',
        'Phone: +254700000000',
        'Address: Test Estate, House 4, Nairobi',
        'Items:',
        '- 2 x Test Product (KES 5,500)',
        'Total: KES 5,500',
        'Payment: on delivery',
      ].join('\n'),
    );
  });

  it('adds schedule, note and agent only when present', () => {
    const text = orderCopyText({
      ...base,
      scheduledDate: '2026-11-30',
      notes: 'Call first',
      assignedAgent: { userId: 'u1', displayName: 'Test Agent' },
    });
    expect(text).toContain('Scheduled: 2026-11-30');
    expect(text).toContain('Note: Call first');
    expect(text).toContain('Agent: Test Agent');
  });
});
