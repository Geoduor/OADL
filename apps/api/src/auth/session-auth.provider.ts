import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// D25 (a proposal): agents stay signed in up to 30 days (the module's
// absoluteTtl), the manager 7 days. Enforced here because the package has one
// absolute lifetime for every session.
const MANAGER_SESSION_MS = 7 * DAY_MS;

// Runs on every authenticated request. Returning null ends the session, so
// a disabled or still-pending account is signed out at once (D25, D26).
@Injectable()
export class SessionAuth extends SessionCookieProvider<AuthUser> {
  constructor(
    private readonly prisma: PrismaService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected async validate(session: SessionRecord): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, phone: true, role: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }
    if (
      user.role === 'MANAGER' &&
      Date.now() - session.createdAt.getTime() > MANAGER_SESSION_MS
    ) {
      return null;
    }
    return { id: user.id, name: user.name, phone: user.phone, role: user.role };
  }
}
