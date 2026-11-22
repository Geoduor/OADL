import { normaliseKenyanMobile } from './phone.js';

describe('normaliseKenyanMobile', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['0112345678', '+254112345678'],
    ['+254712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['0712 345 678', '+254712345678'],
    ['+254-712-345-678', '+254712345678'],
  ])('accepts %s', (input, expected) => {
    expect(normaliseKenyanMobile(input)).toBe(expected);
  });

  it.each([
    '',
    '0812345678',
    '071234567',
    '07123456789',
    '+255712345678',
    '712345678',
    'abc',
    '+254 7123',
  ])('rejects %j', (input) => {
    expect(normaliseKenyanMobile(input)).toBeNull();
  });
});
