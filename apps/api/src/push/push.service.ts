import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { pushConfig } from './push.config.js';
import { PushSender, type PushResult } from './push-sender.js';
import { pushUrl } from './push-url.js';
import type { SubscribeInput } from './push.schemas.js';

const POLL_MS = 5000;
// Alerts older than this are not pushed: a phone that comes back an hour
// later should not buzz for a stale order (the in-app list still has it).
// TODO(confirm): technical placeholder, not a client rule.
const FRESH_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BATCH = 50;

// Web Push (N4). The stored notification row is the outbox (AGENTS.md
// section 5): the order change commits first, and this sender picks the row up
// afterwards, so a failing push service can never fail or roll back an order.
@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: PushSender,
  ) {}

  onModuleInit(): void {
    if (!pushConfig()) {
      this.logger.log('Web Push is off: VAPID settings are not set');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  publicKey(): { enabled: boolean; publicKey: string | null } {
    const config = pushConfig();
    return { enabled: !!config, publicKey: config?.publicKey ?? null };
  }

  // The same device can change hands: a re-used endpoint moves to the user who
  // is signed in now.
  async subscribe(userId: string, input: SubscribeInput): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  }

  // Scoped to the signed-in user so nobody can remove someone else's device.
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.dispatchPending();
    } catch {
      // Never log row contents. The next tick tries again.
      this.logger.warn('Push dispatch failed; will retry');
    } finally {
      this.running = false;
    }
  }

  // Sends fresh unsent alerts to the devices of the user they belong to.
  // Returns how many alerts were claimed (for tests).
  async dispatchPending(now: Date = new Date()): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: {
        pushedAt: null,
        pushAttempts: { lt: MAX_ATTEMPTS },
        createdAt: { gte: new Date(now.getTime() - FRESH_MS) },
        user: { pushSubscriptions: { some: {} } },
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        orderId: true,
        user: {
          select: {
            role: true,
            pushSubscriptions: {
              select: { id: true, endpoint: true, p256dh: true, auth: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });

    let claimed = 0;
    for (const row of rows) {
      // Claim first so two API instances never send the same alert twice.
      const claim = await this.prisma.notification.updateMany({
        where: { id: row.id, pushedAt: null },
        data: { pushedAt: now },
      });
      if (claim.count === 0) continue;
      claimed += 1;

      const payload = {
        title: row.title,
        body: row.body,
        url: pushUrl(row.user.role, row.type, row.orderId),
      };
      const results: PushResult[] = [];
      for (const subscription of row.user.pushSubscriptions) {
        const result = await this.sender.send(subscription, payload);
        results.push(result);
        if (result === 'gone') {
          await this.prisma.pushSubscription.deleteMany({
            where: { id: subscription.id },
          });
        }
      }

      // Nothing got through and something is worth retrying: put it back.
      if (results.includes('retry') && !results.includes('ok')) {
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { pushedAt: null, pushAttempts: { increment: 1 } },
        });
        this.logger.warn(`Push attempt failed for notification ${row.id}`);
      }
    }
    return claimed;
  }
}
