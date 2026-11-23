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

type OrderBody = {
  status: string;
  attemptCount: number;
  assignedAgent: { userId: string } | null;
  history: {
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
  }[];
};

describe('Manager orders and status changes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 10000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  const orderIds: string[] = [];
  let countyId: string;
  let managerCookie: string;
  let agentCookie: string;
  let agentA: { userId: string; agentId: string };
  let agentB: { userId: string; agentId: string };
  let inactiveAgentUserId: string;
  let counter = 0;

  const newPhone = () => {
    const value = `+2547002${String(base + phones.length).padStart(5, '0')}`;
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

  async function makeAgent(active = true) {
    const user = await makeUser('AGENT');
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        displayName: 'Test Agent',
        active,
        counties: { create: [{ countyId }] },
      },
    });
    return { userId: user.id, agentId: agent.id, phone: user.phone };
  }

  async function signIn(phone: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password: PASSWORD })
      .expect(200);
    return cookieFrom(res);
  }

  async function makeOrder(status = 'PLACED', agentId?: string) {
    counter += 1;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${base}-${counter}`,
        customerName: 'Test Customer',
        customerPhone: '+254700000000',
        countyId,
        location: 'Test location',
        totalKes: 3999,
        status: status as 'PLACED',
        assignedAgentId: agentId ?? null,
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  const move = (id: string, body: object, cookie = managerCookie) =>
    request(app.getHttpServer())
      .post(`/manager/orders/${id}/status`)
      .set('Cookie', cookie)
      .send(body);

  const get = (id: string) =>
    request(app.getHttpServer())
      .get(`/manager/orders/${id}`)
      .set('Cookie', managerCookie)
      .expect(200)
      .then((res) => res.body as OrderBody);

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
      data: { name: `Status Test County ${base}`, code: 900000 + base },
    });
    countyId = county.id;
    const manager = await makeUser('MANAGER');
    managerCookie = await signIn(manager.phone);
    const a = await makeAgent();
    const b = await makeAgent();
    const inactive = await makeAgent(false);
    agentA = a;
    agentB = b;
    inactiveAgentUserId = inactive.userId;
    agentCookie = await signIn(a.phone);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
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
    await prisma.county.delete({ where: { id: countyId } });
    await app.close();
  });

  it('is closed to anonymous visitors and to agents', async () => {
    const id = await makeOrder();
    const http = app.getHttpServer();
    await request(http).get('/manager/orders').expect(401);
    await request(http)
      .get('/manager/orders')
      .set('Cookie', agentCookie)
      .expect(403);
    await request(http)
      .get(`/manager/orders/${id}`)
      .set('Cookie', agentCookie)
      .expect(403);
    await move(id, { to: 'CONFIRMED' }, agentCookie).expect(403);
  });

  it('lists with filters and shows detail with history', async () => {
    const id = await makeOrder();
    const list = await request(app.getHttpServer())
      .get('/manager/orders')
      .query({ status: 'PLACED', countyId, limit: 100 })
      .set('Cookie', managerCookie)
      .expect(200);
    const body = list.body as { total: number; orders: { id: string }[] };
    expect(body.orders.some((o) => o.id === id)).toBe(true);
    await request(app.getHttpServer())
      .get('/manager/orders')
      .query({ status: 'NOT_A_STATUS' })
      .set('Cookie', managerCookie)
      .expect(400);
    await request(app.getHttpServer())
      .get('/manager/orders/not-an-order')
      .set('Cookie', managerCookie)
      .expect(404);
  });

  it('runs the happy path to ASSIGNED and records each step', async () => {
    const id = await makeOrder();
    await move(id, { to: 'CONFIRMED' }).expect(200);
    await move(id, { to: 'ASSIGNED' }).expect(400); // agent required
    const done = await move(id, {
      to: 'ASSIGNED',
      agentUserId: agentA.userId,
    }).expect(200);
    const order = done.body as OrderBody;
    expect(order.status).toBe('ASSIGNED');
    expect(order.assignedAgent?.userId).toBe(agentA.userId);
    expect(order.history.map((h) => h.toStatus)).toEqual([
      'CONFIRMED',
      'ASSIGNED',
    ]);
  });

  it('rejects moves that are not in the lifecycle', async () => {
    const id = await makeOrder();
    await move(id, { to: 'ASSIGNED', agentUserId: agentA.userId }).expect(409); // not confirmed yet
    await move(id, { to: 'DISPATCHED' }).expect(409); // no such move from PLACED
    const order = await get(id);
    expect(order.status).toBe('PLACED');
    expect(order.history).toHaveLength(0);
  });

  it('keeps agent-only moves away from the manager', async () => {
    const id = await makeOrder('ASSIGNED', agentA.agentId);
    await move(id, { to: 'DISPATCHED' }).expect(403);
    expect((await get(id)).status).toBe('ASSIGNED');
  });

  it('refuses an inactive or unknown agent', async () => {
    const id = await makeOrder('CONFIRMED');
    await move(id, { to: 'ASSIGNED', agentUserId: inactiveAgentUserId }).expect(
      400,
    );
    await move(id, { to: 'ASSIGNED', agentUserId: 'nobody' }).expect(400);
    expect((await get(id)).status).toBe('CONFIRMED');
  });

  it('PLACED to UNRESPONSIVE counts an attempt; D32 retry returns it to the queue', async () => {
    const id = await makeOrder();
    await move(id, { to: 'UNRESPONSIVE' }).expect(200);
    expect((await get(id)).attemptCount).toBe(1);
    await move(id, { to: 'CONFIRMED' }).expect(200);
    expect((await get(id)).status).toBe('CONFIRMED');

    const id2 = await makeOrder();
    await move(id2, { to: 'UNRESPONSIVE' }).expect(200);
    await move(id2, { to: 'PLACED' }).expect(200);
    expect((await get(id2)).status).toBe('PLACED');
  });

  it('D32: retrying an unresponsive order that had an agent releases the agent', async () => {
    const id = await makeOrder('UNRESPONSIVE', agentA.agentId);
    const res = await move(id, { to: 'CONFIRMED' }).expect(200);
    expect((res.body as OrderBody).assignedAgent).toBeNull();
  });

  it('D33: reassigns before dispatch, never to the same agent, never after dispatch', async () => {
    const id = await makeOrder('ASSIGNED', agentA.agentId);
    await move(id, { to: 'ASSIGNED', agentUserId: agentA.userId }).expect(400);
    const res = await move(id, {
      to: 'ASSIGNED',
      agentUserId: agentB.userId,
    }).expect(200);
    expect((res.body as OrderBody).assignedAgent?.userId).toBe(agentB.userId);

    const dispatched = await makeOrder('DISPATCHED', agentA.agentId);
    await move(dispatched, {
      to: 'ASSIGNED',
      agentUserId: agentB.userId,
    }).expect(409);

    const rescheduled = await makeOrder('RESCHEDULED', agentA.agentId);
    await move(rescheduled, {
      to: 'ASSIGNED',
      agentUserId: agentB.userId,
    }).expect(200);

    // The previous agent may get the order back after a reschedule (D33).
    const again = await makeOrder('RESCHEDULED', agentA.agentId);
    const back = await move(again, {
      to: 'ASSIGNED',
      agentUserId: agentA.userId,
    }).expect(200);
    expect((back.body as OrderBody).assignedAgent?.userId).toBe(agentA.userId);
  });

  it('needs a reason to cancel and a future date to reschedule', async () => {
    const id = await makeOrder('ASSIGNED', agentA.agentId);
    await move(id, { to: 'CANCELLED' }).expect(400);
    await move(id, { to: 'RESCHEDULED' }).expect(400);
    await move(id, { to: 'RESCHEDULED', scheduledDate: '2020-01-01' }).expect(
      400,
    );
    await move(id, { to: 'RESCHEDULED', scheduledDate: '2999-01-01' }).expect(
      200,
    );
    const cancelled = await move(id, {
      to: 'CANCELLED',
      reason: 'Customer changed mind',
    }).expect(200);
    expect((cancelled.body as OrderBody).history.at(-1)?.reason).toBe(
      'Customer changed mind',
    );
  });

  it('keeps final statuses final', async () => {
    const id = await makeOrder('CANCELLED');
    await move(id, { to: 'PLACED' }).expect(409);
    await move(id, { to: 'CANCELLED', reason: 'again' }).expect(409);
  });

  it('lets only one of two simultaneous changes win', async () => {
    const id = await makeOrder('PLACED');
    const results = await Promise.all([
      move(id, { to: 'CONFIRMED' }),
      move(id, { to: 'CONFIRMED' }),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    expect((await get(id)).history).toHaveLength(1);
  });
});
