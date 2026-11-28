import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import {
  managerCreateOrderSchema,
  type ManagerCreateOrderInput,
} from './manager-create-order.schema.js';
import { AutoAssignService } from './auto-assign.service.js';
import { OrdersService } from './orders.service.js';
import { ManagerOrdersService } from './manager-orders.service.js';
import {
  changeStatusSchema,
  listOrdersSchema,
  type ChangeStatusInput,
  type ListOrdersInput,
} from './order-status.schemas.js';
import { OrderStatusService } from './order-status.service.js';

function requireManager(user: AuthUser): void {
  if (user.role !== 'MANAGER') {
    throw new ForbiddenException();
  }
}

// Not @Public: the global guard requires a signed-in user, and the manager
// role is checked here on the server.
@Controller('manager/orders')
export class ManagerOrdersController {
  constructor(
    private readonly orders: ManagerOrdersService,
    private readonly status: OrderStatusService,
    private readonly publicOrders: OrdersService,
    private readonly autoAssign: AutoAssignService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: listOrdersSchema }) query: ListOrdersInput,
  ) {
    requireManager(user);
    return this.orders.list(query);
  }

  // The manager enters an order for a customer who contacted him another way.
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: managerCreateOrderSchema }) body: ManagerCreateOrderInput,
  ) {
    requireManager(user);
    const id = await this.publicOrders.createByManager(user, body);
    return this.orders.detail(id);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    requireManager(user);
    return this.orders.detail(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  async changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: changeStatusSchema }) body: ChangeStatusInput,
  ) {
    requireManager(user);
    await this.status.change(id, user, body);
    return this.orders.detail(id);
  }

  // US-12, US-13: the system picks the agent (county, stock, fewest open
  // orders). 409 NO_AGENT_AVAILABLE says why nobody qualified.
  @Post(':id/auto-assign')
  @HttpCode(200)
  async autoAssignOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    requireManager(user);
    await this.autoAssign.assign(id, user);
    return this.orders.detail(id);
  }
}
