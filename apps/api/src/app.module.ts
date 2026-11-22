import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CountiesModule } from './counties/counties.module.js';
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
    ProductsModule,
    CountiesModule,
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
