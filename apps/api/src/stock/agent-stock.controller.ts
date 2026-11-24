import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import { requireAgent } from '../auth/require-role.js';
import { StockService } from './stock.service.js';

// An agent sees only their own stock (D27, US-36).
@Controller('agent/stock')
export class AgentStockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    requireAgent(user);
    return this.stock.forAgentUser(user.id);
  }
}
