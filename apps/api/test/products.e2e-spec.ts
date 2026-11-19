import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabase } from './support/local-database.js';

type PriceJson = {
  quantity: number;
  priceKes: number;
  compareAtPriceKes: number | null;
};
type ProductJson = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  prices: PriceJson[];
};

describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  const activeSlug = `test-active-${stamp}`;
  const hiddenSlug = `test-hidden-${stamp}`;

  beforeAll(async () => {
    assertLocalDatabase();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);

    await prisma.product.create({
      data: {
        name: 'TEST ACTIVE',
        slug: activeSlug,
        sortOrder: 9999,
        prices: {
          create: [
            { quantity: 2, priceKes: 180 },
            { quantity: 1, priceKes: 100, compareAtPriceKes: 150 },
            { quantity: 3, priceKes: 250, active: false },
          ],
        },
      },
    });
    await prisma.product.create({
      data: {
        name: 'TEST HIDDEN',
        slug: hiddenSlug,
        active: false,
        sortOrder: 9999,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const slugs = [activeSlug, hiddenSlug];
      await prisma.productPrice.deleteMany({
        where: { product: { slug: { in: slugs } } },
      });
      await prisma.product.deleteMany({ where: { slug: { in: slugs } } });
    }
    if (app) {
      await app.close();
    }
  });

  const expectedActive = {
    id: expect.any(String),
    name: 'TEST ACTIVE',
    slug: activeSlug,
    description: null,
    imageUrl: null,
    prices: [
      { quantity: 1, priceKes: 100, compareAtPriceKes: 150 },
      { quantity: 2, priceKes: 180, compareAtPriceKes: null },
    ],
  };

  it('lists active products with only their active prices, smallest bundle first', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    const body = res.body as ProductJson[];
    expect(body.find((p) => p.slug === activeSlug)).toEqual(expectedActive);
    expect(body.some((p) => p.slug === hiddenSlug)).toBe(false);
  });

  it('returns one product by slug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${activeSlug}`)
      .expect(200);
    expect(res.body as ProductJson).toEqual(expectedActive);
  });

  it('returns 404 for a hidden product', async () => {
    await request(app.getHttpServer())
      .get(`/products/${hiddenSlug}`)
      .expect(404);
  });

  it('returns 404 for an unknown slug', async () => {
    await request(app.getHttpServer())
      .get('/products/does-not-exist')
      .expect(404);
  });
});
