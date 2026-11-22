import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasher, SignInService } from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUniqueViolation } from '../prisma/unique-violation.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly signInService: SignInService,
  ) {}

  // Agents register themselves and wait for the manager (D26). The answer is
  // the same for a new and an already registered phone, so nobody can use
  // this route to find out who has an account. The password is hashed first
  // so both cases take about the same time.
  async register(input: Omit<RegisterInput, 'turnstileToken'>): Promise<void> {
    const passwordHash = await this.hasher.hash(input.password);
    try {
      await this.prisma.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          passwordHash,
          role: 'AGENT',
          status: 'PENDING',
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { phone: input.phone },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        passwordHash: true,
      },
    });
    // verify() checks a dummy hash for an unknown phone, so the response time
    // does not reveal which accounts exist.
    const valid = await this.hasher.verify(input.password, user?.passwordHash);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid phone number or password');
    }
    // Only someone who knows the password learns the account status.
    if (user.status === 'PENDING') {
      throw new ForbiddenException(
        'Your account is waiting for the manager to approve it',
      );
    }
    if (user.status === 'DISABLED') {
      throw new ForbiddenException('Your account is disabled');
    }
    if (this.hasher.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.hasher.hash(input.password) },
      });
    }
    await this.signInService.signIn(user.id, { method: 'password' });
    return { id: user.id, name: user.name, role: user.role };
  }

  async logout(): Promise<void> {
    await this.signInService.signOut();
  }
}
