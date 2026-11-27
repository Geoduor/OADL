import { normaliseKenyanMobile, validateRegistration } from './registration.js';

const valid = {
  name: 'Test Agent',
  phone: '0700 000 000',
  password: 'a-long-test-password',
  confirmPassword: 'a-long-test-password',
};

describe('validateRegistration', () => {
  it('accepts a complete form', () => {
    expect(validateRegistration(valid)).toBeNull();
  });

  it('asks for a name and a phone', () => {
    expect(validateRegistration({ ...valid, name: ' a ' })).toMatch(/name/i);
    expect(validateRegistration({ ...valid, phone: '  ' })).toMatch(/phone/i);
  });

  it('rejects a short password', () => {
    expect(
      validateRegistration({
        ...valid,
        password: 'short',
        confirmPassword: 'short',
      }),
    ).toMatch(/at least 10/);
  });

  it('rejects passwords that differ', () => {
    expect(
      validateRegistration({ ...valid, confirmPassword: 'something-else-1' }),
    ).toMatch(/do not match/);
  });
});

describe('phone check', () => {
  const ok = {
    name: 'Test Agent',
    phone: '0712 345 678',
    password: 'a-long-password',
    confirmPassword: 'a-long-password',
  };

  it('accepts local and international forms', () => {
    expect(validateRegistration(ok)).toBeNull();
    expect(validateRegistration({ ...ok, phone: '+254712345678' })).toBeNull();
  });

  it('rejects an email address in the phone box', () => {
    expect(
      validateRegistration({ ...ok, phone: 'someone@example.com' }),
    ).toMatch(/valid Kenyan mobile/);
  });

  it('normalises to E.164', () => {
    expect(normaliseKenyanMobile('0112345678')).toBe('+254112345678');
    expect(normaliseKenyanMobile('0812345678')).toBeNull();
  });
});
