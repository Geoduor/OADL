import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AgentStockController } from './agent-stock.controller.js';
import { ManagerStockController } from './manager-stock.controller.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ManagerStockController, AgentStockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
