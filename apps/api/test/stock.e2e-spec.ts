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

type Row = {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
  needsAttention: boolean;
};
type Overview = { agentUserId: string; products: Row[] }[];

describe('Agent stock (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 30000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  const orderIds: string[] = [];
  let countyId: string;
  let productId: string;
  let managerCookie: string;
  let counter = 0;

  type TestAgent = { cookie: string; agentId: string; userId: string };

  const newPhone = () => {
    const value = `+2547004${String(base + phones.length).padStart(5, '0')}`;
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

  async function signIn(phone: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password: PASSWORD })
      .expect(200);
    return cookieFrom(res);
  }

  async function makeUser(role: 'AGENT' | 'MANAGER') {
    return prisma.user.create({
      data: {
        name: 'Test User',
        phone: newPhone(),
        passwordHash: await hasher.hash(PASSWORD),
        role,
        status: 'ACTIVE',
      },
    });
  }

  async function makeAgent(active = true): Promise<TestAgent> {
    const user = await makeUser('AGENT');
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        displayName: 'Test Agent',
        active,
        counties: { create: [{ countyId }] },
      },
    });
    return {
      cookie: await signIn(user.phone),
      agentId: agent.id,
      userId: user.id,
    };
  }

  async function makeOrder(
    status: string,
    agent: TestAgent | null,
    quantity: number,
  ) {
    counter += 1;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-S-${base}-${counter}`,
        customerName: 'Test Customer',
        customerPhone: '+254700000000',
        countyId,
        location: 'Test location',
        totalKes: 3999,
        status: status as 'ASSIGNED',
        assignedAgentId: agent?.agentId ?? null,
        items: { create: [{ productId, quantity, lineTotalKes: 3999 }] },
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  const manager = (method: 'get' | 'post', path: string) =>
    request(app.getHttpServer())[method](path).set('Cookie', managerCookie);

  const issue = (agent: TestAgent, quantity: number) =>
    manager('post', '/manager/stock/issue').send({
      agentUserId: agent.userId,
      productId,
      quantity,
    });

  async function level(agent: TestAgent): Promise<Row | undefined> {
    const res = await manager('get', '/manager/stock')
      .query({ agentUserId: agent.userId })
      .expect(200);
    return (res.body as Overview)[0]?.products.find(
      (row) => row.productId === productId,
    );
  }

  const assign = (orderId: string, agent: TestAgent, body: object = {}) =>
    manager('post', `/manager/orders/${orderId}/status`).send({
      to: 'ASSIGNED',
      agentUserId: agent.userId,
      ...body,
    });

  const agentMove = (orderId: string, agent: TestAgent, body: object) =>
    request(app.getHttpServer())
      .post(`/agent/orders/${orderId}/status`)
      .set('Cookie', agent.cookie)
      .send(body);

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
        data: { name: `Stock Test County ${base}`, code: 970000 + base },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          name: `Stock Test Product ${base}`,
          slug: `stock-test-${base}`,
        },
      })
    ).id;
    const mgr = await makeUser('MANAGER');
    managerCookie = await signIn(mgr.phone);
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
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.agentCounty.deleteMany({
      where: { agentId: { in: agentIds } },
    });
    await prisma.agent.deleteMany({ where: { id: { in: agentIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.county.delete({ where: { id: countyId } });
    await prisma.product.delete({ where: { id: productId } });
    await app.close();
  });

  it('is closed to anonymous visitors and to the wrong role', async () => {
    const agent = await makeAgent();
    const http = app.getHttpServer();
    await request(http).get('/manager/stock').expect(401);
    await request(http)
      .get('/manager/stock')
      .set('Cookie', agent.cookie)
      .expect(403);
    await request(http)
      .post('/manager/stock/issue')
      .set('Cookie', agent.cookie)
      .send({ agentUserId: agent.userId, productId, quantity: 5 })
      .expect(403);
    await request(http).get('/agent/stock').expect(401);
    await request(http)
      .get('/agent/stock')
      .set('Cookie', managerCookie)
      .expect(403);
    expect(await level(agent)).toBeUndefined();
  });

  it('issues stock to an active agent and validates the request', async () => {
    const agent = await makeAgent();
    await issue(agent, 10).expect(200);
    expect(await level(agent)).toMatchObject({
      onHand: 10,
      reserved: 0,
      available: 10,
    });

    await issue(agent, 0).expect(400);
    await issue(agent, -3).expect(400);
    await issue(agent, 1.5).expect(400);
    await manager('post', '/manager/stock/issue')
      .send({ agentUserId: agent.userId, productId: 'nope', quantity: 1 })
      .expect(400);
    await manager('post', '/manager/stock/issue')
      .send({ agentUserId: 'nobody', productId, quantity: 1 })
      .expect(404);
    const inactive = await makeAgent(false);
    await issue(inactive, 1).expect(400);
    expect(await level(agent)).toMatchObject({ onHand: 10 });
  });

  it('records returns, but not more than is free', async () => {
    const agent = await makeAgent();
    await issue(agent, 10).expect(200);
    await makeOrder('ASSIGNED', agent, 6); // holds 6
    expect(await level(agent)).toMatchObject({
      onHand: 10,
      reserved: 6,
      available: 4,
    });

    const back = (quantity: number) =>
      manager('post', '/manager/stock/return').send({
        agentUserId: agent.userId,
        productId,
        quantity,
      });
    await back(5).expect(409); // only 4 free
    await back(4).expect(200);
    expect(await level(agent)).toMatchObject({
      onHand: 6,
      reserved: 6,
      available: 0,
    });
  });

  it('adjusts with a reason and never below zero', async () => {
    const agent = await makeAgent();
    await issue(agent, 5).expect(200);
    const adjust = (body: object) =>
      manager('post', '/manager/stock/adjust').send({
        agentUserId: agent.userId,
        productId,
        ...body,
      });
    await adjust({ quantity: -1 }).expect(400); // reason required
    await adjust({ quantity: 0, reason: 'x' }).expect(400);
    await adjust({ quantity: -6, reason: 'count' }).expect(409);
    await adjust({ quantity: -2, reason: 'damaged' }).expect(200);
    await adjust({ quantity: 1, reason: 'found one' }).expect(200);
    expect(await level(agent)).toMatchObject({ onHand: 4 });
  });

  it('shows an agent only their own stock', async () => {
    const a = await makeAgent();
    const b = await makeAgent();
    await issue(a, 7).expect(200);
    await issue(b, 2).expect(200);
    const mine = await request(app.getHttpServer())
      .get('/agent/stock')
      .set('Cookie', a.cookie)
      .expect(200);
    const rows = mine.body as Row[];
    expect(rows.find((r) => r.productId === productId)).toMatchObject({
      onHand: 7,
    });
    expect(JSON.stringify(mine.body)).not.toContain(b.userId);
  });

  it('warns when assigning beyond stock, and lets the manager override', async () => {
    const agent = await makeAgent();
    await issue(agent, 2).expect(200);
    const id = await makeOrder('CONFIRMED', null, 3);

    const warned = await assign(id, agent).expect(409);
    expect(warned.body).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      shortfalls: [{ needed: 3, available: 2 }],
    });
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('CONFIRMED');

    const done = await assign(id, agent, { overrideStock: true }).expect(200);
    expect(done.body).toMatchObject({ status: 'ASSIGNED' });
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: id },
    });
    expect(history[0]?.reason).toMatch(/override/i);
  });

  it('assigns freely when there is enough, counting other open orders', async () => {
    const agent = await makeAgent();
    await issue(agent, 5).expect(200);
    await makeOrder('ASSIGNED', agent, 3); // already holds 3
    const small = await makeOrder('CONFIRMED', null, 2);
    const big = await makeOrder('CONFIRMED', null, 3);
    await assign(big, agent).expect(409); // 5 - 3 = 2 free
    await assign(small, agent).expect(200);
  });

  it('does not count an order twice when re-giving it to the same agent', async () => {
    const agent = await makeAgent();
    await issue(agent, 3).expect(200);
    const id = await makeOrder('RESCHEDULED', agent, 3); // holds all 3
    await assign(id, agent).expect(200); // D33: same agent again
  });

  it('deducts stock on delivery and writes the ledger row', async () => {
    const agent = await makeAgent();
    await issue(agent, 5).expect(200);
    const id = await makeOrder('DISPATCHED', agent, 2);
    expect(await level(agent)).toMatchObject({
      onHand: 5,
      reserved: 2,
      available: 3,
    });

    await agentMove(id, agent, {
      to: 'DELIVERED',
      paymentMethod: 'CASH',
      amountKes: 3999,
    }).expect(200);

    expect(await level(agent)).toMatchObject({
      onHand: 3,
      reserved: 0,
      available: 3,
    });
    const rows = await prisma.stockMovement.findMany({
      where: { orderId: id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'DELIVERY',
      quantity: -2,
      agentId: agent.agentId,
      createdByUserId: agent.userId,
    });
  });

  it('never blocks a delivery for lack of recorded stock, but flags it', async () => {
    const agent = await makeAgent();
    const id = await makeOrder('DISPATCHED', agent, 2);
    await agentMove(id, agent, {
      to: 'DELIVERED',
      paymentMethod: 'MPESA',
      amountKes: 3999,
    }).expect(200);
    expect(await level(agent)).toMatchObject({
      onHand: -2,
      needsAttention: true,
    });
  });

  it('lists the movement history with who did it', async () => {
    const agent = await makeAgent();
    await issue(agent, 4).expect(200);
    await manager('post', '/manager/stock/adjust')
      .send({
        agentUserId: agent.userId,
        productId,
        quantity: -1,
        reason: 'damaged',
      })
      .expect(200);
    const res = await manager('get', '/manager/stock/movements')
      .query({ agentUserId: agent.userId, productId })
      .expect(200);
    const body = res.body as {
      total: number;
      movements: { type: string; quantity: number; note: string | null }[];
    };
    expect(body.total).toBe(2);
    expect(body.movements.map((m) => m.type).sort()).toEqual([
      'ADJUSTMENT',
      'ISSUE',
    ]);
    expect(body.movements.find((m) => m.type === 'ADJUSTMENT')).toMatchObject({
      quantity: -1,
      note: 'damaged',
    });
  });
});
