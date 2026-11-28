import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import {
  subscribeSchema,
  unsubscribeSchema,
  type SubscribeInput,
  type UnsubscribeInput,
} from './push.schemas.js';
import { PushService } from './push.service.js';

// Both roles may turn alerts on for their own devices.
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  // The public half of the VAPID key. Public by design (the browser needs it
  // to subscribe), but still behind sign-in like the rest of the API.
  @Get('public-key')
  publicKey() {
    return this.push.publicKey();
  }

  @Post('subscribe')
  @HttpCode(200)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body({ schema: subscribeSchema }) body: SubscribeInput,
  ) {
    await this.push.subscribe(user.id, body);
    return { ok: true };
  }

  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body({ schema: unsubscribeSchema }) body: UnsubscribeInput,
  ) {
    await this.push.unsubscribe(user.id, body.endpoint);
    return { ok: true };
  }
}
