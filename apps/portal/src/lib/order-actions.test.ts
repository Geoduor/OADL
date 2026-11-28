import { canAutoAssign, actionsFor } from './order-actions.js';
import { ORDER_STATUSES } from './types.js';

describe('actionsFor', () => {
  it('offers nothing once an order is delivered or cancelled', () => {
    expect(actionsFor('DELIVERED')).toEqual([]);
    expect(actionsFor('CANCELLED')).toEqual([]);
  });

  it('asks for the right extra input', () => {
    const byKey = (status: Parameters<typeof actionsFor>[0], key: string) =>
      actionsFor(status).find((action) => action.key === key);
    expect(byKey('CONFIRMED', 'assign')?.needs).toBe('agent');
    expect(byKey('ASSIGNED', 'reassign')?.excludeCurrentAgent).toBe(true);
    expect(byKey('DISPATCHED', 'reschedule')?.needs).toBe('date');
    expect(byKey('PLACED', 'cancel')?.needs).toBe('reason');
  });

  it('never offers the agent-only moves (dispatch, deliver)', () => {
    for (const status of ORDER_STATUSES) {
      for (const action of actionsFor(status)) {
        expect(['DISPATCHED', 'DELIVERED']).not.toContain(action.to);
      }
    }
  });

  it('lets the manager retry an unresponsive order (D32)', () => {
    const targets = actionsFor('UNRESPONSIVE').map((action) => action.to);
    expect(targets).toContain('PLACED');
    expect(targets).toContain('CONFIRMED');
  });
});

describe('canAutoAssign', () => {
  it('is for a confirmed order with no agent only', () => {
    expect(canAutoAssign({ status: 'CONFIRMED', assignedAgent: null })).toBe(
      true,
    );
    expect(canAutoAssign({ status: 'PLACED', assignedAgent: null })).toBe(
      false,
    );
    expect(
      canAutoAssign({ status: 'CONFIRMED', assignedAgent: { userId: 'u' } }),
    ).toBe(false);
  });
});
