import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import { requireManager } from '../auth/require-role.js';
import {
  adjustStockSchema,
  issueStockSchema,
  movementsQuerySchema,
  returnStockSchema,
  stockQuerySchema,
  type AdjustStockInput,
  type IssueStockInput,
  type MovementsQueryInput,
  type ReturnStockInput,
  type StockQueryInput,
} from './stock.schemas.js';
import { StockService } from './stock.service.js';

// Manager-only stock control (D35). Each write returns the agent's new levels.
@Controller('manager/stock')
export class ManagerStockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  overview(
    @CurrentUser() user: AuthUser,
    @Query({ schema: stockQuerySchema }) query: StockQueryInput,
  ) {
    requireManager(user);
    return this.stock.overview(query.agentUserId);
  }

  @Get('movements')
  movements(
    @CurrentUser() user: AuthUser,
    @Query({ schema: movementsQuerySchema }) query: MovementsQueryInput,
  ) {
    requireManager(user);
    return this.stock.movements(query);
  }

  @Post('issue')
  @HttpCode(200)
  issue(
    @CurrentUser() user: AuthUser,
    @Body({ schema: issueStockSchema }) body: IssueStockInput,
  ) {
    requireManager(user);
    return this.stock.issue(user, body);
  }

  @Post('return')
  @HttpCode(200)
  returnToStore(
    @CurrentUser() user: AuthUser,
    @Body({ schema: returnStockSchema }) body: ReturnStockInput,
  ) {
    requireManager(user);
    return this.stock.returnToStore(user, body);
  }

  @Post('adjust')
  @HttpCode(200)
  adjust(
    @CurrentUser() user: AuthUser,
    @Body({ schema: adjustStockSchema }) body: AdjustStockInput,
  ) {
    requireManager(user);
    return this.stock.adjust(user, body);
  }
}
