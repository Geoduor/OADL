import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TurnstileService } from '../src/turnstile/turnstile.service.js';
import { assertLocalDatabase } from './support/local-database.js';

// Test phones are in a block no real customer uses; the rows are deleted
// afterwards. Passwords are throwaway test strings.
const PASSWORD = 'test-password-123';

function phoneFor(n: number): string {
  return `+2547000${String(n).padStart(5, '0')}`;
}

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;
  const base = Math.floor(Math.random() * 90000);
  const phones: string[] = [];

  function newPhone(offset: number): string {
    const phone = phoneFor(base + offset);
    phones.push(phone);
    return phone;
  }

  // supertest cannot send a Secure cookie over http, so the cookie is taken
  // from Set-Cookie and sent back by hand.
  function cookieFrom(res: request.Response): string {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    const first = header?.[0];
    if (!first) {
      throw new Error('No Set-Cookie header');
    }
    return first.split(';')[0]!;
  }

  async function makeUser(
    phone: string,
    data: {
      role?: 'AGENT' | 'MANAGER';
      status?: 'PENDING' | 'ACTIVE' | 'DISABLED';
    },
  ) {
    return prisma.user.create({
      data: {
        name: 'Test User',
        phone,
        passwordHash: await hasher.hash(PASSWORD),
        role: data.role ?? 'AGENT',
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  function login(phone: string, password = PASSWORD) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password });
  }

  beforeAll(async () => {
    assertLocalDatabase();
    hasher = new PasswordHasher({ logN: 10 }); // cheap cost, tests only
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

  it('keeps the public routes public', async () => {
    await request(app.getHttpServer()).get('/counties').expect(200);
    await request(app.getHttpServer()).get('/products').expect(200);
  });

  it('refuses /auth/me without a session', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('registers a pending agent, who cannot sign in until approved', async () => {
    const phone = newPhone(1);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test Agent',
        phone,
        password: PASSWORD,
        turnstileToken: 't',
      })
      .expect(202);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(user.role).toBe('AGENT');
    expect(user.status).toBe('PENDING');
    expect(user.passwordHash).not.toContain(PASSWORD);

    await login(phone).expect(403);

    await prisma.user.update({ where: { phone }, data: { status: 'ACTIVE' } });
    const ok = await login(phone).expect(200);
    expect(ok.body).toEqual({
      id: user.id,
      name: 'Test Agent',
      role: 'AGENT',
    });
  });

  it('ignores a role sent by the client when registering', async () => {
    const phone = newPhone(2);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Sneaky Agent',
        phone,
        password: PASSWORD,
        turnstileToken: 't',
        role: 'MANAGER',
        status: 'ACTIVE',
      })
      .expect(202);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(user.role).toBe('AGENT');
    expect(user.status).toBe('PENDING');
  });

  it('answers a duplicate registration the same way and keeps the original', async () => {
    const phone = newPhone(3);
    const body = {
      name: 'First Name',
      phone,
      password: PASSWORD,
      turnstileToken: 't',
    };
    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(202);
    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...body, name: 'Someone Else', password: 'another-password-1' })
      .expect(202);
    expect(second.body).toEqual(first.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(user.name).toBe('First Name');
  });

  it('gives wrong password and unknown phone the same answer', async () => {
    const phone = newPhone(4);
    await makeUser(phone, {});
    const wrong = await login(phone, 'not-the-password').expect(401);
    const unknown = await login(newPhone(5)).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('signs in, shows /auth/me and signs out', async () => {
    const phone = newPhone(6);
    const user = await makeUser(phone, {});
    const res = await login(phone).expect(200);
    const cookie = cookieFrom(res);
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body).toEqual({ id: user.id, name: 'Test User', role: 'AGENT' });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('ends the session when the manager disables the account', async () => {
    const phone = newPhone(7);
    await makeUser(phone, {});
    const cookie = cookieFrom(await login(phone).expect(200));
    await prisma.user.update({
      where: { phone },
      data: { status: 'DISABLED' },
    });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
    await login(phone).expect(403);
  });

  it('ends a manager session after 7 days but not an agent session', async () => {
    const managerPhone = newPhone(8);
    const agentPhone = newPhone(9);
    const manager = await makeUser(managerPhone, { role: 'MANAGER' });
    const agent = await makeUser(agentPhone, {});
    const managerCookie = cookieFrom(await login(managerPhone).expect(200));
    const agentCookie = cookieFrom(await login(agentPhone).expect(200));

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.session.updateMany({
      where: { userId: manager.id },
      data: { createdAt: eightDaysAgo },
    });
    await prisma.session.updateMany({
      where: { userId: agent.id },
      data: { createdAt: eightDaysAgo },
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', managerCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', agentCookie)
      .expect(200);
  });
});
