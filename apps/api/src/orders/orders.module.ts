import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StockModule } from '../stock/stock.module.js';
import { TurnstileModule } from '../turnstile/turnstile.module.js';
import { AgentOrdersController } from './agent-orders.controller.js';
import { AgentOrdersService } from './agent-orders.service.js';
import { ManagerOrdersController } from './manager-orders.controller.js';
import { ManagerOrdersService } from './manager-orders.service.js';
import { OrderStatusService } from './order-status.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [PrismaModule, TurnstileModule, StockModule],
  controllers: [
    OrdersController,
    ManagerOrdersController,
    AgentOrdersController,
  ],
  providers: [
    OrdersService,
    OrderStatusService,
    ManagerOrdersService,
    AgentOrdersService,
  ],
})
export class OrdersModule {}
