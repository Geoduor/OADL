import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// What an agent sees of an order. Explicit select, never a whole row: no
// other agent, no history, no internal notes. Customer name, phone and
// location are shown because the agent must deliver (D27).
const agentOrderSelect = {
  id: true,
  orderNo: true,
  status: true,
  customerName: true,
  customerPhone: true,
  location: true,
  totalKes: true,
  scheduledDate: true,
  attemptCount: true,
  createdAt: true,
  county: { select: { name: true } },
  items: {
    select: {
      quantity: true,
      lineTotalKes: true,
      product: { select: { name: true } },
    },
  },
} as const;

// TODO(confirm) Q30: an agent sees an order only while it is open and
// assigned to them. After delivery or cancellation it disappears from their
// view (the proposal in docs/CUSTOMER_RECORDS.md). The client has not
// answered how long access should last.
const OPEN_STATUSES = [
  'ASSIGNED',
  'DISPATCHED',
  'UNRESPONSIVE',
  'RESCHEDULED',
] as const;

@Injectable()
export class AgentOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // The filter on the agent's own user id is part of every query (D27); it
  // is not left to the controller.
  list(agentUserId: string) {
    return this.prisma.order.findMany({
      where: {
        status: { in: [...OPEN_STATUSES] },
        assignedAgent: { userId: agentUserId },
      },
      select: agentOrderSelect,
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async detail(agentUserId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        status: { in: [...OPEN_STATUSES] },
        assignedAgent: { userId: agentUserId },
      },
      select: agentOrderSelect,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
