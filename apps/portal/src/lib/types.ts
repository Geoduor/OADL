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

export interface AgentOrder {
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
  county: { name: string };
  items: {
    quantity: number;
    lineTotalKes: number;
    product: { name: string };
  }[];
}

export interface StockRow {
  productId: string;
  productName: string;
  onHand: number;
  reserved: number;
  available: number;
  needsAttention: boolean;
}

export interface StockOverviewAgent {
  agentUserId: string;
  agentName: string;
  active: boolean;
  products: StockRow[];
}

export type StockMovementType =
  'ISSUE' | 'DELIVERY' | 'RETURN_TO_STORE' | 'ADJUSTMENT';

export interface StockMovementRow {
  type: StockMovementType;
  quantity: number;
  note: string | null;
  createdAt: string;
  product: { name: string };
  agent: { displayName: string };
  order: { orderNo: string } | null;
  createdBy: { name: string } | null;
}

export interface PaymentsSummary {
  from: string | null;
  to: string | null;
  agents: {
    agentUserId: string;
    agentName: string;
    cashKes: number;
    mpesaKes: number;
    totalKes: number;
    payments: number;
  }[];
  totals: {
    cashKes: number;
    mpesaKes: number;
    totalKes: number;
    payments: number;
  };
}

export type HistoryRange = 'today' | 'week' | 'month' | 'all';

export interface AgentOverview {
  date: string;
  deliveredToday: number;
  collectedTodayKes: number;
  open: {
    total: number;
    assigned: number;
    dispatched: number;
    rescheduled: number;
    unresponsive: number;
  };
  completedToday: { done: number; of: number };
}

export interface AgentHistory {
  range: HistoryRange;
  count: number;
  collectedKes: number;
  deliveries: {
    id: string;
    orderNo: string;
    county: string;
    deliveredAt: string;
    method: 'CASH' | 'MPESA';
    amountKes: number;
    orderTotalKes: number;
    items: { productName: string; quantity: number }[];
  }[];
}
