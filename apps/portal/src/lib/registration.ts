// Client-side checks for agent self-registration (D26, US-37). The API
// validates everything again; these only save a round trip.
// TODO(confirm): the minimum length mirrors the API's technical default
// (apps/api/src/auth/auth.schemas.ts), not a client rule.
// Same rule as apps/api/src/orders/phone.ts (Communications Authority of
// Kenya numbering plan): 9 digits after +254, starting with 7 or 1. Returns
// E.164 or null. The API checks again.
export function normaliseKenyanMobile(input: string): string | null {
  const cleaned = input.replace(/[\s\-().]/g, '');
  let national: string;
  if (cleaned.startsWith('+254')) national = cleaned.slice(4);
  else if (cleaned.startsWith('254')) national = cleaned.slice(3);
  else if (cleaned.startsWith('0')) national = cleaned.slice(1);
  else return null;
  return /^[17]\d{8}$/.test(national) ? `+254${national}` : null;
}

export const MIN_PASSWORD_LENGTH = 10;

export interface RegistrationForm {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export function validateRegistration(form: RegistrationForm): string | null {
  if (form.name.trim().length < 2) {
    return 'Enter your full name.';
  }
  if (form.phone.trim().length === 0) {
    return 'Enter your phone number.';
  }
  if (normaliseKenyanMobile(form.phone) === null) {
    return 'Enter a valid Kenyan mobile number, like 0712 345 678. An email address will not work here.';
  }
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (form.password !== form.confirmPassword) {
    return 'The two passwords do not match.';
  }
  return null;
}
