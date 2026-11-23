import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TurnstileModule } from '../turnstile/turnstile.module.js';
import { ManagerOrdersController } from './manager-orders.controller.js';
import { ManagerOrdersService } from './manager-orders.service.js';
import { OrderStatusService } from './order-status.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [PrismaModule, TurnstileModule],
  controllers: [OrdersController, ManagerOrdersController],
  providers: [OrdersService, OrderStatusService, ManagerOrdersService],
})
export class OrdersModule {}
