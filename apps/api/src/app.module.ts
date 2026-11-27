import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthenticationModule } from '@nestjs/authentication';
import { AgentsModule } from './agents/agents.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PaymentsModule } from './payments/payments.module.js';
import { StockModule } from './stock/stock.module.js';
import { AuthModule } from './auth/auth.module.js';
import { allowedOrigins } from './config/origins.js';
import { CountiesModule } from './counties/counties.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    // TODO(confirm): default limit per IP and minute is a starting point.
    // RATE_LIMIT_DISABLED is for the e2e tests only; never set it elsewhere.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => process.env['RATE_LIMIT_DISABLED'] === 'true',
    }),
    // Global guard: every route needs a signed-in user unless it is @Public().
    // Lifetimes (D25): agents 30 days; the manager's 7 days is enforced in
    // SessionAuth.validate because the package has one TTL for all users.
    AuthenticationModule.forRoot({
      session: {
        absoluteTtl: '30d',
        idleTtl: '30d',
        trustedOrigins: allowedOrigins(),
      },
    }),
    AuthModule,
    AgentsModule,
    StockModule,
    PaymentsModule,
    ProductsModule,
    CountiesModule,
    HealthModule,
    NotificationsModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [
    // Validates any parameter that declares a schema, for example
    // @Body({ schema }). Registered here so tests get it too.
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AppService,
  ],
})
export class AppModule {}
