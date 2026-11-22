import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CountiesModule } from './counties/counties.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [ProductsModule, CountiesModule, OrdersModule],
  controllers: [AppController],
  providers: [
    // Validates any parameter that declares a schema, for example
    // @Body({ schema }). Registered here so tests get it too.
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
    AppService,
  ],
})
export class AppModule {}
