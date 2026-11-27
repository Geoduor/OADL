import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import { requireAgent } from '../auth/require-role.js';
import { AgentOverviewService } from './agent-overview.service.js';
import {
  historyQuerySchema,
  type HistoryQuery,
} from './agent-overview.schemas.js';

// Agent-only. Each agent only ever sees their own numbers (D27).
@Controller('agent')
export class AgentOverviewController {
  constructor(private readonly overview: AgentOverviewService) {}

  @Get('overview')
  mine(@CurrentUser() user: AuthUser) {
    requireAgent(user);
    return this.overview.overview(user.id);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthUser,
    @Query({ schema: historyQuerySchema }) query: HistoryQuery,
  ) {
    requireAgent(user);
    return this.overview.history(user.id, query.range);
  }
}
