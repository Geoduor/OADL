import type { StockMovementType } from './types.js';

// The three things a manager can record. The server validates everything
// (active agent for issue, never return more than is free, never adjust below
// zero, reason required for an adjustment).
export type StockActionKey = 'issue' | 'return' | 'adjust';

export interface StockAction {
  key: StockActionKey;
  label: string;
  path: string;
  // Adjust can be negative (a loss) or positive (a found item).
  signed: boolean;
  noteField: 'note' | 'reason';
  noteRequired: boolean;
}

export const STOCK_ACTIONS: readonly StockAction[] = [
  {
    key: 'issue',
    label: 'Give stock to an agent',
    path: '/manager/stock/issue',
    signed: false,
    noteField: 'note',
    noteRequired: false,
  },
  {
    key: 'return',
    label: 'Agent returns stock',
    path: '/manager/stock/return',
    signed: false,
    noteField: 'note',
    noteRequired: false,
  },
  {
    key: 'adjust',
    label: 'Correct a count or damage',
    path: '/manager/stock/adjust',
    signed: true,
    noteField: 'reason',
    noteRequired: true,
  },
];

export function movementLabel(type: StockMovementType): string {
  switch (type) {
    case 'ISSUE':
      return 'Given to agent';
    case 'DELIVERY':
      return 'Delivered';
    case 'RETURN_TO_STORE':
      return 'Returned';
    case 'ADJUSTMENT':
      return 'Correction';
  }
}

// The request body for a stock action. Quantity must be a whole number; for
// actions that are not signed it must be positive.
export function stockBody(
  action: StockAction,
  input: {
    agentUserId: string;
    productId: string;
    quantity: string;
    note: string;
  },
): Record<string, unknown> | null {
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity === 0) return null;
  if (!action.signed && quantity < 0) return null;
  const note = input.note.trim();
  if (action.noteRequired && !note) return null;
  return {
    agentUserId: input.agentUserId,
    productId: input.productId,
    quantity,
    ...(note ? { [action.noteField]: note } : {}),
  };
}
