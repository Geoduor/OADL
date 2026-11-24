import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  available,
  findShortfalls,
  type Level,
  type Needed,
  type Shortfall,
} from './stock-math.js';
import type {
  AdjustStockInput,
  IssueStockInput,
  MovementsQueryInput,
  ReturnStockInput,
} from './stock.schemas.js';

type Db = PrismaService | Prisma.TransactionClient;

// Orders that hold stock for their agent until they are delivered or end
// (docs/DATA_MODEL.md: "Reserved").
const RESERVING = [
  'ASSIGNED',
  'DISPATCHED',
  'RESCHEDULED',
  'UNRESPONSIVE',
] as const;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  // On hand and reserved per product for the given agents (or all agents).
  // `excludeOrderId` leaves one order out of "reserved", so re-checking an
  // order that already reserves stock does not count it twice.
  async levels(
    db: Db,
    agentIds?: string[],
    excludeOrderId?: string,
  ): Promise<Map<string, Map<string, Level>>> {
    const agentFilter = agentIds ? { in: agentIds } : undefined;
    const [movements, items] = await Promise.all([
      db.stockMovement.groupBy({
        by: ['agentId', 'productId'],
        where: { agentId: agentFilter },
        _sum: { quantity: true },
      }),
      db.orderItem.findMany({
        where: {
          order: {
            status: { in: [...RESERVING] },
            assignedAgentId: agentFilter ?? { not: null },
            ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
          },
        },
        select: {
          productId: true,
          quantity: true,
          order: { select: { assignedAgentId: true } },
        },
      }),
    ]);

    const result = new Map<string, Map<string, Level>>();
    const level = (agentId: string, productId: string): Level => {
      let perAgent = result.get(agentId);
      if (!perAgent) {
        perAgent = new Map();
        result.set(agentId, perAgent);
      }
      let entry = perAgent.get(productId);
      if (!entry) {
        entry = { onHand: 0, reserved: 0 };
        perAgent.set(productId, entry);
      }
      return entry;
    };
    for (const row of movements) {
      level(row.agentId, row.productId).onHand = row._sum.quantity ?? 0;
    }
    for (const item of items) {
      const agentId = item.order.assignedAgentId;
      if (agentId) {
        level(agentId, item.productId).reserved += item.quantity;
      }
    }
    return result;
  }

  // What an agent cannot cover for an order's items. Empty means enough.
  async shortfalls(
    db: Db,
    agentId: string,
    needed: readonly Needed[],
    excludeOrderId?: string,
  ): Promise<Shortfall[]> {
    const levels = await this.levels(db, [agentId], excludeOrderId);
    return findShortfalls(levels.get(agentId) ?? new Map(), needed);
  }

  // Manager view: every agent and product that has stock or reservations.
  async overview(agentUserId?: string) {
    const agents = await this.prisma.agent.findMany({
      where: agentUserId ? { userId: agentUserId } : {},
      select: { id: true, userId: true, displayName: true, active: true },
      orderBy: { displayName: 'asc' },
    });
    const levels = await this.levels(
      this.prisma,
      agents.map((agent) => agent.id),
    );
    const names = await this.productNames();
    return agents.map((agent) => ({
      agentUserId: agent.userId,
      agentName: agent.displayName,
      active: agent.active,
      products: toRows(levels.get(agent.id), names),
    }));
  }

  // The signed-in agent's own stock (US-36).
  async forAgentUser(userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const levels = await this.levels(this.prisma, [agent.id]);
    return toRows(levels.get(agent.id), await this.productNames());
  }

  async movements(query: MovementsQueryInput) {
    const where: Prisma.StockMovementWhereInput = {
      ...(query.agentUserId ? { agent: { userId: query.agentUserId } } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        select: {
          type: true,
          quantity: true,
          note: true,
          createdAt: true,
          product: { select: { name: true } },
          agent: { select: { displayName: true } },
          order: { select: { orderNo: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ]);
    return { total, movements };
  }

  // The manager gives stock to an agent (D35). Only to an active agent.
  async issue(manager: { id: string }, input: IssueStockInput) {
    const agent = await this.agentByUser(input.agentUserId, true);
    await this.assertProduct(input.productId);
    await this.prisma.stockMovement.create({
      data: {
        agentId: agent.id,
        productId: input.productId,
        type: 'ISSUE',
        quantity: input.quantity,
        note: input.note ?? null,
        createdByUserId: manager.id,
      },
    });
    return this.overview(input.agentUserId);
  }

  // The agent gives stock back to the company. Cannot return what open
  // orders already hold.
  // TODO(confirm) Q12: how returns, damages and counts are recorded in
  // practice is the design's proposal, not a client answer.
  async returnToStore(manager: { id: string }, input: ReturnStockInput) {
    const agent = await this.agentByUser(input.agentUserId, false);
    await this.assertProduct(input.productId);
    await this.prisma.$transaction(async (tx) => {
      const levels = await this.levels(tx, [agent.id]);
      const have = available(levels.get(agent.id)?.get(input.productId));
      if (input.quantity > have) {
        throw new ConflictException(
          `Only ${have} available to return (the rest is on hand but held for open orders, or not issued)`,
        );
      }
      await tx.stockMovement.create({
        data: {
          agentId: agent.id,
          productId: input.productId,
          type: 'RETURN_TO_STORE',
          quantity: -input.quantity,
          note: input.note ?? null,
          createdByUserId: manager.id,
        },
      });
    });
    return this.overview(input.agentUserId);
  }

  // Count correction or damage. A reason is required; the agent's on-hand
  // cannot go below zero.
  async adjust(manager: { id: string }, input: AdjustStockInput) {
    const agent = await this.agentByUser(input.agentUserId, false);
    await this.assertProduct(input.productId);
    await this.prisma.$transaction(async (tx) => {
      const levels = await this.levels(tx, [agent.id]);
      const onHand = levels.get(agent.id)?.get(input.productId)?.onHand ?? 0;
      if (onHand + input.quantity < 0) {
        throw new ConflictException(
          `That would leave ${onHand + input.quantity} on hand`,
        );
      }
      await tx.stockMovement.create({
        data: {
          agentId: agent.id,
          productId: input.productId,
          type: 'ADJUSTMENT',
          quantity: input.quantity,
          note: input.reason,
          createdByUserId: manager.id,
        },
      });
    });
    return this.overview(input.agentUserId);
  }

  private async agentByUser(userId: string, mustBeActive: boolean) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      select: { id: true, active: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    if (mustBeActive && !agent.active) {
      throw new BadRequestException('That agent is not active');
    }
    return agent;
  }

  private async assertProduct(productId: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { id: productId } });
    if (count === 0) {
      throw new BadRequestException('Unknown product');
    }
  }

  private async productNames(): Promise<Map<string, string>> {
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true },
    });
    return new Map(products.map((product) => [product.id, product.name]));
  }
}

function toRows(
  levels: Map<string, Level> | undefined,
  names: Map<string, string>,
) {
  return [...(levels ?? new Map<string, Level>())]
    .map(([productId, level]) => ({
      productId,
      productName: names.get(productId) ?? 'Unknown product',
      onHand: level.onHand,
      reserved: level.reserved,
      available: available(level),
      // A negative on-hand means goods were delivered beyond recorded stock.
      needsAttention: level.onHand < 0,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}
