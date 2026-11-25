import type { OrderStatus } from './types.js';

// Which buttons an agent sees per status. Display hint only: the server
// checks every move against the state machine and the order's owner
// (apps/api/src/orders/order-transitions.ts, agent rows). Keep in step.

export interface AgentAction {
  key: string;
  label: string;
  to: 'DISPATCHED' | 'DELIVERED' | 'UNRESPONSIVE' | 'RESCHEDULED';
  needs?: 'date' | 'payment';
}

const dispatch: AgentAction = {
  key: 'dispatch',
  label: 'Dispatched',
  to: 'DISPATCHED',
};
const deliver: AgentAction = {
  key: 'deliver',
  label: 'Delivered',
  to: 'DELIVERED',
  needs: 'payment',
};
const unresponsive: AgentAction = {
  key: 'unresponsive',
  label: 'Customer unresponsive',
  to: 'UNRESPONSIVE',
};
const reschedule: AgentAction = {
  key: 'reschedule',
  label: 'Reschedule',
  to: 'RESCHEDULED',
  needs: 'date',
};

export function agentActionsFor(status: OrderStatus): AgentAction[] {
  switch (status) {
    case 'ASSIGNED':
      return [dispatch, unresponsive, reschedule];
    case 'DISPATCHED':
      return [deliver, unresponsive, reschedule];
    case 'UNRESPONSIVE':
      return [dispatch, reschedule];
    case 'RESCHEDULED':
      return [dispatch];
    default:
      return [];
  }
}
