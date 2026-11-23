import {
  TRANSITIONS,
  findTransition,
  type OrderStatusName,
} from './order-transitions.js';

const ALL: OrderStatusName[] = [
  'PLACED',
  'CONFIRMED',
  'ASSIGNED',
  'DISPATCHED',
  'DELIVERED',
  'UNRESPONSIVE',
  'RESCHEDULED',
  'CANCELLED',
];

describe('order transitions', () => {
  it('has no duplicate rules', () => {
    const keys = TRANSITIONS.map((rule) => `${rule.from}>${rule.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never leaves a final status', () => {
    for (const rule of TRANSITIONS) {
      expect(['DELIVERED', 'CANCELLED']).not.toContain(rule.from);
    }
  });

  it('lets the manager cancel every non-final status, with a reason', () => {
    for (const from of ALL.filter(
      (s) => s !== 'DELIVERED' && s !== 'CANCELLED',
    )) {
      const rule = findTransition(from, 'CANCELLED');
      expect(rule?.actors).toEqual(['MANAGER']);
      expect(rule?.needs).toBe('reason');
    }
  });

  it('keeps the manager phone-confirm step: PLACED cannot jump to ASSIGNED', () => {
    expect(findTransition('PLACED', 'ASSIGNED')).toBeUndefined();
    expect(findTransition('PLACED', 'DISPATCHED')).toBeUndefined();
  });

  it('only the assigned agent side dispatches', () => {
    for (const from of ['ASSIGNED', 'UNRESPONSIVE', 'RESCHEDULED'] as const) {
      expect(findTransition(from, 'DISPATCHED')?.actors).toEqual(['AGENT']);
    }
  });

  it('D32: the manager can retry an unresponsive order via PLACED or CONFIRMED', () => {
    expect(findTransition('UNRESPONSIVE', 'PLACED')?.actors).toEqual([
      'MANAGER',
    ]);
    expect(findTransition('UNRESPONSIVE', 'CONFIRMED')?.actors).toEqual([
      'MANAGER',
    ]);
  });

  it('D33: reassignment is closed once dispatched; only ASSIGNED to ASSIGNED needs a different agent', () => {
    expect(findTransition('ASSIGNED', 'ASSIGNED')?.differentAgent).toBe(true);
    expect(
      findTransition('RESCHEDULED', 'ASSIGNED')?.differentAgent,
    ).toBeFalsy();
    expect(findTransition('DISPATCHED', 'ASSIGNED')).toBeUndefined();
  });

  it('counts an attempt on every move to UNRESPONSIVE', () => {
    for (const rule of TRANSITIONS.filter((r) => r.to === 'UNRESPONSIVE')) {
      expect(rule.countsAttempt).toBe(true);
    }
  });

  it('DELIVERED comes only from DISPATCHED, by the agent, with a payment (D34)', () => {
    const rules = TRANSITIONS.filter((rule) => rule.to === 'DELIVERED');
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      from: 'DISPATCHED',
      actors: ['AGENT'],
      needs: 'payment',
    });
  });
});
