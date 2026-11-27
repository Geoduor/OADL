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

type NotificationJson = {
  id: string;
  type: string;
  title: string;
  body: string;
  orderId: string | null;
  readAt: string | null;
  createdAt: string;
};

// All data is fake. Rows are unique to this file and deleted in afterAll
// (notifications go with their users and orders).
describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 20000 + Math.floor(Math.random() * 40000);
  const stamp = Date.now();
  const phones: string[] = [];
  const orderIds: string[] = [];
  let countyId: string;
  let countyName: string;
  let productId: string;
  let manager: { cookie: string; userId: string };
  let a: { cookie: string; userId: string };
  let b: { cookie: string; userId: string };
  let counter = 0;

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

  async function makeUser(role: 'AGENT' | 'MANAGER') {
    const user = await prisma.user.create({
      data: {
        name: `Test ${role} ${phones.length}`,
        phone: newPhone(),
        passwordHash: await hasher.hash(PASSWORD),
        role,
        status: 'ACTIVE',
      },
    });
    if (role === 'AGENT') {
      await prisma.agent.create({
        data: {
          userId: user.id,
          displayName: 'Test Agent',
          counties: { create: [{ countyId }] },
        },
      });
    }
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: user.phone, password: PASSWORD })
      .expect(200);
    return { cookie: cookieFrom(res), userId: user.id };
  }

  async function makeOrder(status: string, agentUserId: string | null) {
    counter += 1;
    const agent = agentUserId
      ? await prisma.agent.findUniqueOrThrow({
          where: { userId: agentUserId },
          select: { id: true },
        })
      : null;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-N-${base}-${counter}`,
        customerName: 'Notify Customer Name',
        customerPhone: '+254700000111',
        countyId,
        location: 'Notify secret location',
        totalKes: 3999,
        status: status as 'CONFIRMED',
        assignedAgentId: agent?.id ?? null,
      },
    });
    orderIds.push(order.id);
    return order;
  }

  const managerMove = (id: string, body: object) =>
    request(app.getHttpServer())
      .post(`/manager/orders/${id}/status`)
      .set('Cookie', manager.cookie)
      .send(body);

  const agentMove = (id: string, body: object, cookie: string) =>
    request(app.getHttpServer())
      .post(`/agent/orders/${id}/status`)
      .set('Cookie', cookie)
      .send(body);

  async function inbox(user: { cookie: string }) {
    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', user.cookie)
      .expect(200);
    return res.body as NotificationJson[];
  }

  const forOrder = (list: NotificationJson[], orderId: string) =>
    list.filter((n) => n.orderId === orderId);

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

    countyName = `Notify County ${base}`;
    const county = await prisma.county.create({
      data: { name: countyName, code: 960000 + base },
    });
    countyId = county.id;
    const product = await prisma.product.create({
      data: {
        name: 'TEST NOTIFY PRODUCT',
        slug: `test-notify-${stamp}`,
        prices: { create: [{ quantity: 1, priceKes: 100 }] },
      },
    });
    productId = product.id;
    manager = await makeUser('MANAGER');
    a = await makeUser('AGENT');
    b = await makeUser('AGENT');
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    const orders = await prisma.order.findMany({
      where: { countyId },
      select: { id: true },
    });
    const allOrderIds = orders.map((order) => order.id);
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: allOrderIds } },
    });
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: allOrderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: allOrderIds } } });
    await prisma.agentCounty.deleteMany({
      where: { agent: { userId: { in: ids } } },
    });
    await prisma.agent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.productPrice.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.county.delete({ where: { id: countyId } });
    await app.close();
  });

  it('needs a signed-in user', async () => {
    const http = app.getHttpServer();
    await request(http).get('/notifications').expect(401);
    await request(http).get('/notifications/unread-count').expect(401);
    await request(http).post('/notifications/read-all').expect(401);
  });

  it('tells the managers about a new storefront order', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({
        idempotencyKey: randomUUID(),
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        customerName: 'Storefront Customer Name',
        customerPhone: '0700 000 222',
        countyId,
        location: 'Storefront secret location',
        items: [{ productId, quantity: 1 }],
      })
      .expect(201);
    const orderNo = (res.body as { orderNo: string }).orderNo;
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNo } });

    const mine = forOrder(await inbox(manager), order.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.type).toBe('ORDER_PLACED');
    expect(mine[0]?.body).toBe(`${orderNo} from ${countyName}`);
    // Never the customer's details.
    expect(JSON.stringify(mine)).not.toContain('Storefront');
    expect(JSON.stringify(mine)).not.toContain('0700');
    // Agents are not told about unassigned orders.
    expect(forOrder(await inbox(a), order.id)).toHaveLength(0);
  });

  it('does not notify twice when a storefront order is submitted again', async () => {
    const payload = {
      idempotencyKey: randomUUID(),
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      customerName: 'Repeat Customer',
      customerPhone: '0700 000 333',
      countyId,
      location: 'Repeat location',
      items: [{ productId, quantity: 1 }],
    };
    const http = app.getHttpServer();
    const first = await request(http).post('/orders').send(payload).expect(201);
    await request(http).post('/orders').send(payload).expect(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { orderNo: (first.body as { orderNo: string }).orderNo },
    });
    expect(forOrder(await inbox(manager), order.id)).toHaveLength(1);
  });

  it('tells an agent when an order is assigned to them, and only them', async () => {
    const order = await makeOrder('CONFIRMED', null);
    await managerMove(order.id, {
      to: 'ASSIGNED',
      agentUserId: a.userId,
    }).expect(200);

    const mine = forOrder(await inbox(a), order.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.type).toBe('ORDER_ASSIGNED');
    expect(mine[0]?.body).toBe(`${order.orderNo} in ${countyName}`);
    expect(JSON.stringify(mine)).not.toContain('Notify Customer');
    expect(JSON.stringify(mine)).not.toContain('secret location');
    expect(Object.keys(mine[0] ?? {}).sort()).toEqual(
      ['body', 'createdAt', 'id', 'orderId', 'readAt', 'title', 'type'].sort(),
    );
    expect(forOrder(await inbox(b), order.id)).toHaveLength(0);
  });

  it('tells both agents when a manager moves an order between them', async () => {
    const order = await makeOrder('ASSIGNED', a.userId);
    await managerMove(order.id, {
      to: 'ASSIGNED',
      agentUserId: b.userId,
    }).expect(200);

    expect(forOrder(await inbox(b), order.id).map((n) => n.type)).toEqual([
      'ORDER_ASSIGNED',
    ]);
    expect(forOrder(await inbox(a), order.id).map((n) => n.type)).toEqual([
      'ORDER_RELEASED',
    ]);
  });

  it('tells the managers when an agent moves an order on', async () => {
    const order = await makeOrder('ASSIGNED', a.userId);
    await agentMove(order.id, { to: 'DISPATCHED' }, a.cookie).expect(200);

    const mine = forOrder(await inbox(manager), order.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.type).toBe('ORDER_STATUS_CHANGED');
    expect(mine[0]?.title).toBe('Order dispatched');
    // The agent is not notified about their own action.
    expect(forOrder(await inbox(a), order.id)).toHaveLength(0);
  });

  it('keeps the same agent informed when the manager reschedules, not released', async () => {
    const order = await makeOrder('ASSIGNED', a.userId);
    await managerMove(order.id, {
      to: 'RESCHEDULED',
      scheduledDate: '2099-01-01',
    }).expect(200);

    const mine = forOrder(await inbox(a), order.id);
    expect(mine.map((n) => n.type)).toEqual(['ORDER_STATUS_CHANGED']);
    expect(mine[0]?.title).toBe('Order rescheduled');
  });

  it('tells the agent when the manager cancels their order', async () => {
    const order = await makeOrder('ASSIGNED', a.userId);
    await managerMove(order.id, {
      to: 'CANCELLED',
      reason: 'Customer changed their mind',
    }).expect(200);

    const mine = forOrder(await inbox(a), order.id);
    expect(mine.map((n) => n.type)).toEqual(['ORDER_RELEASED']);
    expect(mine[0]?.title).toBe('Order cancelled');
  });

  it('writes no notification when the change is refused', async () => {
    const order = await makeOrder('DELIVERED', a.userId);
    await managerMove(order.id, {
      to: 'ASSIGNED',
      agentUserId: b.userId,
    }).expect(409);
    expect(forOrder(await inbox(b), order.id)).toHaveLength(0);
  });

  it('counts, marks read and filters unread', async () => {
    const order = await makeOrder('CONFIRMED', null);
    const http = app.getHttpServer();
    const before = await request(http)
      .get('/notifications/unread-count')
      .set('Cookie', b.cookie)
      .expect(200);
    await managerMove(order.id, {
      to: 'ASSIGNED',
      agentUserId: b.userId,
    }).expect(200);
    const after = await request(http)
      .get('/notifications/unread-count')
      .set('Cookie', b.cookie)
      .expect(200);
    expect((after.body as { count: number }).count).toBe(
      (before.body as { count: number }).count + 1,
    );

    const target = forOrder(await inbox(b), order.id)[0]!;
    // Someone else's notification looks like a missing one.
    await request(http)
      .post(`/notifications/${target.id}/read`)
      .set('Cookie', a.cookie)
      .expect(404);

    const read = await request(http)
      .post(`/notifications/${target.id}/read`)
      .set('Cookie', b.cookie)
      .expect(200);
    expect((read.body as NotificationJson).readAt).not.toBeNull();
    // Reading twice is harmless.
    await request(http)
      .post(`/notifications/${target.id}/read`)
      .set('Cookie', b.cookie)
      .expect(200);

    const unread = await request(http)
      .get('/notifications?unread=true')
      .set('Cookie', b.cookie)
      .expect(200);
    expect((unread.body as NotificationJson[]).map((n) => n.id)).not.toContain(
      target.id,
    );

    const all = await request(http)
      .post('/notifications/read-all')
      .set('Cookie', b.cookie)
      .expect(200);
    expect(typeof (all.body as { updated: number }).updated).toBe('number');
    const none = await request(http)
      .get('/notifications/unread-count')
      .set('Cookie', b.cookie)
      .expect(200);
    expect((none.body as { count: number }).count).toBe(0);
  });

  it('limits the list size', async () => {
    const http = app.getHttpServer();
    await request(http)
      .get('/notifications?limit=0')
      .set('Cookie', b.cookie)
      .expect(400);
    await request(http)
      .get('/notifications?limit=101')
      .set('Cookie', b.cookie)
      .expect(400);
    const res = await request(http)
      .get('/notifications?limit=1')
      .set('Cookie', manager.cookie)
      .expect(200);
    expect((res.body as unknown[]).length).toBeLessThanOrEqual(1);
  });
});
