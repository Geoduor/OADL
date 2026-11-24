import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './auth-types.js';

// Server-side role checks for controllers. The global guard has already
// required a signed-in user; these add the role.
export function requireManager(user: AuthUser): void {
  if (user.role !== 'MANAGER') {
    throw new ForbiddenException();
  }
}

export function requireAgent(user: AuthUser): void {
  if (user.role !== 'AGENT') {
    throw new ForbiddenException();
  }
}
