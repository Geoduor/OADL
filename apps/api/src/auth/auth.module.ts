import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TurnstileModule } from '../turnstile/turnstile.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaAuthenticationStore } from './prisma-authentication.store.js';
import { SessionAuth } from './session-auth.provider.js';

@Module({
  imports: [PrismaModule, TurnstileModule],
  controllers: [AuthController],
  providers: [AuthService, PrismaAuthenticationStore, SessionAuth],
})
export class AuthModule {}
