import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import { requireManager } from '../auth/require-role.js';
import {
  paymentsSummaryQuerySchema,
  type PaymentsSummaryQuery,
} from './payments.schemas.js';
import { PaymentsService } from './payments.service.js';

// Manager-only: what each agent has recorded as collected.
@Controller('manager/payments')
export class ManagerPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query({ schema: paymentsSummaryQuerySchema }) query: PaymentsSummaryQuery,
  ) {
    requireManager(user);
    return this.payments.summary(query);
  }
}
