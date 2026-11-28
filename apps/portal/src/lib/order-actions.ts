import type { OrderStatus } from './types.js';

// Which buttons the manager sees for each status. This only decides what to
// SHOW. The server checks every move against the real state machine
// (apps/api/src/orders/order-transitions.ts), so a mistake here can never
// make an illegal change. Keep it in step with the manager rows there.
// TODO: move the rules into packages/shared once it exists.

export interface ManagerAction {
  key: string;
  label: string;
  to: OrderStatus;
  needs?: 'reason' | 'agent' | 'date';
  // Reassigning an ASSIGNED order must pick a different agent (D33).
  excludeCurrentAgent?: boolean;
  danger?: boolean;
}

const cancel: ManagerAction = {
  key: 'cancel',
  label: 'Cancel order',
  to: 'CANCELLED',
  needs: 'reason',
  danger: true,
};

const reschedule: ManagerAction = {
  key: 'reschedule',
  label: 'Reschedule',
  to: 'RESCHEDULED',
  needs: 'date',
};

export function actionsFor(status: OrderStatus): ManagerAction[] {
  switch (status) {
    case 'PLACED':
      return [
        { key: 'confirm', label: 'Confirm order', to: 'CONFIRMED' },
        { key: 'unresponsive', label: 'Mark unresponsive', to: 'UNRESPONSIVE' },
        cancel,
      ];
    case 'CONFIRMED':
      return [
        {
          key: 'assign',
          label: 'Assign to agent',
          to: 'ASSIGNED',
          needs: 'agent',
        },
        cancel,
      ];
    case 'ASSIGNED':
      return [
        {
          key: 'reassign',
          label: 'Move to another agent',
          to: 'ASSIGNED',
          needs: 'agent',
          excludeCurrentAgent: true,
        },
        reschedule,
        cancel,
      ];
    case 'DISPATCHED':
      return [reschedule, cancel];
    case 'UNRESPONSIVE':
      return [
        reschedule,
        { key: 'retry-placed', label: 'Back to Placed', to: 'PLACED' },
        { key: 'retry-confirmed', label: 'Back to Confirmed', to: 'CONFIRMED' },
        cancel,
      ];
    case 'RESCHEDULED':
      return [
        {
          key: 'assign',
          label: 'Assign to agent',
          to: 'ASSIGNED',
          needs: 'agent',
        },
        cancel,
      ];
    case 'DELIVERED':
    case 'CANCELLED':
      return [];
  }
}

// The server decides (apps/api/src/orders/auto-assign.service.ts); this only
// hides a button that could never work: auto-assign is for a confirmed order
// that has no agent yet.
export function canAutoAssign(order: {
  status: string;
  assignedAgent: unknown | null;
}): boolean {
  return order.status === 'CONFIRMED' && !order.assignedAgent;
}
