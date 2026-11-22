import { createOrderSchema } from './create-order.schema.js';

const valid = {
  idempotencyKey: '3f1c1c0e-5f55-4d7e-9a4e-2f0f6b0c9a11',
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  customerName: 'Test Customer',
  customerPhone: '0712 345 678',
  countyId: '7d5e2d9a-0b7c-4a62-8f1e-5b8d3c2a1e90',
  location: 'Test estate, near the test stage',
  items: [{ productId: '0a9c1c8e-2f4b-4c61-9d3e-7b6a5e4d3c21', quantity: 2 }],
};

describe('createOrderSchema', () => {
  it('accepts a valid order and normalises the phone to E.164', () => {
    const parsed = createOrderSchema.parse(valid);
    expect(parsed.customerPhone).toBe('+254712345678');
  });

  it('drops client-supplied prices, totals, status and unknown keys', () => {
    const parsed = createOrderSchema.parse({
      ...valid,
      totalKes: 1,
      status: 'DELIVERED',
      items: [{ ...valid.items[0], priceKes: 1 }],
    });
    expect(parsed).not.toHaveProperty('totalKes');
    expect(parsed).not.toHaveProperty('status');
    expect(parsed.items[0]).not.toHaveProperty('priceKes');
  });

  it.each([
    ['a bad phone', { customerPhone: '12345' }],
    ['a missing idempotency key', { idempotencyKey: undefined }],
    ['a missing bot-check token', { turnstileToken: undefined }],
    [
      'a bot-check token over 2048 characters',
      { turnstileToken: 'x'.repeat(2049) },
    ],
    ['a non-uuid county', { countyId: 'nairobi' }],
    ['no items', { items: [] }],
    ['a zero quantity', { items: [{ ...valid.items[0], quantity: 0 }] }],
    [
      'a fractional quantity',
      { items: [{ ...valid.items[0], quantity: 1.5 }] },
    ],
    ['a too-short name', { customerName: 'A' }],
    [
      'the same product twice',
      { items: [valid.items[0], { ...valid.items[0], quantity: 3 }] },
    ],
  ])('rejects %s', (_label, change) => {
    expect(createOrderSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    );
  });
});
