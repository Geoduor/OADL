import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  chooseAgent,
  NO_AGENT_MESSAGES,
  type Candidate,
} from '../assignment/choose-agent.js';
import { StockService } from '../stock/stock.service.js';
import { findShortfalls } from '../stock/stock-math.js';
import { OrderStatusService } from './order-status.service.js';

const OPEN = ['ASSIGNED', 'DISPATCHED', 'RESCHEDULED', 'UNRESPONSIVE'] as const;

// Manager presses "Auto-assign" (US-12, US-13). This only chooses the agent;
// the move itself goes through OrderStatusService, the one writer of
// Order.status, so the state machine, history and notifications all apply.
@Injectable()
export class AutoAssignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly status: OrderStatusService,
  ) {}

  async assign(orderId: string, actor: AuthUser): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
        countyId: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    // Auto-assign is for an order waiting for an agent. Moving an order that
    // already has one is a manual decision.
    if (order.status !== 'CONFIRMED' || order.assignedAgentId) {
      throw new ConflictException(
        'Only a confirmed order with no agent can be auto-assigned',
      );
    }

    const agents = await this.prisma.agent.findMany({
      where: {
        active: true,
        user: { status: 'ACTIVE', role: 'AGENT' },
        counties: { some: { countyId: order.countyId } },
      },
      select: { id: true, userId: true, displayName: true },
    });
    const ids = agents.map((agent) => agent.id);
    const [levels, openCounts] = await Promise.all([
      this.stock.levels(this.prisma, ids),
      this.prisma.order.groupBy({
        by: ['assignedAgentId'],
        where: { assignedAgentId: { in: ids }, status: { in: [...OPEN] } },
        _count: { _all: true },
      }),
    ]);
    const open = new Map(
      openCounts.map((row) => [row.assignedAgentId, row._count._all]),
    );
    const candidates: Candidate[] = agents.map((agent) => ({
      agentId: agent.id,
      userId: agent.userId,
      displayName: agent.displayName,
      openOrders: open.get(agent.id) ?? 0,
      hasStock:
        findShortfalls(levels.get(agent.id) ?? new Map(), order.items)
          .length === 0,
    }));

    const choice = chooseAgent(candidates);
    if (!choice.ok) {
      throw new ConflictException({
        message: NO_AGENT_MESSAGES[choice.reason],
        code: 'NO_AGENT_AVAILABLE',
        reason: choice.reason,
      });
    }

    await this.status.change(order.id, actor, {
      to: 'ASSIGNED',
      agentUserId: choice.agent.userId,
      reason:
        'Auto-assigned: covers the county, has the stock, fewest open orders',
    });
  }
}
