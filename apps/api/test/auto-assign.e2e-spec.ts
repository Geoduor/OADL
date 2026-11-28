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

type TestAgent = { cookie: string; userId: string; agentId: string };

// All data is fake. Every row is unique to this file and deleted in afterAll.
describe('Auto-assign (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 20000 + Math.floor(Math.random() * 40000);
  const stamp = Date.now();
  const phones: string[] = [];
  const countyIds: string[] = [];
  const orderIds: string[] = [];
  let productId: string;
  let managerCookie: string;
  let counter = 0;

  function cookieFrom(res: request.Response): string {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    const first = header?.[0];
    if (!first) throw new Error('No Set-Cookie header');
    return first.split(';')[0]!;
  }

  async function makeUser(role: 'AGENT' | 'MANAGER') {
    const phone = `+2547006${String(base + phones.length).padStart(5, '0')}`;
    phones.push(phone);
    const user = await prisma.user.create({
      data: {
        name: `Test ${role}`,
        phone,
        passwordHash: await hasher.hash(PASSWORD),
        role,
        status: 'ACTIVE',
      },
    });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password: PASSWORD })
      .expect(200);
    return { user, cookie: cookieFrom(res) };
  }

  async function makeCounty() {
    counter += 1;
    const county = await prisma.county.create({
      data: {
        name: `Auto County ${base}-${counter}`,
        code: 970000 + base + counter,
      },
    });
    countyIds.push(county.id);
    return county.id;
  }

  async function makeAgent(
    covers: string[],
    options: { active?: boolean; stock?: number; name?: string } = {},
  ): Promise<TestAgent> {
    const { user, cookie } = await makeUser('AGENT');
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        displayName: options.name ?? `Auto Agent ${phones.length}`,
        active: options.active ?? true,
        counties: { create: covers.map((countyId) => ({ countyId })) },
      },
    });
    if (options.stock) {
      await request(app.getHttpServer())
        .post('/manager/stock/issue')
        .set('Cookie', managerCookie)
        .send({ agentUserId: user.id, productId, quantity: options.stock })
        .expect(200);
    }
    return { cookie, userId: user.id, agentId: agent.id };
  }

  async function makeOrder(
    countyId: string,
    options: { status?: string; agent?: TestAgent; quantity?: number } = {},
  ) {
    counter += 1;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-A-${base}-${counter}`,
        customerName: 'Auto Customer Name',
        customerPhone: '+254700000222',
        countyId,
        location: 'Auto secret location',
        totalKes: 3999,
        status: (options.status ?? 'CONFIRMED') as 'CONFIRMED',
        assignedAgentId: options.agent?.agentId ?? null,
        items: {
          create: [
            {
              productId,
              quantity: options.quantity ?? 1,
              lineTotalKes: 3999,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  const autoAssign = (orderId: string, cookie = managerCookie) =>
    request(app.getHttpServer())
      .post(`/manager/orders/${orderId}/auto-assign`)
      .set('Cookie', cookie);

  beforeAll(async () => {
    assertLocalDatabase();
    hasher = new PasswordHasher({ logN: 10 });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PasswordHasher)
      .useValue(hasher)
      .overrideProvider(TurnstileService)
      .useValue({ verify: vi.fn().mockResolvedValue(undefined) })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    const product = await prisma.product.create({
      data: {
        name: 'TEST AUTO PRODUCT',
        slug: `test-auto-${stamp}`,
        prices: { create: [{ quantity: 1, priceKes: 100 }] },
      },
    });
    productId = product.id;
    managerCookie = (await makeUser('MANAGER')).cookie;
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
    await prisma.productPrice.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.county.deleteMany({ where: { id: { in: countyIds } } });
    await app.close();
  });

  it('is closed to anonymous visitors and to agents', async () => {
    const county = await makeCounty();
    const agent = await makeAgent([county], { stock: 5 });
    const order = await makeOrder(county);
    await request(app.getHttpServer())
      .post(`/manager/orders/${order}/auto-assign`)
      .expect(401);
    await autoAssign(order, agent.cookie).expect(403);
  });

  it('picks the agent with the fewest open orders in the county', async () => {
    const county = await makeCounty();
    const other = await makeCounty();
    const busy = await makeAgent([county], { stock: 10, name: 'Busy' });
    const free = await makeAgent([county], { stock: 10, name: 'Free' });
    await makeAgent([other], { stock: 10, name: 'Elsewhere' });
    await makeAgent([county], { name: 'No stock' });
    await makeOrder(county, { status: 'ASSIGNED', agent: busy });
    await makeOrder(county, { status: 'DISPATCHED', agent: busy });
    const order = await makeOrder(county, { quantity: 2 });

    const res = await autoAssign(order).expect(200);
    expect(res.body.status).toBe('ASSIGNED');
    expect(res.body.assignedAgent.userId).toBe(free.userId);
    const last = res.body.history.at(-1);
    expect(last.toStatus).toBe('ASSIGNED');
    expect(last.reason).toMatch(/Auto-assigned/);
  });

  it('skips a disabled agent', async () => {
    const county = await makeCounty();
    const off = await makeAgent([county], { stock: 10, active: false });
    const on = await makeAgent([county], { stock: 10 });
    await makeOrder(county, { status: 'ASSIGNED', agent: on });
    const order = await makeOrder(county);
    const res = await autoAssign(order).expect(200);
    expect(res.body.assignedAgent.userId).toBe(on.userId);
    expect(res.body.assignedAgent.userId).not.toBe(off.userId);
  });

  it('leaves the order unassigned when nobody covers the county', async () => {
    const county = await makeCounty();
    const order = await makeOrder(county);
    const res = await autoAssign(order).expect(409);
    expect(res.body).toMatchObject({
      code: 'NO_AGENT_AVAILABLE',
      reason: 'NO_COVERAGE',
    });
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order } });
    expect(row.status).toBe('CONFIRMED');
    expect(row.assignedAgentId).toBeNull();
  });

  it('says so when covering agents lack stock, counting stock already reserved', async () => {
    const county = await makeCounty();
    const agent = await makeAgent([county], { stock: 2 });
    await makeOrder(county, { status: 'ASSIGNED', agent, quantity: 2 });
    const order = await makeOrder(county, { quantity: 1 });
    const res = await autoAssign(order).expect(409);
    expect(res.body).toMatchObject({
      code: 'NO_AGENT_AVAILABLE',
      reason: 'NO_STOCK',
    });
  });

  it('only works on a confirmed order that has no agent yet', async () => {
    const county = await makeCounty();
    const agent = await makeAgent([county], { stock: 10 });
    const placed = await makeOrder(county, { status: 'PLACED' });
    const assigned = await makeOrder(county, {
      status: 'ASSIGNED',
      agent,
    });
    await autoAssign(placed).expect(409);
    await autoAssign(assigned).expect(409);
    await autoAssign('missing-order').expect(404);
  });
});
