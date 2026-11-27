import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nairobiDayStart } from '../time/nairobi.js';
import type { PaymentsSummaryQuery } from './payments.schemas.js';

const DAY_MS = 86_400_000;

// Kept exported from here for the files that already import it.
export { nairobiDayStart };

// Read-only report of what each agent has recorded as collected (D34).
// "Collected" is what the agent says they received. Handing it over to the
// manager is not recorded yet, so this is not a balance owed.
// TODO(confirm): agent-to-manager settlement (Phase 2) is not built.
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: PaymentsSummaryQuery) {
    const where: Prisma.PaymentWhereInput =
      query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: nairobiDayStart(query.from) } : {}),
              ...(query.to
                ? {
                    lt: new Date(nairobiDayStart(query.to).getTime() + DAY_MS),
                  }
                : {}),
            },
          }
        : {};

    const groups = await this.prisma.payment.groupBy({
      by: ['agentId', 'method'],
      where,
      _sum: { amountKes: true },
      _count: { _all: true },
    });
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: [...new Set(groups.map((g) => g.agentId))] } },
      select: { id: true, userId: true, displayName: true },
    });
    const byId = new Map(agents.map((agent) => [agent.id, agent]));

    const rows = new Map<
      string,
      {
        agentUserId: string;
        agentName: string;
        cashKes: number;
        mpesaKes: number;
        totalKes: number;
        payments: number;
      }
    >();
    for (const group of groups) {
      const agent = byId.get(group.agentId);
      if (!agent) continue;
      const row = rows.get(agent.id) ?? {
        agentUserId: agent.userId,
        agentName: agent.displayName,
        cashKes: 0,
        mpesaKes: 0,
        totalKes: 0,
        payments: 0,
      };
      const amount = group._sum.amountKes ?? 0;
      if (group.method === 'CASH') row.cashKes += amount;
      else row.mpesaKes += amount;
      row.totalKes += amount;
      row.payments += group._count._all;
      rows.set(agent.id, row);
    }

    const list = [...rows.values()].sort((a, b) =>
      a.agentName.localeCompare(b.agentName),
    );
    return {
      from: query.from ?? null,
      to: query.to ?? null,
      agents: list,
      totals: list.reduce(
        (sum, row) => ({
          cashKes: sum.cashKes + row.cashKes,
          mpesaKes: sum.mpesaKes + row.mpesaKes,
          totalKes: sum.totalKes + row.totalKes,
          payments: sum.payments + row.payments,
        }),
        { cashKes: 0, mpesaKes: 0, totalKes: 0, payments: 0 },
      ),
    };
  }
}
