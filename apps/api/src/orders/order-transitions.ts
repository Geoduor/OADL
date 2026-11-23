// The order state machine as data (docs/ORDER_LIFECYCLE.md, "Transition
// rules"). Pure: no database, so it is easy to test. Anything not listed
// here is rejected.
//
// DELIVERED records the payment in the same transaction (D34). The stock
// deduction it also requires is not built yet (ROADMAP step 7).

export type OrderStatusName =
  | 'PLACED'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'UNRESPONSIVE'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type Actor = 'MANAGER' | 'AGENT';

export interface TransitionRule {
  from: OrderStatusName;
  to: OrderStatusName;
  actors: readonly Actor[];
  // What the request must carry besides the target status.
  needs?: 'reason' | 'agent' | 'date' | 'payment';
  // The order must move to a different agent than the current one.
  differentAgent?: boolean;
  // Bumps Order.attemptCount.
  countsAttempt?: boolean;
  // Removes the assigned agent (the order goes back to the manager's queue).
  clearsAgent?: boolean;
}

const M = ['MANAGER'] as const;
const A = ['AGENT'] as const;
const AM = ['AGENT', 'MANAGER'] as const;

export const TRANSITIONS: readonly TransitionRule[] = [
  { from: 'PLACED', to: 'CONFIRMED', actors: M },
  { from: 'PLACED', to: 'UNRESPONSIVE', actors: M, countsAttempt: true },
  { from: 'PLACED', to: 'CANCELLED', actors: M, needs: 'reason' },

  { from: 'CONFIRMED', to: 'ASSIGNED', actors: M, needs: 'agent' },
  { from: 'CONFIRMED', to: 'CANCELLED', actors: M, needs: 'reason' },

  { from: 'ASSIGNED', to: 'DISPATCHED', actors: A },
  { from: 'ASSIGNED', to: 'UNRESPONSIVE', actors: A, countsAttempt: true },
  { from: 'ASSIGNED', to: 'RESCHEDULED', actors: AM, needs: 'date' },
  // D33: the manager may move an assigned order to another agent until it is
  // dispatched.
  {
    from: 'ASSIGNED',
    to: 'ASSIGNED',
    actors: M,
    needs: 'agent',
    differentAgent: true,
  },
  { from: 'ASSIGNED', to: 'CANCELLED', actors: M, needs: 'reason' },

  { from: 'DISPATCHED', to: 'DELIVERED', actors: A, needs: 'payment' },
  { from: 'DISPATCHED', to: 'UNRESPONSIVE', actors: A, countsAttempt: true },
  { from: 'DISPATCHED', to: 'RESCHEDULED', actors: AM, needs: 'date' },
  { from: 'DISPATCHED', to: 'CANCELLED', actors: M, needs: 'reason' },

  { from: 'UNRESPONSIVE', to: 'RESCHEDULED', actors: AM, needs: 'date' },
  { from: 'UNRESPONSIVE', to: 'DISPATCHED', actors: A },
  { from: 'UNRESPONSIVE', to: 'CANCELLED', actors: M, needs: 'reason' },
  // D32: the manager can send an unresponsive order back to try again. The
  // agent, if there was one, is released (clearsAgent) so the order can be
  // confirmed and assigned afresh. UNCONFIRMED with the client: clearing the
  // agent is the assistant's reading of D32.
  { from: 'UNRESPONSIVE', to: 'PLACED', actors: M, clearsAgent: true },
  { from: 'UNRESPONSIVE', to: 'CONFIRMED', actors: M, clearsAgent: true },

  { from: 'RESCHEDULED', to: 'DISPATCHED', actors: A },
  // D33: from RESCHEDULED the manager may pick any active agent, including
  // the one who had the order (the failed attempt may not be the agent's
  // fault). Only ASSIGNED to ASSIGNED requires a different agent, because
  // otherwise nothing would change.
  { from: 'RESCHEDULED', to: 'ASSIGNED', actors: M, needs: 'agent' },
  { from: 'RESCHEDULED', to: 'CANCELLED', actors: M, needs: 'reason' },
];

export function findTransition(
  from: OrderStatusName,
  to: OrderStatusName,
): TransitionRule | undefined {
  return TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}
