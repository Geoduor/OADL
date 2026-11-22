import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TurnstileModule } from '../turnstile/turnstile.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [PrismaModule, TurnstileModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
