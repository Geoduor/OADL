import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { TurnstileService } from '../src/turnstile/turnstile.service.js';
import { assertLocalDatabase } from './support/local-database.js';

// Every other e2e file runs with rate limiting off. This one turns it on.
describe('Rate limit on POST /orders (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertLocalDatabase();
    delete process.env['RATE_LIMIT_DISABLED'];
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TurnstileService)
      .useValue({ verify: vi.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 10 requests a minute from one IP, then answers 429', async () => {
    // Invalid bodies are enough: the rate limit runs before validation.
    for (let i = 0; i < 10; i++) {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({});
      expect(response.status).toBe(400);
    }
    await request(app.getHttpServer()).post('/orders').send({}).expect(429);
  });
});
