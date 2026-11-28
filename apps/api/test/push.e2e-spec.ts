import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PushService } from '../src/push/push.service.js';
import { PushSender } from '../src/push/push-sender.js';
import { TurnstileService } from '../src/turnstile/turnstile.service.js';
import { assertLocalDatabase } from './support/local-database.js';

const PASSWORD = 'test-password-123';

// All data is fake, and nothing is sent: PushSender is replaced. Rows are
// unique to this file and deleted in afterAll.
describe('Web Push (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let push: PushService;
  let hasher: PasswordHasher;
  const send = vi.fn();
  const base = 20000 + Math.floor(Math.random() * 40000);
  const phones: string[] = [];
  let agent: { cookie: string; userId: string };
  let other: { cookie: string; userId: string };
  let n = 0;

  const endpoint = () =>
    `https://push.example.com/send/test-${base}-${(n += 1)}`;
  const keys = { p256dh: 'BTestKeyAAAA_bbbb-1234', auth: 'testAuth_1234' };

  function cookieFrom(res: request.Response): string {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    const first = header?.[0];
    if (!first) throw new Error('No Set-Cookie header');
    return first.split(';')[0]!;
  }

  async function makeUser(role: 'AGENT' | 'MANAGER') {
    const phone = `+2547005${String(base + phones.length).padStart(5, '0')}`;
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
    return { cookie: cookieFrom(res), userId: user.id };
  }

  const subscribe = (who: { cookie: string }, body: object) =>
    request(app.getHttpServer())
      .post('/push/subscribe')
      .set('Cookie', who.cookie)
      .send(body);

  const notify = (userId: string, createdAt?: Date) =>
    prisma.notification.create({
      data: {
        userId,
        type: 'ORDER_ASSIGNED',
        title: 'New order assigned',
        body: 'TEST-ORDER in Test County',
        ...(createdAt ? { createdAt } : {}),
      },
    });

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
      .overrideProvider(PushSender)
      .useValue({ isEnabled: () => true, send })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    push = moduleRef.get(PushService);
    agent = await makeUser('AGENT');
    other = await makeUser('MANAGER');
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue('ok');
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('needs a signed-in user', async () => {
    const http = app.getHttpServer();
    await request(http).get('/push/public-key').expect(401);
    await request(http).post('/push/subscribe').send({}).expect(401);
    await request(http).post('/push/unsubscribe').send({}).expect(401);
  });

  it('reports push as off when the VAPID settings are missing', async () => {
    const res = await request(app.getHttpServer())
      .get('/push/public-key')
      .set('Cookie', agent.cookie)
      .expect(200);
    expect(res.body).toEqual({ enabled: false, publicKey: null });
  });

  it('shares only the public key when push is on', async () => {
    process.env['VAPID_PUBLIC_KEY'] = 'test-public';
    process.env['VAPID_PRIVATE_KEY'] = 'test-private-secret';
    process.env['VAPID_SUBJECT'] = 'mailto:test@example.com';
    try {
      const res = await request(app.getHttpServer())
        .get('/push/public-key')
        .set('Cookie', agent.cookie)
        .expect(200);
      expect(res.body).toEqual({ enabled: true, publicKey: 'test-public' });
      expect(JSON.stringify(res.body)).not.toContain('secret');
    } finally {
      delete process.env['VAPID_PUBLIC_KEY'];
      delete process.env['VAPID_PRIVATE_KEY'];
      delete process.env['VAPID_SUBJECT'];
    }
  });

  it('rejects unsafe endpoints and malformed keys', async () => {
    await subscribe(agent, {
      endpoint: 'http://push.example.com/x',
      keys,
    }).expect(400);
    await subscribe(agent, { endpoint: 'https://127.0.0.1/x', keys }).expect(
      400,
    );
    await subscribe(agent, {
      endpoint: endpoint(),
      keys: { p256dh: 'bad key!', auth: 'x' },
    }).expect(400);
    await subscribe(agent, { endpoint: endpoint() }).expect(400);
  });

  it('stores a subscription once and moves it to the latest user', async () => {
    const url = endpoint();
    await subscribe(agent, { endpoint: url, keys }).expect(200);
    await subscribe(agent, { endpoint: url, keys }).expect(200);
    expect(
      await prisma.pushSubscription.count({ where: { endpoint: url } }),
    ).toBe(1);
    await subscribe(other, { endpoint: url, keys }).expect(200);
    const row = await prisma.pushSubscription.findUniqueOrThrow({
      where: { endpoint: url },
    });
    expect(row.userId).toBe(other.userId);
  });

  it('only lets the owner remove a subscription', async () => {
    const url = endpoint();
    await subscribe(agent, { endpoint: url, keys }).expect(200);
    await request(app.getHttpServer())
      .post('/push/unsubscribe')
      .set('Cookie', other.cookie)
      .send({ endpoint: url })
      .expect(200);
    expect(
      await prisma.pushSubscription.count({ where: { endpoint: url } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post('/push/unsubscribe')
      .set('Cookie', agent.cookie)
      .send({ endpoint: url })
      .expect(200);
    expect(
      await prisma.pushSubscription.count({ where: { endpoint: url } }),
    ).toBe(0);
  });

  describe('sending', () => {
    let url: string;

    beforeEach(async () => {
      await prisma.pushSubscription.deleteMany({
        where: { userId: { in: [agent.userId, other.userId] } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: [agent.userId, other.userId] } },
      });
      url = endpoint();
      await prisma.pushSubscription.create({
        data: { userId: agent.userId, endpoint: url, ...keys },
      });
    });

    it('pushes a new alert once, with no customer details', async () => {
      const row = await notify(agent.userId);
      expect(await push.dispatchPending()).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
      const [target, payload] = send.mock.calls[0]!;
      expect(target.endpoint).toBe(url);
      expect(payload).toEqual({
        title: 'New order assigned',
        body: 'TEST-ORDER in Test County',
        url: '/notifications',
      });
      const stored = await prisma.notification.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(stored.pushedAt).not.toBeNull();
      expect(await push.dispatchPending()).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('does not push to a user with no device', async () => {
      await notify(other.userId);
      expect(await push.dispatchPending()).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });

    it('skips alerts that are too old', async () => {
      await notify(agent.userId, new Date(Date.now() - 11 * 60 * 1000));
      expect(await push.dispatchPending()).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });

    it('deletes a subscription the push service says is gone', async () => {
      send.mockResolvedValue('gone');
      const row = await notify(agent.userId);
      await push.dispatchPending();
      expect(
        await prisma.pushSubscription.count({ where: { endpoint: url } }),
      ).toBe(0);
      const stored = await prisma.notification.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(stored.pushedAt).not.toBeNull();
    });

    it('retries a temporary failure, then gives up after three tries', async () => {
      send.mockResolvedValue('retry');
      const row = await notify(agent.userId);
      for (let i = 0; i < 5; i += 1) await push.dispatchPending();
      expect(send).toHaveBeenCalledTimes(3);
      const stored = await prisma.notification.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(stored.pushAttempts).toBe(3);
      expect(stored.pushedAt).toBeNull();
      expect(
        await prisma.pushSubscription.count({ where: { endpoint: url } }),
      ).toBe(1);
    });
  });
});
