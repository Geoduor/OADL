// Auto-assign rule (docs/REQUIREMENTS.md US-13, D8): among active agents who
// cover the order's county and have enough stock for every item, pick the one
// with the fewest open orders. Pure: no database.

export interface Candidate {
  agentId: string;
  userId: string;
  displayName: string;
  // Orders the agent holds that are not finished (assigned, dispatched,
  // rescheduled, unresponsive).
  openOrders: number;
  hasStock: boolean;
}

export type NoAgentReason = 'NO_COVERAGE' | 'NO_STOCK';

export type Choice =
  { ok: true; agent: Candidate } | { ok: false; reason: NoAgentReason };

// `covering` is every active agent that covers the county. An empty list means
// nobody covers it; a non-empty list where nobody has stock is a stock problem.
// Ties on open orders go to the earlier name, then the id, so the same inputs
// always give the same agent.
// TODO(confirm): US-13 does not say how to break a tie.
export function chooseAgent(covering: readonly Candidate[]): Choice {
  if (covering.length === 0) {
    return { ok: false, reason: 'NO_COVERAGE' };
  }
  const withStock = covering.filter((candidate) => candidate.hasStock);
  if (withStock.length === 0) {
    return { ok: false, reason: 'NO_STOCK' };
  }
  const [best] = [...withStock].sort(
    (a, b) =>
      a.openOrders - b.openOrders ||
      a.displayName.localeCompare(b.displayName) ||
      a.agentId.localeCompare(b.agentId),
  );
  return { ok: true, agent: best! };
}

export const NO_AGENT_MESSAGES: Record<NoAgentReason, string> = {
  NO_COVERAGE: 'No active agent covers this county. Assign it by hand.',
  NO_STOCK:
    'No agent covering this county has enough stock for this order. Issue stock or assign it by hand.',
};
