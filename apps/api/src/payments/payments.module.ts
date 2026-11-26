import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ManagerPaymentsController } from './manager-payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ManagerPaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
