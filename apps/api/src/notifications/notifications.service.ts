import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListNotificationsInput } from './notifications.schemas.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface NewNotification {
  userId: string;
  type:
    | 'ORDER_PLACED'
    | 'ORDER_ASSIGNED'
    | 'ORDER_RELEASED'
    | 'ORDER_STATUS_CHANGED';
  title: string;
  // Order number and county only: no customer name, phone or address.
  body: string;
  orderId: string;
}

// Explicit allow-list so a new internal column cannot leak.
const select = {
  id: true,
  type: true,
  title: true,
  body: true,
  orderId: true,
  readAt: true,
  createdAt: true,
} as const;

// Stored in-app notifications (docs/ARCHITECTURE.md 4.1 to 4.3). Every user
// only ever sees their own: every query is scoped by the signed-in user's id.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Takes the caller's transaction so a notification is written together with
  // the change that caused it, and rolled back with it.
  async createMany(db: Db, items: NewNotification[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await db.notification.createMany({ data: items });
  }

  // Active managers (D23: one today). Used for "new order" and for status
  // changes the agent makes.
  async managerIds(db: Db): Promise<string[]> {
    const managers = await db.user.findMany({
      where: { role: 'MANAGER', status: 'ACTIVE' },
      select: { id: true },
    });
    return managers.map((manager) => manager.id);
  }

  list(userId: string, query: ListNotificationsInput) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unread === 'true' ? { readAt: null } : {}),
      },
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    // Scoped by userId, so someone else's id looks like a missing one.
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('Notification not found');
      }
    }
    return this.prisma.notification.findFirstOrThrow({
      where: { id, userId },
      select,
    });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
