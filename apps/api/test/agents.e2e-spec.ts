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

describe('Agent approval (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = 50000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  const countyIds: string[] = [];
  let managerCookie: string;
  let agentCookie: string;

  const phone = (n: number) => {
    const value = `+2547001${String(base + n).padStart(5, '0')}`;
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

  async function makeUser(
    number: string,
    role: 'AGENT' | 'MANAGER',
    status: 'PENDING' | 'ACTIVE',
  ) {
    return prisma.user.create({
      data: {
        name: 'Test User',
        phone: number,
        passwordHash: await hasher.hash(PASSWORD),
        role,
        status,
      },
    });
  }

  function login(number: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: number, password: PASSWORD });
  }

  const asManager = () => ({ Cookie: managerCookie });

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

    for (let i = 0; i < 3; i++) {
      const county = await prisma.county.create({
        data: {
          name: `Agent Test County ${base}-${i}`,
          code: 800000 + base + i,
        },
      });
      countyIds.push(county.id);
    }
    await makeUser(phone(1), 'MANAGER', 'ACTIVE');
    await makeUser(phone(2), 'AGENT', 'ACTIVE');
    managerCookie = cookieFrom(await login(phones[0]!).expect(200));
    agentCookie = cookieFrom(await login(phones[1]!).expect(200));
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await prisma.agentCounty.deleteMany({
      where: { agent: { userId: { in: ids } } },
    });
    await prisma.agent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.county.deleteMany({ where: { id: { in: countyIds } } });
    await app.close();
  });

  it('refuses everyone who is not the manager', async () => {
    const http = app.getHttpServer();
    await request(http).get('/agents').expect(401);
    await request(http).get('/agents').set('Cookie', agentCookie).expect(403);
    await request(http)
      .get('/agents/registrations')
      .set('Cookie', agentCookie)
      .expect(403);
    await request(http)
      .post('/agents/someone/approve')
      .set('Cookie', agentCookie)
      .send({ countyIds: [countyIds[0]] })
      .expect(403);
    await request(http)
      .post('/agents/someone/disable')
      .set('Cookie', agentCookie)
      .expect(403);
  });

  it('lists a pending registration, approves it with counties, and lets the agent in', async () => {
    const http = app.getHttpServer();
    const number = phone(3);
    const pending = await makeUser(number, 'AGENT', 'PENDING');

    const list = await request(http)
      .get('/agents/registrations')
      .set(asManager())
      .expect(200);
    const row = (list.body as { id: string; phone: string }[]).find(
      (r) => r.id === pending.id,
    );
    expect(row?.phone).toBe(number);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    await login(number).expect(403);

    const approved = await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({ countyIds: [countyIds[0], countyIds[1]] })
      .expect(200);
    expect(approved.body).toMatchObject({
      userId: pending.id,
      status: 'ACTIVE',
      active: true,
    });
    expect((approved.body as { counties: unknown[] }).counties).toHaveLength(2);

    await login(number).expect(200);

    const after = await request(http)
      .get('/agents/registrations')
      .set(asManager())
      .expect(200);
    expect(
      (after.body as { id: string }[]).some((r) => r.id === pending.id),
    ).toBe(false);
    const agents = await request(http)
      .get('/agents')
      .set(asManager())
      .expect(200);
    expect(
      (agents.body as { userId: string }[]).some(
        (a) => a.userId === pending.id,
      ),
    ).toBe(true);
  });

  it('cannot approve twice, nor a manager, nor an unknown id', async () => {
    const http = app.getHttpServer();
    const pending = await makeUser(phone(4), 'AGENT', 'PENDING');
    const body = { countyIds: [countyIds[0]] };
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send(body)
      .expect(200);
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send(body)
      .expect(409);
    const manager = await prisma.user.findUniqueOrThrow({
      where: { phone: phones[0]! },
    });
    await request(http)
      .post(`/agents/${manager.id}/approve`)
      .set(asManager())
      .send(body)
      .expect(404);
    await request(http)
      .post('/agents/not-a-user/approve')
      .set(asManager())
      .send(body)
      .expect(404);
  });

  it('rejects approval without counties or with an unknown county', async () => {
    const http = app.getHttpServer();
    const pending = await makeUser(phone(5), 'AGENT', 'PENDING');
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({ countyIds: [] })
      .expect(400);
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({})
      .expect(400);
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({ countyIds: ['no-such-county'] })
      .expect(400);
    const still = await prisma.user.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(still.status).toBe('PENDING');
    expect(await prisma.agent.count({ where: { userId: pending.id } })).toBe(0);
  });

  it("replaces an agent's counties", async () => {
    const http = app.getHttpServer();
    const pending = await makeUser(phone(6), 'AGENT', 'PENDING');
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({ countyIds: [countyIds[0]] })
      .expect(200);
    const updated = await request(http)
      .put(`/agents/${pending.id}/counties`)
      .set(asManager())
      .send({ countyIds: [countyIds[1], countyIds[2]] })
      .expect(200);
    const ids = (updated.body as { counties: { id: string }[] }).counties
      .map((c) => c.id)
      .sort();
    expect(ids).toEqual([countyIds[1], countyIds[2]].sort());
  });

  it('disables an agent: sessions end, sign-in is refused, assignments stop', async () => {
    const http = app.getHttpServer();
    const number = phone(7);
    const pending = await makeUser(number, 'AGENT', 'PENDING');
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({ countyIds: [countyIds[0]] })
      .expect(200);
    const cookie = cookieFrom(await login(number).expect(200));
    await request(http).get('/auth/me').set('Cookie', cookie).expect(200);

    await request(http)
      .post(`/agents/${pending.id}/disable`)
      .set(asManager())
      .expect(204);

    await request(http).get('/auth/me').set('Cookie', cookie).expect(401);
    await login(number).expect(403);
    const agent = await prisma.agent.findUniqueOrThrow({
      where: { userId: pending.id },
    });
    expect(agent.active).toBe(false);
  });

  it('rejects a pending registration by disabling it', async () => {
    const http = app.getHttpServer();
    const pending = await makeUser(phone(8), 'AGENT', 'PENDING');
    await request(http)
      .post(`/agents/${pending.id}/disable`)
      .set(asManager())
      .expect(204);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(user.status).toBe('DISABLED');
    await request(http)
      .post('/agents/not-a-user/disable')
      .set(asManager())
      .expect(404);
  });

  it('re-enables a disabled agent with their counties (D37)', async () => {
    const http = app.getHttpServer();
    const number = phone(9);
    const pending = await makeUser(number, 'AGENT', 'PENDING');
    await request(http)
      .post(`/agents/${pending.id}/approve`)
      .set(asManager())
      .send({ countyIds: [countyIds[0], countyIds[1]] })
      .expect(200);
    await request(http)
      .post(`/agents/${pending.id}/disable`)
      .set(asManager())
      .expect(204);
    await login(number).expect(403);

    const res = await request(http)
      .post(`/agents/${pending.id}/enable`)
      .set(asManager())
      .expect(200);
    const body = res.body as { active: boolean; counties: { id: string }[] };
    expect(body.active).toBe(true);
    expect(body.counties).toHaveLength(2);
    await login(number).expect(200);

    // Already active: nothing to re-enable.
    await request(http)
      .post(`/agents/${pending.id}/enable`)
      .set(asManager())
      .expect(409);
  });

  it('cannot re-enable a rejected registration, an unknown user or as an agent', async () => {
    const http = app.getHttpServer();
    const rejected = await makeUser(phone(10), 'AGENT', 'PENDING');
    await request(http)
      .post(`/agents/${rejected.id}/disable`)
      .set(asManager())
      .expect(204);
    await request(http)
      .post(`/agents/${rejected.id}/enable`)
      .set(asManager())
      .expect(409);
    await request(http)
      .post('/agents/not-a-user/enable')
      .set(asManager())
      .expect(404);
    await request(http)
      .post(`/agents/${rejected.id}/enable`)
      .set({ Cookie: agentCookie })
      .expect(403);
  });
});
