import { validateRegistration } from './registration.js';

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
