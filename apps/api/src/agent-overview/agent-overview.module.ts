import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AgentOverviewController } from './agent-overview.controller.js';
import { AgentOverviewService } from './agent-overview.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AgentOverviewController],
  providers: [AgentOverviewService],
})
export class AgentOverviewModule {}
