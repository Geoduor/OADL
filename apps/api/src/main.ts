import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a proxy (Render) the client IP is in X-Forwarded-For. Without this
  // every visitor looks like the proxy and shares one rate-limit bucket.
  // Express accepts a hop count, an address list or a keyword such as
  // "loopback" (https://docs.nestjs.com/security/rate-limiting). The right
  // value on Render is UNVERIFIED: set TRUST_PROXY only after checking it.
  const trustProxy = process.env['TRUST_PROXY'];
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
