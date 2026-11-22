import { Body, Controller, Post } from '@nestjs/common';
import {
  createOrderSchema,
  type CreateOrderInput,
} from './create-order.schema.js';
import { OrdersService } from './orders.service.js';

// TODO(confirm): rate limiting and bot protection are required before this
// endpoint is exposed publicly (AGENTS.md section 6). They are the next PR.
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body({ schema: createOrderSchema }) body: CreateOrderInput) {
    return this.orders.create(body);
  }
}
