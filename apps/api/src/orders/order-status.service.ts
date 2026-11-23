import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-types.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
  constructor(private readonly prisma: PrismaService) {}

  async change(orderId: string, actor: AuthUser, input: ChangeStatusInput) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
        assignedAgent: { select: { userId: true } },
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
        select: { id: true },
      });
      if (!agent) {
        throw new BadRequestException('That agent is not active');
      }
      if (rule.differentAgent && agent.id === order.assignedAgentId) {
        throw new BadRequestException('The order is already with that agent');
      }
      newAgentId = agent.id;
      // TODO(confirm): D8 says auto-assign uses the order's county, and the
      // lifecycle requires a stock check. Manual assignment here does neither
      // yet; the stock module does not exist (ROADMAP step 7).
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
          ...(rule.needs === 'date' && input.scheduledDate
            ? { scheduledDate: new Date(input.scheduledDate) }
            : {}),
        },
      });
      if (count === 0) {
        throw new ConflictException('The order was changed by someone else');
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: input.to,
          reason: input.reason ?? null,
          agentId: newAgentId,
          changedByUserId: actor.id,
        },
      });
    });
  }
}

// YYYY-MM-DD in Kenya, so "today" matches the manager's calendar.
function todayInNairobi(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
  }).format(new Date());
}
