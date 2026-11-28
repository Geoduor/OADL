import { chooseAgent, type Candidate } from './choose-agent.js';

function agent(
  id: string,
  openOrders: number,
  hasStock = true,
  displayName = `Agent ${id}`,
): Candidate {
  return { agentId: id, userId: `u-${id}`, displayName, openOrders, hasStock };
}

describe('chooseAgent', () => {
  it('picks the agent with the fewest open orders', () => {
    const result = chooseAgent([agent('a', 3), agent('b', 1), agent('c', 2)]);
    expect(result).toMatchObject({ ok: true, agent: { agentId: 'b' } });
  });

  it('never picks an agent without enough stock, even with fewer orders', () => {
    const result = chooseAgent([agent('a', 0, false), agent('b', 5)]);
    expect(result).toMatchObject({ ok: true, agent: { agentId: 'b' } });
  });

  it('says nobody covers the county', () => {
    expect(chooseAgent([])).toEqual({ ok: false, reason: 'NO_COVERAGE' });
  });

  it('says there is no stock when covering agents all lack it', () => {
    expect(chooseAgent([agent('a', 0, false), agent('b', 1, false)])).toEqual({
      ok: false,
      reason: 'NO_STOCK',
    });
  });

  it('breaks ties by name, then id, the same way every time', () => {
    const tied = [agent('b', 1, true, 'Zed'), agent('a', 1, true, 'Amy')];
    expect(chooseAgent(tied)).toMatchObject({ agent: { displayName: 'Amy' } });
    expect(chooseAgent([...tied].reverse())).toMatchObject({
      agent: { displayName: 'Amy' },
    });
    const sameName = [agent('b', 1, true, 'Sam'), agent('a', 1, true, 'Sam')];
    expect(chooseAgent(sameName)).toMatchObject({ agent: { agentId: 'a' } });
  });
});
