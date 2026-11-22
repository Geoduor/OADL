import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabase } from './support/local-database.js';

describe('GET /counties (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  let countyId: string;

  beforeAll(async () => {
    assertLocalDatabase();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    const county = await prisma.county.create({
      data: {
        name: `Test Listed County ${stamp}`,
        code: 700000 + Math.floor(Math.random() * 90000),
      },
    });
    countyId = county.id;
  });

  afterAll(async () => {
    await prisma.county.delete({ where: { id: countyId } });
    await app.close();
  });

  it('lists counties with only id and name', async () => {
    const response = await request(app.getHttpServer())
      .get('/counties')
      .expect(200);
    const list = response.body as { id: string; name: string }[];
    const ours = list.find((county) => county.id === countyId);
    expect(ours).toEqual({ id: countyId, name: `Test Listed County ${stamp}` });
  });
});
