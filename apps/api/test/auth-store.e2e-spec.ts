import { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { PrismaAuthenticationStore } from '../src/auth/prisma-authentication.store.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabase } from './support/local-database.js';

// The package's own checks for a session store, run against PostgreSQL.
describe('PrismaAuthenticationStore (package contract)', () => {
  const prisma = new PrismaService();

  beforeAll(async () => {
    assertLocalDatabase();
    await prisma.$connect();
  });

  afterAll(async () => {
    // The contract uses user ids that are not in "users"; only sessions
    // whose user does not exist are removed, so real sessions are untouched.
    const users = await prisma.user.findMany({ select: { id: true } });
    await prisma.session.deleteMany({
      where: { userId: { notIn: users.map((user) => user.id) } },
    });
    await prisma.$disconnect();
  });

  const cases = authenticationStoreContract(
    () => {
      const store = new PrismaAuthenticationStore(
        prisma,
        new AuthenticationStorage(),
      );
      return { sessions: store };
    },
    { contracts: ['sessions'], concurrent: true },
  );

  for (const testCase of cases) {
    it(testCase.name, () => testCase.run());
  }
});
