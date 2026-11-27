// Client-side checks for agent self-registration (D26, US-37). The API
// validates everything again; these only save a round trip.
// TODO(confirm): the minimum length mirrors the API's technical default
// (apps/api/src/auth/auth.schemas.ts), not a client rule.
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
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (form.password !== form.confirmPassword) {
    return 'The two passwords do not match.';
  }
  return null;
}
