import { Body, Controller, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TurnstileService } from '../turnstile/turnstile.service.js';
import {
  createOrderSchema,
  type CreateOrderInput,
} from './create-order.schema.js';
import { OrdersService } from './orders.service.js';

// Public endpoint. Order of checks, cheapest first: rate limit (guard),
// schema validation (pipe), repeat submit, Turnstile, then the database.
// TODO(confirm): the limit below is a starting point, not a client rule.
// Many Kenyan mobile users can share one public IP, so tune it with real
// traffic from the ads.
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @Body({ schema: createOrderSchema }) body: CreateOrderInput,
    @Ip() ip: string,
  ) {
    const { turnstileToken, ...order } = body;

    const existing = await this.orders.findExisting(order.idempotencyKey);
    if (existing) {
      return existing;
    }

    await this.turnstile.verify(turnstileToken, ip);
    return this.orders.create(order);
  }
}
