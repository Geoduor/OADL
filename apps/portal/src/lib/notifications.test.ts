import { badgeText, orderPathFor } from './notifications.js';

describe('orderPathFor', () => {
  it('sends a manager to the order detail', () => {
    expect(
      orderPathFor('MANAGER', { orderId: 'o1', type: 'ORDER_PLACED' }),
    ).toBe('/manager/orders/o1');
  });

  it('sends an agent to their own order page', () => {
    expect(
      orderPathFor('AGENT', { orderId: 'o1', type: 'ORDER_ASSIGNED' }),
    ).toBe('/agent/orders/o1');
    expect(
      orderPathFor('AGENT', { orderId: 'o1', type: 'ORDER_STATUS_CHANGED' }),
    ).toBe('/agent/orders/o1');
  });

  it('does not link an agent to an order that was taken off them', () => {
    expect(
      orderPathFor('AGENT', { orderId: 'o1', type: 'ORDER_RELEASED' }),
    ).toBeNull();
  });

  it('has nowhere to go without an order', () => {
    expect(
      orderPathFor('MANAGER', { orderId: null, type: 'ORDER_PLACED' }),
    ).toBeNull();
  });
});

describe('badgeText', () => {
  it('caps large counts', () => {
    expect(badgeText(3)).toBe('3');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });
});
