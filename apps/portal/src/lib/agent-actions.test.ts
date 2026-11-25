import { agentActionsFor } from './agent-actions.js';
import { ORDER_STATUSES } from './types.js';

describe('agentActionsFor', () => {
  it('lets an agent deliver only a dispatched order, with payment', () => {
    for (const status of ORDER_STATUSES) {
      const deliver = agentActionsFor(status).find((a) => a.to === 'DELIVERED');
      if (status === 'DISPATCHED') {
        expect(deliver?.needs).toBe('payment');
      } else {
        expect(deliver).toBeUndefined();
      }
    }
  });

  it('never offers cancel or assign, which are the manager’s', () => {
    for (const status of ORDER_STATUSES) {
      for (const action of agentActionsFor(status)) {
        expect(['CANCELLED', 'ASSIGNED']).not.toContain(action.to);
      }
    }
  });

  it('offers nothing on closed or unassigned orders', () => {
    for (const status of [
      'PLACED',
      'CONFIRMED',
      'DELIVERED',
      'CANCELLED',
    ] as const) {
      expect(agentActionsFor(status)).toEqual([]);
    }
  });
});
