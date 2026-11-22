import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';
import { TurnstileService } from '../turnstile/turnstile.service.js';
import type { AuthUser } from './auth-types.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';

// TODO(confirm): the limits are starting points. There is no per-account
// lockout yet; the IP limit and the hasher's cost are the brake on guessing.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body({ schema: registerSchema }) body: RegisterInput,
    @Ip() ip: string,
  ) {
    const { turnstileToken, ...input } = body;
    await this.turnstile.verify(turnstileToken, ip);
    await this.auth.register(input);
    return {
      message:
        'Registration received. The manager must approve your account before you can sign in.',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body({ schema: loginSchema }) body: LoginInput) {
    return this.auth.login(body);
  }

  @Post('logout')
  @HttpCode(204)
  async logout() {
    await this.auth.logout();
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, name: user.name, role: user.role };
  }
}
