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
const DAY_MS = 86_400_000;

type Overview = {
  deliveredToday: number;
  collectedTodayKes: number;
  open: Record<string, number>;
  completedToday: { done: number; of: number };
};
type History = {
  range: string;
  count: number;
  collectedKes: number;
  deliveries: Record<string, unknown>[];
};

// All data is fake. Rows are unique to this file and deleted in afterAll.
describe('Agent overview and history (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 20000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  const orderIds: string[] = [];
  let countyId: string;
  let productId: string;
  let managerCookie: string;
  let a: { cookie: string; agentId: string; userId: string };
  let b: { cookie: string; agentId: string; userId: string };
  let counter = 0;

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

  async function makeAgent() {
    const { user, cookie } = await makeUser('AGENT');
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        displayName: 'Test Agent',
        counties: { create: [{ countyId }] },
      },
    });
    return { cookie, agentId: agent.id, userId: user.id };
  }

  async function makeOrder(status: string, agentId: string | null) {
    counter += 1;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-O-${base}-${counter}`,
        customerName: 'Overview Customer Name',
        customerPhone: '+254700000444',
        countyId,
        location: 'Overview secret location',
        totalKes: 3999,
        status: status as 'ASSIGNED',
        assignedAgentId: agentId,
        items: {
          create: [
            {
              productId,
              quantity: 1,
              lineTotalKes: 3999,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  async function makePayment(
    agent: { agentId: string; userId: string },
    amountKes: number,
    daysAgo: number,
    method: 'CASH' | 'MPESA' = 'CASH',
  ) {
    const orderId = await makeOrder('DELIVERED', agent.agentId);
    await prisma.payment.create({
      data: {
        orderId,
        agentId: agent.agentId,
        method,
        amountKes,
        recordedByUserId: agent.userId,
        createdAt: new Date(Date.now() - daysAgo * DAY_MS),
      },
    });
  }

  const get = (path: string, cookie: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie);

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

    const county = await prisma.county.create({
      data: { name: `Overview County ${base}`, code: 970000 + base },
    });
    countyId = county.id;
    const product = await prisma.product.create({
      data: { name: 'TEST OVERVIEW PRODUCT', slug: `test-overview-${base}` },
    });
    productId = product.id;
    managerCookie = (await makeUser('MANAGER')).cookie;
    a = await makeAgent();
    b = await makeAgent();
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.agentCounty.deleteMany({
      where: { agent: { userId: { in: ids } } },
    });
    await prisma.agent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.county.delete({ where: { id: countyId } });
    await app.close();
  });

  it('is closed to anonymous visitors and to managers', async () => {
    for (const path of ['/agent/overview', '/agent/history']) {
      await request(app.getHttpServer()).get(path).expect(401);
      await get(path, managerCookie).expect(403);
    }
  });

  it("counts only the agent's own open and delivered work", async () => {
    await makeOrder('ASSIGNED', a.agentId);
    await makeOrder('ASSIGNED', a.agentId);
    await makeOrder('DISPATCHED', a.agentId);
    await makeOrder('ASSIGNED', b.agentId);
    await makeOrder('CANCELLED', a.agentId);
    await makePayment(a, 3999, 0);
    await makePayment(a, 5500, 0, 'MPESA');
    await makePayment(b, 7000, 0);
    await makePayment(a, 3999, 3); // not today

    const res = await get('/agent/overview', a.cookie).expect(200);
    const body = res.body as Overview;
    expect(body.deliveredToday).toBe(2);
    expect(body.collectedTodayKes).toBe(9499);
    expect(body.open).toEqual({
      total: 3,
      assigned: 2,
      dispatched: 1,
      rescheduled: 0,
      unresponsive: 0,
    });
    expect(body.completedToday).toEqual({ done: 2, of: 5 });

    const other = (await get('/agent/overview', b.cookie).expect(200))
      .body as Overview;
    expect(other.deliveredToday).toBe(1);
    expect(other.collectedTodayKes).toBe(7000);
  });

  it('lists history by range and shows no customer details', async () => {
    const week = (await get('/agent/history?range=week', a.cookie).expect(200))
      .body as History;
    expect(week.count).toBe(3);
    expect(week.collectedKes).toBe(13498);
    const today = (
      await get('/agent/history?range=today', a.cookie).expect(200)
    ).body as History;
    expect(today.count).toBe(2);
    expect(today.collectedKes).toBe(9499);
    const all = (await get('/agent/history?range=all', a.cookie).expect(200))
      .body as History;
    expect(all.count).toBe(3);

    const row = today.deliveries[0] ?? {};
    expect(Object.keys(row).sort()).toEqual(
      [
        'amountKes',
        'county',
        'deliveredAt',
        'id',
        'items',
        'method',
        'orderNo',
        'orderTotalKes',
      ].sort(),
    );
    expect(JSON.stringify(today)).not.toContain('Overview Customer Name');
    expect(JSON.stringify(today)).not.toContain('secret location');
    expect(JSON.stringify(today)).not.toContain('254700000444');
  });

  it("puts the newest delivery first and never shows another agent's", async () => {
    const all = (await get('/agent/history?range=all', a.cookie).expect(200))
      .body as History;
    const times = all.deliveries.map((d) => String(d['deliveredAt']));
    expect([...times].sort().reverse()).toEqual(times);
    const mine = (await get('/agent/history?range=all', b.cookie).expect(200))
      .body as History;
    expect(mine.count).toBe(1);
    expect(mine.collectedKes).toBe(7000);
  });

  it('defaults to the last week and rejects an unknown range', async () => {
    const res = await get('/agent/history', a.cookie).expect(200);
    expect((res.body as History).range).toBe('week');
    await get('/agent/history?range=year', a.cookie).expect(400);
  });
});
