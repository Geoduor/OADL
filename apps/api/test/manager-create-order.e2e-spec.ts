import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TurnstileService } from '../src/turnstile/turnstile.service.js';
import { assertLocalDatabase } from './support/local-database.js';

const PASSWORD = 'test-password-123';

type Created = {
  id: string;
  orderNo: string;
  status: string;
  source: string;
  totalKes: number;
  notes: string | null;
  items: { quantity: number; lineTotalKes: number }[];
  history: {
    toStatus: string;
    reason: string | null;
    changedBy: { role: string } | null;
  }[];
};

describe('Manager creates an order (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 40000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  let countyId: string;
  let productId: string;
  let inactiveProductId: string;
  let managerCookie: string;
  let agentCookie: string;
  let agentUserId: string;
  const createdIds: string[] = [];

  const newPhone = () => {
    const value = `+2547005${String(base + phones.length).padStart(5, '0')}`;
    phones.push(value);
    return value;
  };

  function cookieFrom(res: request.Response): string {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    const first = header?.[0];
    if (!first) {
      throw new Error('No Set-Cookie header');
    }
    return first.split(';')[0]!;
  }

  async function makeUser(role: 'AGENT' | 'MANAGER') {
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        phone: newPhone(),
        passwordHash: await hasher.hash(PASSWORD),
        role,
        status: 'ACTIVE',
      },
    });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: user.phone, password: PASSWORD })
      .expect(200);
    return { user, cookie: cookieFrom(res) };
  }

  const body = (overrides: object = {}) => ({
    idempotencyKey: randomUUID(),
    customerName: 'Test Customer',
    customerPhone: '0712345678',
    countyId,
    location: 'Test location',
    items: [{ productId, quantity: 2 }],
    ...overrides,
  });

  const create = (payload: object, cookie = managerCookie) =>
    request(app.getHttpServer())
      .post('/manager/orders')
      .set('Cookie', cookie)
      .send(payload);

  async function created(payload: object): Promise<Created> {
    const res = await create(payload).expect(201);
    const order = res.body as Created;
    createdIds.push(order.id);
    return order;
  }

  beforeAll(async () => {
    assertLocalDatabase();
    hasher = new PasswordHasher({ logN: 10 });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PasswordHasher)
      .useValue(hasher)
      .overrideProvider(TurnstileService)
      .useValue({ verify: vi.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);

    countyId = (
      await prisma.county.create({
        data: { name: `Manager Create County ${base}`, code: 980000 + base },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          name: `Manager Create Product ${base}`,
          slug: `manager-create-${base}`,
          prices: {
            create: [
              { quantity: 1, priceKes: 3999 },
              { quantity: 2, priceKes: 5500 },
            ],
          },
        },
      })
    ).id;
    inactiveProductId = (
      await prisma.product.create({
        data: {
          name: `Manager Create Inactive ${base}`,
          slug: `manager-create-inactive-${base}`,
          active: false,
          prices: { create: [{ quantity: 1, priceKes: 1000 }] },
        },
      })
    ).id;

    managerCookie = (await makeUser('MANAGER')).cookie;
    const agent = await makeUser('AGENT');
    agentCookie = agent.cookie;
    agentUserId = agent.user.id;
    await prisma.agent.create({
      data: { userId: agentUserId, displayName: 'Test Agent' },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    const agents = await prisma.agent.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const agentIds = agents.map((agent) => agent.id);
    await prisma.stockMovement.deleteMany({
      where: { agentId: { in: agentIds } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: createdIds } },
    });
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: createdIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.agent.deleteMany({ where: { id: { in: agentIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.county.delete({ where: { id: countyId } });
    await prisma.productPrice.deleteMany({
      where: { productId: { in: [productId, inactiveProductId] } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [productId, inactiveProductId] } },
    });
    await app.close();
  });

  it('is closed to anonymous visitors and to agents', async () => {
    await request(app.getHttpServer())
      .post('/manager/orders')
      .send(body())
      .expect(401);
    await create(body(), agentCookie).expect(403);
  });

  it('creates a CONFIRMED manager order priced from the bundles', async () => {
    const order = await created(body({ notes: 'Called on WhatsApp' }));
    expect(order).toMatchObject({
      status: 'CONFIRMED',
      source: 'MANAGER_CREATED',
      totalKes: 5500,
      notes: 'Called on WhatsApp',
    });
    expect(order.items).toEqual([
      expect.objectContaining({ quantity: 2, lineTotalKes: 5500 }),
    ]);
    expect(order.history).toHaveLength(1);
    expect(order.history[0]).toMatchObject({
      toStatus: 'CONFIRMED',
      reason: 'Created by manager',
      changedBy: { role: 'MANAGER' },
    });
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(row.customerPhone).toBe('+254712345678');
  });

  it('can be assigned straight away, with no confirm step', async () => {
    const order = await created(body());
    const res = await request(app.getHttpServer())
      .post(`/manager/orders/${order.id}/status`)
      .set('Cookie', managerCookie)
      .send({ to: 'ASSIGNED', agentUserId, overrideStock: true })
      .expect(200);
    expect((res.body as Created).status).toBe('ASSIGNED');
  });

  it('does not trust client prices or status', async () => {
    const order = await created(
      body({
        status: 'DELIVERED',
        source: 'STOREFRONT',
        items: [{ productId, quantity: 1, lineTotalKes: 1 }],
      }),
    );
    expect(order).toMatchObject({
      status: 'CONFIRMED',
      source: 'MANAGER_CREATED',
      totalKes: 3999,
    });
  });

  it('rejects bad customers, counties, bundles and products', async () => {
    await create(body({ customerPhone: '12345' })).expect(400);
    await create(body({ customerName: 'A' })).expect(400);
    await create(body({ countyId: randomUUID() })).expect(400);
    await create(body({ items: [{ productId, quantity: 3 }] })).expect(400); // not a bundle
    await create(
      body({ items: [{ productId: inactiveProductId, quantity: 1 }] }),
    ).expect(400);
    await create(body({ items: [] })).expect(400);
    await create(body({ idempotencyKey: 'not-a-uuid' })).expect(400);
  });

  it('lets the manager set the total, but only with a reason that is kept', async () => {
    await create(body({ totalKes: 5000 })).expect(400);
    await create(body({ totalKes: 0, reason: 'free' })).expect(400);
    const order = await created(
      body({ totalKes: 5000, reason: 'Regular customer discount' }),
    );
    expect(order.totalKes).toBe(5000);
    // The item keeps the bundle price, so the difference stays visible.
    expect(order.items[0]?.lineTotalKes).toBe(5500);
    expect(order.history[0]?.reason).toBe(
      'Created by manager. Total set to KES 5000 instead of 5500: Regular customer discount',
    );
  });

  it('needs no reason when the given total equals the bundle price', async () => {
    const order = await created(body({ totalKes: 5500 }));
    expect(order.totalKes).toBe(5500);
    expect(order.history[0]?.reason).toBe('Created by manager');
  });

  it('returns the first order when the same key is sent twice', async () => {
    const payload = body();
    const first = await created(payload);
    const second = await create({
      ...payload,
      customerName: 'Someone Else',
    }).expect(201);
    expect((second.body as Created).id).toBe(first.id);
    expect(
      await prisma.order.count({
        where: { idempotencyKey: payload.idempotencyKey },
      }),
    ).toBe(1);
  });
});
