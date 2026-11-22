import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabase } from './support/local-database.js';

// Schema-level test: orders, items and status history save and read back.
// All values are fake. Rows are unique to this file and deleted in afterAll.
describe('Order schema (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  const stamp = `${Date.now()}`;
  const orderNos = [`TEST-${stamp}-A`, `TEST-${stamp}-B`, `TEST-${stamp}-C`];
  let countyId: string;
  let productId: string;

  beforeAll(async () => {
    assertLocalDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);

    const county = await prisma.county.create({
      data: {
        name: `Test County ${stamp}`,
        code: 900000 + Math.floor(Math.random() * 90000),
      },
    });
    countyId = county.id;
    const product = await prisma.product.create({
      data: { name: 'TEST PRODUCT', slug: `test-order-product-${stamp}` },
    });
    productId = product.id;
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { orderNo: { in: orderNos } },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.county.delete({ where: { id: countyId } });
    await moduleRef.close();
  });

  it('saves an order with an item and a history row, then reads it back', async () => {
    const created = await prisma.order.create({
      data: {
        orderNo: orderNos[0]!,
        customerName: 'Test Customer',
        customerPhone: '+254700000000',
        countyId,
        location: 'Test estate, near the test stage',
        totalKes: 5500,
        items: {
          create: [{ productId, quantity: 2, lineTotalKes: 5500 }],
        },
        history: { create: [{ toStatus: 'PLACED' }] },
      },
    });

    const found = await prisma.order.findUnique({
      where: { id: created.id },
      include: { items: true, history: true, county: true },
    });
    expect(found?.status).toBe('PLACED');
    expect(found?.source).toBe('STOREFRONT');
    expect(found?.attemptCount).toBe(0);
    expect(found?.county.id).toBe(countyId);
    expect(found?.items).toHaveLength(1);
    expect(found?.items[0]?.lineTotalKes).toBe(5500);
    expect(found?.history).toHaveLength(1);
    expect(found?.history[0]?.fromStatus).toBeNull();
    expect(found?.history[0]?.toStatus).toBe('PLACED');
  });

  it('rejects a second order with the same idempotency key', async () => {
    const idempotencyKey = `test-key-${stamp}`;
    const data = {
      customerName: 'Test Customer',
      customerPhone: '+254700000000',
      countyId,
      location: 'Test estate',
      totalKes: 3999,
      idempotencyKey,
    };
    await prisma.order.create({ data: { ...data, orderNo: orderNos[2]! } });
    await expect(
      prisma.order.create({ data: { ...data, orderNo: orderNos[1]! } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
