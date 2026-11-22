import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CountiesController } from './counties.controller.js';
import { CountiesService } from './counties.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CountiesController],
  providers: [CountiesService],
})
export class CountiesModule {}
