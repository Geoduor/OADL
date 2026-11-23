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

type AgentOrder = {
  id: string;
  status: string;
  attemptCount: number;
  customerName: string;
};

describe('Agent orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 20000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  const orderIds: string[] = [];
  let countyId: string;
  let managerCookie: string;
  let a: { cookie: string; agentId: string; userId: string };
  let b: { cookie: string; agentId: string; userId: string };
  let counter = 0;

  const newPhone = () => {
    const value = `+2547003${String(base + phones.length).padStart(5, '0')}`;
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

  async function makeAgent() {
    const user = await makeUser('AGENT');
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        displayName: 'Test Agent',
        counties: { create: [{ countyId }] },
      },
    });
    return {
      cookie: await signIn(user.phone),
      agentId: agent.id,
      userId: user.id,
    };
  }

  async function makeOrder(status: string, agentId: string | null) {
    counter += 1;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-A-${base}-${counter}`,
        customerName: `Customer ${counter}`,
        customerPhone: '+254700000000',
        countyId,
        location: 'Test location',
        totalKes: 3999,
        status: status as 'ASSIGNED',
        assignedAgentId: agentId,
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  const agentMove = (id: string, body: object, cookie: string) =>
    request(app.getHttpServer())
      .post(`/agent/orders/${id}/status`)
      .set('Cookie', cookie)
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

    const county = await prisma.county.create({
      data: { name: `Agent Orders County ${base}`, code: 950000 + base },
    });
    countyId = county.id;
    const manager = await makeUser('MANAGER');
    managerCookie = await signIn(manager.phone);
    a = await makeAgent();
    b = await makeAgent();
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

  it('needs a signed-in agent', async () => {
    const http = app.getHttpServer();
    await request(http).get('/agent/orders').expect(401);
    await request(http)
      .get('/agent/orders')
      .set('Cookie', managerCookie)
      .expect(403);
  });

  it('shows an agent only their own open orders', async () => {
    const mine = await makeOrder('ASSIGNED', a.agentId);
    const theirs = await makeOrder('ASSIGNED', b.agentId);
    const delivered = await makeOrder('DELIVERED', a.agentId);
    const cancelled = await makeOrder('CANCELLED', a.agentId);
    const unassigned = await makeOrder('CONFIRMED', null);

    const list = await request(app.getHttpServer())
      .get('/agent/orders')
      .set('Cookie', a.cookie)
      .expect(200);
    const ids = (list.body as AgentOrder[]).map((o) => o.id);
    expect(ids).toContain(mine);
    for (const hidden of [theirs, delivered, cancelled, unassigned]) {
      expect(ids).not.toContain(hidden);
    }
    // Only the fields an agent needs.
    const row = (list.body as Record<string, unknown>[]).find(
      (o) => o['id'] === mine,
    );
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        'attemptCount',
        'county',
        'createdAt',
        'customerName',
        'customerPhone',
        'id',
        'items',
        'location',
        'orderNo',
        'scheduledDate',
        'status',
        'totalKes',
      ].sort(),
    );

    await request(app.getHttpServer())
      .get(`/agent/orders/${mine}`)
      .set('Cookie', a.cookie)
      .expect(200);
    for (const hidden of [theirs, delivered, cancelled, unassigned]) {
      await request(app.getHttpServer())
        .get(`/agent/orders/${hidden}`)
        .set('Cookie', a.cookie)
        .expect(404);
    }
  });

  it('lets the assigned agent dispatch, and records who did it', async () => {
    const id = await makeOrder('ASSIGNED', a.agentId);
    const res = await agentMove(id, { to: 'DISPATCHED' }, a.cookie).expect(200);
    expect((res.body as AgentOrder).status).toBe('DISPATCHED');
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.changedByUserId).toBe(a.userId);
    expect(history[0]?.agentId).toBe(a.agentId);
  });

  it("keeps one agent away from another agent's order", async () => {
    const id = await makeOrder('ASSIGNED', b.agentId);
    await agentMove(id, { to: 'DISPATCHED' }, a.cookie).expect(404);
    const order = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(order.status).toBe('ASSIGNED');
  });

  it('refuses moves that belong to the manager or are not built', async () => {
    const id = await makeOrder('ASSIGNED', a.agentId);
    const http = app.getHttpServer();
    for (const to of ['CANCELLED', 'CONFIRMED', 'ASSIGNED']) {
      await request(http)
        .post(`/agent/orders/${id}/status`)
        .set('Cookie', a.cookie)
        .send({ to, agentUserId: b.userId })
        .expect(400);
    }
    const order = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(order.status).toBe('ASSIGNED');
  });

  it('counts an attempt on UNRESPONSIVE and allows a retry dispatch', async () => {
    const id = await makeOrder('DISPATCHED', a.agentId);
    const res = await agentMove(id, { to: 'UNRESPONSIVE' }, a.cookie).expect(
      200,
    );
    expect((res.body as AgentOrder).attemptCount).toBe(1);
    await agentMove(id, { to: 'DISPATCHED' }, a.cookie).expect(200);
  });

  it('needs a future date to reschedule', async () => {
    const id = await makeOrder('DISPATCHED', a.agentId);
    await agentMove(id, { to: 'RESCHEDULED' }, a.cookie).expect(400);
    await agentMove(
      id,
      { to: 'RESCHEDULED', scheduledDate: '2020-01-01' },
      a.cookie,
    ).expect(400);
    await agentMove(
      id,
      { to: 'RESCHEDULED', scheduledDate: '2999-01-01' },
      a.cookie,
    ).expect(200);
  });

  it('loses access the moment the manager reassigns the order', async () => {
    const id = await makeOrder('ASSIGNED', a.agentId);
    await request(app.getHttpServer())
      .get(`/agent/orders/${id}`)
      .set('Cookie', a.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/manager/orders/${id}/status`)
      .set('Cookie', managerCookie)
      .send({ to: 'ASSIGNED', agentUserId: b.userId })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/agent/orders/${id}`)
      .set('Cookie', a.cookie)
      .expect(404);
    await agentMove(id, { to: 'DISPATCHED' }, a.cookie).expect(404);
    await request(app.getHttpServer())
      .get(`/agent/orders/${id}`)
      .set('Cookie', b.cookie)
      .expect(200);
  });

  describe('Delivered with payment (D34)', () => {
    const deliver = (id: string, body: object, cookie = a.cookie) =>
      agentMove(id, { to: 'DELIVERED', ...body }, cookie);

    it('records cash, sets deliveredAt, and hides the order from the agent', async () => {
      const id = await makeOrder('DISPATCHED', a.agentId);
      const res = await deliver(id, {
        paymentMethod: 'CASH',
        amountKes: 3999,
      }).expect(200);
      expect(res.body).toEqual({ id, status: 'DELIVERED' });

      const order = await prisma.order.findUniqueOrThrow({
        where: { id },
        include: { payments: true },
      });
      expect(order.status).toBe('DELIVERED');
      expect(order.deliveredAt).not.toBeNull();
      expect(order.payments).toHaveLength(1);
      expect(order.payments[0]).toMatchObject({
        method: 'CASH',
        amountKes: 3999,
        agentId: a.agentId,
        recordedByUserId: a.userId,
      });
      await request(app.getHttpServer())
        .get(`/agent/orders/${id}`)
        .set('Cookie', a.cookie)
        .expect(404);
    });

    it('needs both a method and an amount, and nothing changes without them', async () => {
      const id = await makeOrder('DISPATCHED', a.agentId);
      await deliver(id, {}).expect(400);
      await deliver(id, { paymentMethod: 'CASH' }).expect(400);
      await deliver(id, { amountKes: 3999 }).expect(400);
      await deliver(id, { paymentMethod: 'PAYBILL', amountKes: 3999 }).expect(
        400,
      );
      await deliver(id, { paymentMethod: 'CASH', amountKes: 0 }).expect(400);
      await deliver(id, { paymentMethod: 'CASH', amountKes: 39.5 }).expect(400);
      await deliver(id, { paymentMethod: 'CASH', amountKes: -5 }).expect(400);
      const order = await prisma.order.findUniqueOrThrow({
        where: { id },
        include: { payments: true },
      });
      expect(order.status).toBe('DISPATCHED');
      expect(order.payments).toHaveLength(0);
    });

    it('can only deliver a dispatched order, and only once', async () => {
      const assigned = await makeOrder('ASSIGNED', a.agentId);
      await deliver(assigned, {
        paymentMethod: 'CASH',
        amountKes: 3999,
      }).expect(409);

      const id = await makeOrder('DISPATCHED', a.agentId);
      const body = { paymentMethod: 'MPESA', amountKes: 3999 };
      const results = await Promise.all([deliver(id, body), deliver(id, body)]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        200, 409,
      ]);
      expect(await prisma.payment.count({ where: { orderId: id } })).toBe(1);
    });

    it('does not let another agent, or the manager, deliver the order', async () => {
      const id = await makeOrder('DISPATCHED', a.agentId);
      const body = { paymentMethod: 'CASH', amountKes: 3999 };
      await deliver(id, body, b.cookie).expect(404);
      await request(app.getHttpServer())
        .post(`/manager/orders/${id}/status`)
        .set('Cookie', managerCookie)
        .send({ to: 'DELIVERED', ...body })
        .expect(403);
      expect(await prisma.payment.count({ where: { orderId: id } })).toBe(0);
    });

    it('shows the manager who collected what, and flags a different amount', async () => {
      const exact = await makeOrder('DISPATCHED', a.agentId);
      const short = await makeOrder('DISPATCHED', a.agentId);
      await deliver(exact, { paymentMethod: 'MPESA', amountKes: 3999 }).expect(
        200,
      );
      await deliver(short, { paymentMethod: 'CASH', amountKes: 3500 }).expect(
        200,
      );

      const read = async (id: string) =>
        (
          await request(app.getHttpServer())
            .get(`/manager/orders/${id}`)
            .set('Cookie', managerCookie)
            .expect(200)
        ).body as {
          status: string;
          paidKes: number;
          paymentMismatch: boolean | null;
          payments: {
            method: string;
            amountKes: number;
            agent: { displayName: string };
          }[];
        };
      const e = await read(exact);
      expect(e).toMatchObject({
        status: 'DELIVERED',
        paidKes: 3999,
        paymentMismatch: false,
      });
      expect(e.payments[0]).toMatchObject({ method: 'MPESA', amountKes: 3999 });
      const sh = await read(short);
      expect(sh).toMatchObject({ paidKes: 3500, paymentMismatch: true });

      const open = await makeOrder('DISPATCHED', a.agentId);
      expect((await read(open)).paymentMismatch).toBeNull();
    });
  });
});
