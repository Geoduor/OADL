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

type Summary = {
  agents: {
    agentUserId: string;
    cashKes: number;
    mpesaKes: number;
    totalKes: number;
    payments: number;
  }[];
  totals: { totalKes: number };
};

describe('Payments summary (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 20000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  const orderIds: string[] = [];
  let countyId: string;
  let managerCookie: string;
  let managerId: string;
  let agentA: { userId: string; agentId: string; cookie: string };
  let agentB: { userId: string; agentId: string; cookie: string };
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
    return { userId: user.id, agentId: agent.id, cookie };
  }

  async function pay(
    agent: { agentId: string },
    method: 'CASH' | 'MPESA',
    amountKes: number,
    createdAt?: string,
  ) {
    counter += 1;
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-P-${base}-${counter}`,
        customerName: 'Test Customer',
        customerPhone: '+254700000000',
        countyId,
        location: 'Test location',
        totalKes: amountKes,
        status: 'DELIVERED',
      },
    });
    orderIds.push(order.id);
    await prisma.payment.create({
      data: {
        orderId: order.id,
        agentId: agent.agentId,
        method,
        amountKes,
        recordedByUserId: managerId,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });
  }

  const summary = (query: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .get('/manager/payments/summary')
      .query(query)
      .set('Cookie', managerCookie);

  const rowFor = (body: Summary, agent: { userId: string }) =>
    body.agents.find((row) => row.agentUserId === agent.userId);

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
        data: { name: `Payments Test County ${base}`, code: 960000 + base },
      })
    ).id;
    const manager = await makeUser('MANAGER');
    managerId = manager.user.id;
    managerCookie = manager.cookie;
    agentA = await makeAgent();
    agentB = await makeAgent();

    // Agent A: cash and M-Pesa on 10 Jan. The two timestamps straddle
    // Nairobi midnight: 20:30 UTC is 23:30 on 10 Jan, 21:30 UTC is 00:30 on
    // 11 Jan in Nairobi.
    await pay(agentA, 'CASH', 3999, '2026-01-10T20:30:00Z');
    await pay(agentA, 'MPESA', 5500, '2026-01-10T21:30:00Z');
    await pay(agentB, 'CASH', 1000, '2026-01-10T12:00:00Z');
  });

  afterAll(async () => {
    const agentIds = [agentA.agentId, agentB.agentId];
    const userIds = [managerId, agentA.userId, agentB.userId];
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.agentCounty.deleteMany({
      where: { agentId: { in: agentIds } },
    });
    await prisma.agent.deleteMany({ where: { id: { in: agentIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.county.delete({ where: { id: countyId } });
    await app.close();
  });

  it('is closed to anonymous visitors and agents', async () => {
    const http = app.getHttpServer();
    await request(http).get('/manager/payments/summary').expect(401);
    await request(http)
      .get('/manager/payments/summary')
      .set('Cookie', agentA.cookie)
      .expect(403);
  });

  it('totals each agent by method', async () => {
    const res = await summary().expect(200);
    const body = res.body as Summary;
    expect(rowFor(body, agentA)).toMatchObject({
      cashKes: 3999,
      mpesaKes: 5500,
      totalKes: 9499,
      payments: 2,
    });
    expect(rowFor(body, agentB)).toMatchObject({
      cashKes: 1000,
      mpesaKes: 0,
      totalKes: 1000,
      payments: 1,
    });
    expect(body.totals.totalKes).toBeGreaterThanOrEqual(10499);
  });

  it('filters by Nairobi calendar day, not UTC day', async () => {
    // 11 Jan in Nairobi holds only the M-Pesa payment (21:30 UTC on 10 Jan).
    const onTheEleventh = (
      await summary({ from: '2026-01-11', to: '2026-01-11' }).expect(200)
    ).body as Summary;
    expect(rowFor(onTheEleventh, agentA)).toMatchObject({
      cashKes: 0,
      mpesaKes: 5500,
      payments: 1,
    });
    expect(rowFor(onTheEleventh, agentB)).toBeUndefined();

    // 10 Jan in Nairobi holds the cash payment and agent B's.
    const onTheTenth = (
      await summary({ from: '2026-01-10', to: '2026-01-10' }).expect(200)
    ).body as Summary;
    expect(rowFor(onTheTenth, agentA)).toMatchObject({
      cashKes: 3999,
      mpesaKes: 0,
    });
    expect(rowFor(onTheTenth, agentB)?.totalKes).toBe(1000);
  });

  it('rejects bad dates', async () => {
    await summary({ from: 'yesterday' }).expect(400);
    await summary({ from: '2026-02-01', to: '2026-01-01' }).expect(400);
  });
});
