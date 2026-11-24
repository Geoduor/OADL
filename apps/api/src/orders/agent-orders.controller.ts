import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import { AgentOrdersService } from './agent-orders.service.js';
import {
  agentChangeStatusSchema,
  type AgentChangeStatusInput,
} from './order-status.schemas.js';
import { OrderStatusService } from './order-status.service.js';

function requireAgent(user: AuthUser): void {
  if (user.role !== 'AGENT') {
    throw new ForbiddenException();
  }
}

// Agent endpoints. Every query is scoped to the signed-in agent's own
// orders; the status service also refuses orders that are not theirs.
@Controller('agent/orders')
export class AgentOrdersController {
  constructor(
    private readonly orders: AgentOrdersService,
    private readonly status: OrderStatusService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    requireAgent(user);
    return this.orders.list(user.id);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    requireAgent(user);
    return this.orders.detail(user.id, id);
  }

  // Dispatch, unresponsive or reschedule. DELIVERED needs a payment record
  // and is built later; cancelling and assigning are the manager's.
  @Post(':id/status')
  @HttpCode(200)
  async changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: agentChangeStatusSchema }) body: AgentChangeStatusInput,
  ) {
    requireAgent(user);
    await this.status.change(id, user, body);
    return this.orders.detail(user.id, id);
  }
}
