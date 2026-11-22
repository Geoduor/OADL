import { loginSchema, registerSchema } from './auth.schemas.js';

const valid = {
  name: 'Test Agent',
  phone: '0712345678',
  password: 'a-long-enough-password',
  turnstileToken: 'token',
};

describe('registerSchema', () => {
  it('normalises the phone to E.164', () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success && result.data.phone).toBe('+254712345678');
  });

  it('rejects a short password', () => {
    expect(
      registerSchema.safeParse({ ...valid, password: 'short' }).success,
    ).toBe(false);
  });

  it('rejects a non-Kenyan-mobile phone', () => {
    expect(registerSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(
      false,
    );
  });

  it('rejects a missing Turnstile token', () => {
    const { turnstileToken: _omit, ...rest } = valid;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it('does not accept a role from the client', () => {
    const result = registerSchema.safeParse({ ...valid, role: 'MANAGER' });
    expect(result.success && 'role' in result.data).toBe(false);
  });
});

describe('loginSchema', () => {
  it('normalises the phone and keeps the password as typed', () => {
    const result = loginSchema.safeParse({
      phone: '+254 712 345 678',
      password: 'x',
    });
    expect(result.success && result.data).toEqual({
      phone: '+254712345678',
      password: 'x',
    });
  });
});
