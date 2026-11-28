import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PushController } from './push.controller.js';
import { PushSender } from './push-sender.js';
import { PushService } from './push.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService, PushSender],
})
export class PushModule {}
