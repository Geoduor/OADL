import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { nairobiDayStart, nairobiToday } from '../time/nairobi.js';
import { rangeStart, type HistoryRange } from './history-range.js';

// The statuses an agent works on (same set as AgentOrdersService).
const OPEN_STATUSES = [
  'ASSIGNED',
  'DISPATCHED',
  'UNRESPONSIVE',
  'RESCHEDULED',
] as const;

const HISTORY_LIMIT = 200;

// The agent's own numbers (docs/REQUIREMENTS.md US-31 to US-36 and the
// manager's reference screens, Q32). Every query is scoped to the signed-in
// agent's own user id (D27). Money is "collected as recorded by the agent"
// (D38), never earnings: there is no agent fee rule yet (Q34).
@Injectable()
export class AgentOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  private async agentIdFor(userId: string): Promise<string> {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent.id;
  }

  async overview(userId: string, now: Date = new Date()) {
    const agentId = await this.agentIdFor(userId);
    const date = nairobiToday(now);
    const [today, open] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { agentId, createdAt: { gte: nairobiDayStart(date) } },
        _sum: { amountKes: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: {
          assignedAgent: { userId },
          status: { in: [...OPEN_STATUSES] },
        },
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    let openTotal = 0;
    for (const row of open) {
      byStatus[row.status] = row._count._all;
      openTotal += row._count._all;
    }
    const deliveredToday = today._count._all;
    return {
      date,
      deliveredToday,
      collectedTodayKes: today._sum.amountKes ?? 0,
      open: {
        total: openTotal,
        assigned: byStatus['ASSIGNED'] ?? 0,
        dispatched: byStatus['DISPATCHED'] ?? 0,
        rescheduled: byStatus['RESCHEDULED'] ?? 0,
        unresponsive: byStatus['UNRESPONSIVE'] ?? 0,
      },
      // "Completed today": delivered today out of what was delivered today
      // plus what is still open.
      // TODO(confirm): the manager's reference shows "0 / 17" without saying
      // what the 17 counts.
      completedToday: { done: deliveredToday, of: deliveredToday + openTotal },
    };
  }

  // Delivered orders with what was collected. Deliberately no customer name,
  // phone or location: a delivered order leaves the agent's view (D27, Q30
  // proposal), so history shows the order number, county and items only.
  async history(userId: string, range: HistoryRange, now: Date = new Date()) {
    const agentId = await this.agentIdFor(userId);
    const from = rangeStart(range, now);
    const where = {
      agentId,
      ...(from ? { createdAt: { gte: from } } : {}),
    };
    const [rows, totals] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          method: true,
          amountKes: true,
          createdAt: true,
          order: {
            select: {
              orderNo: true,
              totalKes: true,
              county: { select: { name: true } },
              items: {
                select: {
                  quantity: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: HISTORY_LIMIT,
      }),
      this.prisma.payment.aggregate({
        where,
        _sum: { amountKes: true },
        _count: { _all: true },
      }),
    ]);
    return {
      range,
      count: totals._count._all,
      collectedKes: totals._sum.amountKes ?? 0,
      deliveries: rows.map((row) => ({
        id: row.id,
        orderNo: row.order.orderNo,
        county: row.order.county.name,
        deliveredAt: row.createdAt,
        method: row.method,
        amountKes: row.amountKes,
        orderTotalKes: row.order.totalKes,
        items: row.order.items.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
        })),
      })),
    };
  }
}
