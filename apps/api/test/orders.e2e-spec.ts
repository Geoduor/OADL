import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabase } from './support/local-database.js';

type OrderJson = {
  orderNo: string;
  status: string;
  totalKes: number;
  items: { productName: string; quantity: number; lineTotalKes: number }[];
};

// All data is fake. Rows are unique to this file and deleted in afterAll.
describe('POST /orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stamp = Date.now();
  let countyId: string;
  let productId: string;
  let hiddenProductId: string;

  const body = (overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: randomUUID(),
    customerName: 'Test Customer',
    customerPhone: '0700 000 000',
    countyId,
    location: 'Test estate, near the test stage',
    items: [{ productId, quantity: 2 }],
    ...overrides,
  });

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
        name: `Test County ${stamp}`,
        code: 800000 + Math.floor(Math.random() * 90000),
      },
    });
    countyId = county.id;
    const product = await prisma.product.create({
      data: {
        name: 'TEST ORDER PRODUCT',
        slug: `test-order-flow-${stamp}`,
        prices: {
          create: [
            { quantity: 1, priceKes: 100 },
            { quantity: 2, priceKes: 180 },
            { quantity: 3, priceKes: 250, active: false },
          ],
        },
      },
    });
    productId = product.id;
    const hidden = await prisma.product.create({
      data: {
        name: 'TEST HIDDEN ORDER PRODUCT',
        slug: `test-order-hidden-${stamp}`,
        active: false,
        prices: { create: [{ quantity: 1, priceKes: 100 }] },
      },
    });
    hiddenProductId = hidden.id;
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { countyId },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.productPrice.deleteMany({
      where: { productId: { in: [productId, hiddenProductId] } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [productId, hiddenProductId] } },
    });
    await prisma.county.delete({ where: { id: countyId } });
    await app.close();
  });

  it('creates a PLACED order and prices it from the database', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(
        body({
          // Client-supplied money and status must be ignored.
          totalKes: 1,
          status: 'DELIVERED',
          items: [{ productId, quantity: 2, priceKes: 1 }],
        }),
      )
      .expect(201);
    const order = response.body as OrderJson;

    expect(order.orderNo).toMatch(/^OADL-\d{6}-\d{4}$/);
    expect(order.status).toBe('PLACED');
    expect(order.totalKes).toBe(180);
    expect(order.items).toEqual([
      { productName: 'TEST ORDER PRODUCT', quantity: 2, lineTotalKes: 180 },
    ]);
    expect(Object.keys(response.body as object).sort()).toEqual([
      'items',
      'orderNo',
      'status',
      'totalKes',
    ]);

    const saved = await prisma.order.findUnique({
      where: { orderNo: order.orderNo },
      include: { items: true, history: true },
    });
    expect(saved?.customerPhone).toBe('+254700000000');
    expect(saved?.source).toBe('STOREFRONT');
    expect(saved?.items).toHaveLength(1);
    expect(saved?.history).toHaveLength(1);
    expect(saved?.history[0]?.toStatus).toBe('PLACED');
  });

  it('returns the first order when the same idempotency key is sent twice', async () => {
    const payload = body();
    const first = await request(app.getHttpServer())
      .post('/orders')
      .send(payload)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/orders')
      .send(payload)
      .expect(201);

    expect((second.body as OrderJson).orderNo).toBe(
      (first.body as OrderJson).orderNo,
    );
    const count = await prisma.order.count({
      where: { idempotencyKey: payload.idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it.each([
    ['a quantity that is not an offered bundle', { quantity: 5 }],
    ['a bundle that is switched off', { quantity: 3 }],
  ])('rejects %s', async (_label, line) => {
    await request(app.getHttpServer())
      .post('/orders')
      .send(body({ items: [{ productId, ...line }] }))
      .expect(400);
  });

  it('rejects an inactive product', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send(body({ items: [{ productId: hiddenProductId, quantity: 1 }] }))
      .expect(400);
  });

  it('rejects an unknown county', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send(body({ countyId: randomUUID() }))
      .expect(400);
  });

  it('rejects a bad phone without echoing it back', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(body({ customerPhone: '12345' }))
      .expect(400);
    expect(JSON.stringify(response.body)).not.toContain('12345');
  });

  it('rejects a missing idempotency key', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send(body({ idempotencyKey: undefined }))
      .expect(400);
  });
});
