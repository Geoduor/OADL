import type { SessionUser } from './types.js';

// Re-checking the session when a tab comes back into view (two windows of one
// browser share one cookie, so another window may have signed someone else in
// or out). A network error must never sign anyone out: only a real 401 does.
export type SessionCheck =
  | { kind: 'ok'; me: SessionUser }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export const MIN_RECHECK_MS = 30_000;

// What the signed-in user should become after a check. Returns the same object
// when nothing changed, so React does not re-render.
export function userAfterCheck(
  current: SessionUser | null | undefined,
  result: SessionCheck,
): SessionUser | null | undefined {
  if (result.kind === 'error') return current;
  if (result.kind === 'unauthorized') return null;
  if (
    current &&
    current.id === result.me.id &&
    current.role === result.me.role &&
    current.name === result.me.name
  ) {
    return current;
  }
  return result.me;
}

export function shouldRecheck(
  lastCheckedAt: number,
  now: number,
  visible: boolean,
): boolean {
  return visible && now - lastCheckedAt >= MIN_RECHECK_MS;
}
