// The user object the guard puts on each authenticated request. It types
// @CurrentUser() everywhere (see the package's AuthenticationTypes).
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'MANAGER' | 'AGENT';
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
  }
}
