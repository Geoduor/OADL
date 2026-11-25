import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const agentSelect = {
  userId: true,
  displayName: true,
  active: true,
  user: { select: { phone: true, status: true } },
  counties: { select: { county: { select: { id: true, name: true } } } },
} as const;

// Manager-only operations on agents. The controller checks the role.
@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  listPending() {
    return this.prisma.user.findMany({
      where: { role: 'AGENT', status: 'PENDING' },
      select: { id: true, name: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async list() {
    const agents = await this.prisma.agent.findMany({
      select: agentSelect,
      orderBy: { displayName: 'asc' },
    });
    return agents.map(toView);
  }

  // Approving activates the account, creates the agent profile and saves the
  // counties, all in one transaction. The status change is conditional, so
  // two managers' clicks cannot approve the same agent twice.
  async approve(userId: string, countyIds: string[]) {
    const ids = await this.validCountyIds(countyIds);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, role: 'AGENT', status: 'PENDING' },
        data: { status: 'ACTIVE' },
      });
      if (count === 0) {
        const existing = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (existing?.role !== 'AGENT') {
          throw new NotFoundException('Agent not found');
        }
        throw new ConflictException('This agent is not waiting for approval');
      }
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true },
      });
      const agent = await tx.agent.create({
        data: {
          userId,
          displayName: user.name,
          counties: { create: ids.map((countyId) => ({ countyId })) },
        },
        select: agentSelect,
      });
      return toView(agent);
    });
  }

  async setCounties(userId: string, countyIds: string[]) {
    const ids = await this.validCountyIds(countyIds);
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.agentCounty.deleteMany({ where: { agentId: agent.id } });
      await tx.agentCounty.createMany({
        data: ids.map((countyId) => ({ agentId: agent.id, countyId })),
      });
      return tx.agent.findUniqueOrThrow({
        where: { id: agent.id },
        select: agentSelect,
      });
    });
    return toView(updated);
  }

  // Disabling stops sign-in (the account is checked on every request) and
  // stops assignments. Works on a pending registration too, which is how the
  // manager rejects it. The account row is kept, never deleted.
  async disable(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, role: 'AGENT' },
        data: { status: 'DISABLED' },
      });
      if (count === 0) {
        throw new NotFoundException('Agent not found');
      }
      await tx.agent.updateMany({ where: { userId }, data: { active: false } });
      await tx.session.deleteMany({ where: { userId } });
    });
  }

  // Re-enabling restores a disabled agent: sign-in works again, with the
  // counties they had (D37). Only for someone who was once approved. A
  // rejected registration has no agent profile, so it must be approved
  // instead (it is not shown as re-enableable).
  async enable(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.agent.findUnique({
        where: { userId },
        select: { id: true, user: { select: { status: true } } },
      });
      if (!agent) {
        const user = await tx.user.findFirst({
          where: { id: userId, role: 'AGENT' },
          select: { id: true },
        });
        if (!user) {
          throw new NotFoundException('Agent not found');
        }
        throw new ConflictException(
          'This registration was never approved, so it cannot be re-enabled',
        );
      }
      const { count } = await tx.user.updateMany({
        where: { id: userId, status: 'DISABLED' },
        data: { status: 'ACTIVE' },
      });
      if (count === 0) {
        throw new ConflictException('This agent is not disabled');
      }
      const restored = await tx.agent.update({
        where: { id: agent.id },
        data: { active: true },
        select: agentSelect,
      });
      return toView(restored);
    });
  }

  private async validCountyIds(countyIds: string[]): Promise<string[]> {
    const unique = [...new Set(countyIds)];
    const found = await this.prisma.county.count({
      where: { id: { in: unique } },
    });
    if (found !== unique.length) {
      throw new BadRequestException('One or more counties do not exist');
    }
    return unique;
  }
}

function toView(agent: {
  userId: string;
  displayName: string;
  active: boolean;
  user: { phone: string; status: string };
  counties: { county: { id: string; name: string } }[];
}) {
  return {
    userId: agent.userId,
    displayName: agent.displayName,
    phone: agent.user.phone,
    status: agent.user.status,
    active: agent.active,
    counties: agent.counties.map((entry) => entry.county),
  };
}
