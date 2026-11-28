import { describe, expect, it } from 'vitest';
import {
  MIN_RECHECK_MS,
  shouldRecheck,
  userAfterCheck,
} from './session-check.js';
import type { SessionUser } from './types.js';

const agent = { id: 'u1', name: 'Test Agent', role: 'AGENT' } as SessionUser;
const manager = {
  id: 'u2',
  name: 'Test Manager',
  role: 'MANAGER',
} as SessionUser;

describe('userAfterCheck', () => {
  it('keeps the same object when nothing changed', () => {
    expect(userAfterCheck(agent, { kind: 'ok', me: { ...agent } })).toBe(agent);
  });

  it('switches to the user the cookie now belongs to', () => {
    expect(userAfterCheck(agent, { kind: 'ok', me: manager })).toBe(manager);
  });

  it('signs out on a 401 only', () => {
    expect(userAfterCheck(agent, { kind: 'unauthorized' })).toBeNull();
    expect(userAfterCheck(agent, { kind: 'error' })).toBe(agent);
  });
});

describe('shouldRecheck', () => {
  it('waits, and only when the tab is visible', () => {
    expect(shouldRecheck(0, MIN_RECHECK_MS - 1, true)).toBe(false);
    expect(shouldRecheck(0, MIN_RECHECK_MS, true)).toBe(true);
    expect(shouldRecheck(0, MIN_RECHECK_MS, false)).toBe(false);
  });
});
