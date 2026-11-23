import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListOrdersInput } from './order-status.schemas.js';

// Manager view of orders. Explicit selects, never whole rows.
const listSelect = {
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
  county: { select: { id: true, name: true } },
  assignedAgent: { select: { userId: true, displayName: true } },
} as const;

const detailSelect = {
  ...listSelect,
  source: true,
  notes: true,
  deliveredAt: true,
  items: {
    select: {
      quantity: true,
      lineTotalKes: true,
      product: { select: { name: true } },
    },
  },
  history: {
    orderBy: { createdAt: 'asc' },
    select: {
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      agent: { select: { displayName: true } },
      changedBy: { select: { name: true, role: true } },
    },
  },
} as const;

@Injectable()
export class ManagerOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOrdersInput) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.countyId ? { countyId: query.countyId } : {}),
      ...(query.agentUserId
        ? { assignedAgent: { userId: query.agentUserId } }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              // inclusive of the whole "to" day (UTC; display is Nairobi)
              ...(query.to
                ? { lt: new Date(new Date(query.to).getTime() + 86_400_000) }
                : {}),
            },
          }
        : {}),
    };
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: listSelect,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ]);
    return { total, orders };
  }

  async detail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
