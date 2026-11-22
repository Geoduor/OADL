import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

type SessionRow = {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  mfa: string | null;
  metadata: unknown;
};

// Sessions in PostgreSQL. The package requires a store in production and
// checks this one with authenticationStoreContract (test/auth-store.e2e-spec.ts).
// Contract: optional fields come back undefined, never null.
@Injectable()
export class PrismaAuthenticationStore implements SessionStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    return row ? toRecord(row) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    // Keeps the table bounded: sessions past their absolute expiry go when a
    // new one is saved. "Now" is the new session's createdAt, which is the
    // package's clock (the same instant in production, a fixed one in the
    // package's contract tests).
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: record.createdAt } },
    });
    await this.prisma.session.create({
      data: {
        id: record.id,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastActiveAt: record.lastActiveAt,
        mfa: record.mfa,
        // Prisma's Json input type is stricter than Record<string, unknown>;
        // the package only stores plain JSON values here.
        metadata: record.metadata as object | undefined,
      },
    });
  }

  // One conditional write, only forward, only if the session still exists.
  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, lastActiveAt: { lt: lastActiveAt } },
      data: { lastActiveAt },
    });
  }

  // One statement; resolves whether this call deleted the session.
  async deleteSession(id: string): Promise<boolean> {
    const { count } = await this.prisma.session.deleteMany({ where: { id } });
    return count > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.prisma.session.findMany({ where: { userId } });
    return rows.map(toRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

function toRecord(row: SessionRow): SessionRecord {
  const record: SessionRecord = {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastActiveAt: row.lastActiveAt,
  };
  if (row.mfa === 'pending' || row.mfa === 'verified') {
    record.mfa = row.mfa;
  }
  if (typeof row.metadata === 'object' && row.metadata !== null) {
    // Stored by createSession above from a Record<string, unknown>.
    record.metadata = row.metadata as Record<string, unknown>;
  }
  return record;
}
