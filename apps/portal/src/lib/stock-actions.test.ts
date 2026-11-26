import { STOCK_ACTIONS, movementLabel, stockBody } from './stock-actions.js';

const [issue, , adjust] = STOCK_ACTIONS;
const base = { agentUserId: 'u1', productId: 'p1', quantity: '5', note: '' };

describe('stockBody', () => {
  it('builds an issue request without a note', () => {
    expect(stockBody(issue!, base)).toEqual({
      agentUserId: 'u1',
      productId: 'p1',
      quantity: 5,
    });
  });

  it('refuses zero, decimals and negatives for issue', () => {
    expect(stockBody(issue!, { ...base, quantity: '0' })).toBeNull();
    expect(stockBody(issue!, { ...base, quantity: '1.5' })).toBeNull();
    expect(stockBody(issue!, { ...base, quantity: '-2' })).toBeNull();
    expect(stockBody(issue!, { ...base, quantity: '' })).toBeNull();
  });

  it('allows a negative correction but only with a reason', () => {
    expect(stockBody(adjust!, { ...base, quantity: '-2' })).toBeNull();
    expect(
      stockBody(adjust!, { ...base, quantity: '-2', note: 'damaged' }),
    ).toEqual({
      agentUserId: 'u1',
      productId: 'p1',
      quantity: -2,
      reason: 'damaged',
    });
  });
});

describe('movementLabel', () => {
  it('uses plain words', () => {
    expect(movementLabel('RETURN_TO_STORE')).toBe('Returned');
  });
});
