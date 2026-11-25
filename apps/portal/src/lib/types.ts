// What the API sends. Written by hand for now; the shared package
// (packages/shared) will hold these once it exists.
// TODO(confirm): keep in step with the API selects in apps/api/src/orders.

export type Role = 'MANAGER' | 'AGENT';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

export const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'ASSIGNED',
  'DISPATCHED',
  'DELIVERED',
  'UNRESPONSIVE',
  'RESCHEDULED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ManagerOrderRow {
  id: string;
  orderNo: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  location: string;
  totalKes: number;
  scheduledDate: string | null;
  attemptCount: number;
  createdAt: string;
  county: { id: string; name: string };
  assignedAgent: { userId: string; displayName: string } | null;
  paidKes: number;
  paymentMismatch: boolean | null;
}

export interface ManagerOrderList {
  total: number;
  orders: ManagerOrderRow[];
}

export interface County {
  id: string;
  name: string;
}

export interface PendingRegistration {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface AgentView {
  userId: string;
  displayName: string;
  phone: string;
  status: string;
  active: boolean;
  counties: County[];
}

export interface ManagerOrderDetail extends ManagerOrderRow {
  source: string;
  notes: string | null;
  deliveredAt: string | null;
  items: {
    quantity: number;
    lineTotalKes: number;
    product: { name: string };
  }[];
  payments: {
    method: 'CASH' | 'MPESA';
    amountKes: number;
    createdAt: string;
    agent: { displayName: string } | null;
  }[];
  history: {
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    reason: string | null;
    createdAt: string;
    agent: { displayName: string } | null;
    changedBy: { name: string; role: Role } | null;
  }[];
}

export interface StockShortfall {
  productName: string;
  needed: number;
  available: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  prices: {
    quantity: number;
    priceKes: number;
    compareAtPriceKes: number | null;
  }[];
}
