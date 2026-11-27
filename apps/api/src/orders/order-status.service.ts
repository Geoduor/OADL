import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-types.js';
import {
  NotificationsService,
  type NewNotification,
} from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import type { ChangeStatusInput } from './order-status.schemas.js';
import { findTransition, type OrderStatusName } from './order-transitions.js';

// The only code that writes Order.status (AGENTS.md section 5). One call
// checks the rule, changes the order and writes the history row in one
// transaction.
//
// TODO(confirm): side effects are not built yet and belong here when they
// are: manager and agent notifications, customer SMS on DISPATCHED, the
// Google Sheet update, stock reservation and release (ROADMAP steps 7 to 9).
// They will be queued in the outbox inside this transaction.
@Injectable()
export class OrderStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly notifications: NotificationsService,
  ) {}

  async change(orderId: string, actor: AuthUser, input: ChangeStatusInput) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        status: true,
        assignedAgentId: true,
        assignedAgent: { select: { userId: true } },
        county: { select: { name: true } },
      },
    });
    // An agent only ever sees orders assigned to them (D27); anything else
    // looks like a missing order.
    if (
      !order ||
      (actor.role === 'AGENT' && order.assignedAgent?.userId !== actor.id)
    ) {
      throw new NotFoundException('Order not found');
    }

    const from = order.status as OrderStatusName;
    const rule = findTransition(from, input.to);
    if (!rule) {
      throw new ConflictException(
        `An order that is ${from} cannot become ${input.to}`,
      );
    }
    if (!rule.actors.includes(actor.role)) {
      throw new ForbiddenException();
    }

    if (rule.needs === 'reason' && !input.reason) {
      throw new BadRequestException('A reason is required');
    }
    if (rule.needs === 'payment' && !(input.paymentMethod && input.amountKes)) {
      throw new BadRequestException(
        'The payment method and the amount collected are required',
      );
    }
    if (rule.needs === 'date') {
      if (!input.scheduledDate) {
        throw new BadRequestException('A new delivery date is required');
      }
      // TODO(confirm): rejecting past dates is the assistant's choice, not a
      // client rule.
      if (input.scheduledDate < todayInNairobi()) {
        throw new BadRequestException('The new date cannot be in the past');
      }
    }

    let newAgentId: string | null = order.assignedAgentId;
    let newAgentUserId: string | null = null;
    let overridden = false;
    if (rule.needs === 'agent') {
      if (!input.agentUserId) {
        throw new BadRequestException('An agent is required');
      }
      const agent = await this.prisma.agent.findFirst({
        where: {
          userId: input.agentUserId,
          active: true,
          user: { status: 'ACTIVE', role: 'AGENT' },
        },
        select: { id: true, userId: true },
      });
      if (!agent) {
        throw new BadRequestException('That agent is not active');
      }
      if (rule.differentAgent && agent.id === order.assignedAgentId) {
        throw new BadRequestException('The order is already with that agent');
      }
      newAgentId = agent.id;
      newAgentUserId = agent.userId;

      // Stock check (D35): the agent needs enough available stock for every
      // item. The manager can override after being warned. The check is
      // advisory under concurrency: with one manager that is acceptable.
      const items = await this.prisma.orderItem.findMany({
        where: { orderId: order.id },
        select: {
          productId: true,
          quantity: true,
          product: { select: { name: true } },
        },
      });
      const shortfalls = await this.stock.shortfalls(
        this.prisma,
        agent.id,
        items,
        order.id,
      );
      if (shortfalls.length > 0 && !input.overrideStock) {
        const names = new Map(
          items.map((item) => [item.productId, item.product.name]),
        );
        throw new ConflictException({
          message: 'That agent does not have enough stock for this order',
          code: 'INSUFFICIENT_STOCK',
          shortfalls: shortfalls.map((s) => ({
            productName: names.get(s.productId) ?? 'Unknown product',
            needed: s.needed,
            available: s.available,
          })),
        });
      }
      overridden = shortfalls.length > 0;
      // TODO(confirm): D8 auto-assign (county, stock, fewest open orders) is
      // not built. Manual assignment does not check county coverage.
    }
    if (rule.clearsAgent) {
      newAgentId = null;
    }

    await this.prisma.$transaction(async (tx) => {
      // Conditional on the state we checked, so two clicks at once cannot
      // both win.
      const { count } = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          assignedAgentId: order.assignedAgentId,
        },
        data: {
          status: input.to,
          assignedAgentId: newAgentId,
          ...(rule.countsAttempt ? { attemptCount: { increment: 1 } } : {}),
          ...(rule.needs === 'payment' ? { deliveredAt: new Date() } : {}),
          ...(rule.needs === 'date' && input.scheduledDate
            ? { scheduledDate: new Date(input.scheduledDate) }
            : {}),
        },
      });
      if (count === 0) {
        throw new ConflictException('The order was changed by someone else');
      }
      // D34: the agent who delivered holds the money. The amount is whatever
      // the agent collected; a difference from the order total is shown to
      // the manager, not blocked. The row is append-only.
      if (rule.needs === 'payment' && input.paymentMethod && input.amountKes) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            // Set: an agent can only act on an order assigned to them.
            agentId: order.assignedAgentId as string,
            method: input.paymentMethod,
            amountKes: input.amountKes,
            recordedByUserId: actor.id,
          },
        });
      }
      // Delivery takes the items out of the delivering agent's stock. It is
      // never blocked: if the ledger says the agent had less, on-hand goes
      // negative and the manager sees it flagged. The unique key on
      // (order, product, type) stops a second deduction.
      if (rule.needs === 'payment' && order.assignedAgentId) {
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          select: { productId: true, quantity: true },
        });
        // One row per product, even if an order had two lines for it (the
        // unique key allows one deduction per order and product).
        const perProduct = new Map<string, number>();
        for (const item of items) {
          perProduct.set(
            item.productId,
            (perProduct.get(item.productId) ?? 0) + item.quantity,
          );
        }
        await tx.stockMovement.createMany({
          data: [...perProduct].map(([productId, quantity]) => ({
            agentId: order.assignedAgentId as string, // checked just above
            productId,
            type: 'DELIVERY' as const,
            quantity: -quantity,
            orderId: order.id,
            createdByUserId: actor.id,
          })),
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: input.to,
          reason:
            input.reason ??
            (overridden
              ? 'Assigned without enough stock (manager override)'
              : null),
          agentId: newAgentId,
          changedByUserId: actor.id,
        },
      });
      // Written in the same transaction, so a notification exists exactly
      // when the change does. Bodies carry the order number and county only.
      await this.notifications.createMany(
        tx,
        await this.notificationsFor(tx, {
          order,
          actor,
          to: input.to,
          newAgentUserId,
          clearsAgent: rule.clearsAgent === true,
        }),
      );
    });
  }

  // Who needs to know about this change:
  // - a newly assigned agent: the order is theirs now;
  // - the agent the order leaves (moved, cancelled, sent back): it is no
  //   longer theirs;
  // - the agent, when the manager reschedules or cancels their order;
  // - the managers, when an agent moves the order on.
  private async notificationsFor(
    tx: Parameters<NotificationsService['managerIds']>[0],
    change: {
      order: {
        id: string;
        orderNo: string;
        assignedAgent: { userId: string } | null;
        county: { name: string };
      };
      actor: AuthUser;
      to: ChangeStatusInput['to'];
      newAgentUserId: string | null;
      clearsAgent: boolean;
    },
  ): Promise<NewNotification[]> {
    const { order, actor, to, newAgentUserId, clearsAgent } = change;
    const where = `${order.orderNo} in ${order.county.name}`;
    const items: NewNotification[] = [];
    const previousAgentUserId = order.assignedAgent?.userId ?? null;

    if (newAgentUserId) {
      items.push({
        userId: newAgentUserId,
        type: 'ORDER_ASSIGNED',
        title: 'New order assigned',
        body: where,
        orderId: order.id,
      });
    }
    // The previous agent loses the order when it is cancelled, sent back, or
    // given to someone else. Agents never need telling about their own moves.
    if (previousAgentUserId && actor.role === 'MANAGER') {
      const leaves =
        to === 'CANCELLED' ||
        clearsAgent ||
        (newAgentUserId !== null && newAgentUserId !== previousAgentUserId);
      if (leaves) {
        items.push({
          userId: previousAgentUserId,
          type: 'ORDER_RELEASED',
          title: to === 'CANCELLED' ? 'Order cancelled' : 'Order taken off you',
          body: where,
          orderId: order.id,
        });
      } else if (!newAgentUserId) {
        // The manager changed the order and the same agent keeps it
        // (rescheduled).
        items.push({
          userId: previousAgentUserId,
          type: 'ORDER_STATUS_CHANGED',
          title: `Order ${statusLabel(to)}`,
          body: where,
          orderId: order.id,
        });
      }
    }
    if (actor.role === 'AGENT') {
      for (const userId of await this.notifications.managerIds(tx)) {
        items.push({
          userId,
          type: 'ORDER_STATUS_CHANGED',
          title: `Order ${statusLabel(to)}`,
          body: `${where} (${actor.name})`,
          orderId: order.id,
        });
      }
    }
    return items;
  }
}

function statusLabel(status: string): string {
  return status.toLowerCase();
}

// YYYY-MM-DD in Kenya, so "today" matches the manager's calendar.
function todayInNairobi(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
  }).format(new Date());
}
