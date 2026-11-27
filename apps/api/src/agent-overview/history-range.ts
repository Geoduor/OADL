import { nairobiDayStart, nairobiToday } from '../time/nairobi.js';

export const HISTORY_RANGES = ['today', 'week', 'month', 'all'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

const DAY_MS = 86_400_000;

// Where a history range starts, as the start of a Nairobi day (null = no
// lower bound). "Week" is the last 7 days and "month" the last 30, each
// counting today as the first day.
// TODO(confirm): calendar week or month may be what the manager means.
export function rangeStart(range: HistoryRange, now: Date): Date | null {
  const todayStart = nairobiDayStart(nairobiToday(now));
  switch (range) {
    case 'today':
      return todayStart;
    case 'week':
      return new Date(todayStart.getTime() - 6 * DAY_MS);
    case 'month':
      return new Date(todayStart.getTime() - 29 * DAY_MS);
    case 'all':
      return null;
  }
}
